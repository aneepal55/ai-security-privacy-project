import { NextRequest, NextResponse } from "next/server";
import { buildSystemPrompt, retrieveContext, type RetrievedChunk } from "@/lib/rag";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MODELS = new Set(["llama3.2", "mistral"]);
const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

export async function POST(request: NextRequest) {
  let body: { messages?: ChatMessage[]; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON in the request body." },
      { status: 400 },
    );
  }

  const messages = body.messages as ChatMessage[] | undefined;
  const model = body.model ?? "llama3.2";

  if (typeof model !== "string" || !MODELS.has(model)) {
    return NextResponse.json(
      { message: "Choose either Llama 3.2 or Mistral." },
      { status: 400 },
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { message: "Please provide at least one message." },
      { status: 400 },
    );
  }

  const lastMessage = messages[messages.length - 1];
  if (
    !lastMessage ||
    lastMessage.role !== "user" ||
    typeof lastMessage.content !== "string"
  ) {
    return NextResponse.json(
      { message: "The latest message must be from the user." },
      { status: 400 },
    );
  }

  const content = lastMessage.content.trim();
  if (!content) {
    return NextResponse.json(
      { message: "Please enter a message." },
      { status: 400 },
    );
  }

  if (messages.some((message) =>
    !message ||
    (message.role !== "user" && message.role !== "assistant") ||
    typeof message.content !== "string"
  )) {
    return NextResponse.json(
      { message: "Messages must have a user or assistant role and text content." },
      { status: 400 },
    );
  }

  // RAG: look up relevant chunks in Supabase. If it fails, fall back to plain chat.
  let chunks: RetrievedChunk[] = [];
  try {
    chunks = await retrieveContext(content);
  } catch (error) {
    console.error("RAG retrieval failed:", error);
  }
  const ollamaMessages = chunks.length > 0
    ? [{ role: "system", content: buildSystemPrompt(chunks) }, ...messages]
    : messages;
  const sources = [...new Set(chunks.map((c) => c.source))];

  let ollamaResponse: Response;
  try {
    ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: ollamaMessages, stream: true }),
      signal: AbortSignal.timeout(300_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      {
        message: timedOut
          ? "The local model took too long to respond. Please try again."
          : `Could not connect to Ollama at ${OLLAMA_URL}. Make sure Ollama is running, then try again.`,
      },
      { status: 503 },
    );
  }

  if (!ollamaResponse.ok || !ollamaResponse.body) {
    const details = await ollamaResponse.text().catch(() => "");
    return NextResponse.json(
      {
        message: ollamaResponse.status === 404
          ? `Ollama could not find the ${model} model. Run “ollama pull ${model}” in your terminal.`
          : `Ollama returned an error: ${details || ollamaResponse.statusText}`,
      },
      { status: 502 },
    );
  }

  // Stream newline-delimited JSON events to the browser:
  //   {"type":"sources","sources":[...]}  {"type":"token","text":"..."}  {"type":"error","message":"..."}
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const upstream = ollamaResponse.body.getReader();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      let produced = false;

      const handleLine = (line: string) => {
        if (!line.trim()) return;
        const part = JSON.parse(line);
        if (part.error) {
          send({ type: "error", message: `Ollama returned an error: ${part.error}` });
          return;
        }
        const text = part.message?.content;
        if (typeof text === "string" && text) {
          produced = true;
          send({ type: "token", text });
        }
      };

      send({ type: "sources", sources });
      try {
        let buffer = "";
        while (true) {
          const { done, value } = await upstream.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.forEach(handleLine);
        }
        handleLine(buffer);
        if (!produced) {
          send({ type: "error", message: "Ollama returned an empty response. Please try again." });
        }
      } catch (error) {
        const timedOut = error instanceof Error && error.name === "TimeoutError";
        send({
          type: "error",
          message: timedOut
            ? "The local model took too long to respond. Please try again."
            : "The connection to Ollama was interrupted. Please try again.",
        });
      } finally {
        controller.close();
      }
    },
    cancel() {
      upstream.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

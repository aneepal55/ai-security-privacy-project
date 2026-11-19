import { NextRequest, NextResponse } from "next/server";

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

  try {
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!ollamaResponse.ok) {
      const details = await ollamaResponse.text();
      return NextResponse.json(
        {
          message: ollamaResponse.status === 404
            ? `Ollama could not find the ${model} model. Run “ollama pull ${model}” in Terminal.`
            : `Ollama returned an error: ${details || ollamaResponse.statusText}`,
        },
        { status: 502 },
      );
    }

    const result = await ollamaResponse.json();
    const answer = result?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return NextResponse.json(
        { message: "Ollama returned an empty response. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ message: answer.trim() });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      {
        message: timedOut
          ? "The local model took too long to respond. Please try again."
          : "Could not connect to Ollama at http://127.0.0.1:11434. Make sure Ollama is running, then try again.",
      },
      { status: 503 },
    );
  }
}

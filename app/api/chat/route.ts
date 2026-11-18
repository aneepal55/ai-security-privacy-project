import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: NextRequest) {
  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON in the request body." },
      { status: 400 },
    );
  }

  const messages = body.messages as ChatMessage[] | undefined;

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

  return NextResponse.json({
    message: `I'm ready to help with "${content}". A RAG retrieval service can be connected here to ground answers in your documents.`,
  });
}

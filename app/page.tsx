"use client";

import { FormEvent, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;

    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!response.ok) throw new Error("Unable to reach the chat service.");

      const data = await response.json();
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.message },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Sorry, something went wrong.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Chat">
        <header className="chat-header">
          <div>
            <p className="eyebrow">AI Assistant</p>
            <h1>Security &amp; Privacy</h1>
          </div>
          <span className="status"><span /> Online</span>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="assistant-avatar">AI</div>
              <h2>How can I help you today?</h2>
              <p>Ask a question or start a conversation.</p>
              <div className="suggestions">
                {["Explain data privacy", "How does RAG work?", "Review security basics"].map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInput(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                className={`message ${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.role === "assistant" && (
                  <div className="message-avatar">AI</div>
                )}
                <div className="message-bubble">{message.content}</div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="message assistant">
              <div className="message-avatar">AI</div>
              <div className="message-bubble typing" aria-label="Thinking">
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <label className="sr-only" htmlFor="chat-message">
            Message
          </label>
          <input
            id="chat-message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask me anything..."
            autoComplete="off"
            disabled={isLoading}
          />
          <button type="submit" disabled={!input.trim() || isLoading}>
            <span className="sr-only">Send message</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12l16-8-6.5 16-2.2-6.3L4 12zm7.3 1.7L14 17l3.2-8.4L7.8 12l3.5 1.7z" />
            </svg>
          </button>
        </form>
      </section>
    </main>
  );
}

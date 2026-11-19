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
  const [model, setModel] = useState("llama3.2");

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
        body: JSON.stringify({ messages: nextMessages, model }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Unable to reach the chat service.");
      }
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
      <aside className="side-rail" aria-label="Assistant information">
        <a className="brand" href="#chat" aria-label="Care Compass home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32"><path d="M16 3.5 27 8v7.1c0 6.4-4.6 11.2-11 13.4C9.6 26.3 5 21.5 5 15.1V8l11-4.5Z" /><path d="m11.5 16 3 3 6-6.5" /></svg>
          </span>
          <span className="brand-name">CARE<span> / </span>COMPASS</span>
        </a>

        <div className="rail-copy">
          <p className="rail-label">HEALTH ASSISTANT</p>
          <div className="workspace-card">
            <span className="workspace-icon">✚</span>
            <span><strong>Health &amp; Wellness</strong><small>Personal health guide</small></span>
            <span className="workspace-arrow" aria-hidden="true">⌄</span>
          </div>
          <div className="rail-divider" />
          <p className="rail-label">A HELPFUL PLACE TO START</p>
          <div className="privacy-note">
            <span className="privacy-icon" aria-hidden="true">♡</span>
            <p><strong>Care starts with a conversation</strong><br />Get clear, supportive general health information.</p>
          </div>
        </div>

        <div className="rail-footer">
          <span className="runtime-dot" />
          <span>Local AI runtime</span>
          <span className="runtime-status">READY</span>
        </div>
      </aside>

      <section className="chat-panel" id="chat" aria-label="Chat">
        <header className="chat-header">
          <div className="header-title">
            <p className="eyebrow"><span className="eyebrow-dot" /> YOUR HEALTH COMPANION</p>
            <h1>Health <span>&amp;</span> Wellness</h1>
          </div>
          <label className="model-picker">
            <span className="model-label">MODEL</span>
            <span className="model-select-wrap">
              <span className="model-spark" aria-hidden="true">✳</span>
              <select
                aria-label="Choose local model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                disabled={isLoading}
              >
                <option value="llama3.2">Llama 3.2</option>
                <option value="mistral">Mistral</option>
              </select>
              <span className="select-chevron" aria-hidden="true">⌄</span>
            </span>
          </label>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="welcome-kicker"><span /> HERE FOR YOUR WELLBEING</div>
              <div className="welcome-icon" aria-hidden="true">
                <svg viewBox="0 0 72 72"><path d="M36 61S10 45 10 27c0-9 6-15 15-15 5 0 9 3 11 8 3-5 7-8 12-8 9 0 15 6 15 15 0 18-27 34-27 34Z" /><path d="M20 36h10l5-10 7 21 5-11h6" /></svg>
              </div>
              <h2>How can we help<br /><span>you feel your best?</span></h2>
              <p>Explore everyday health questions and wellness topics<br className="desktop-break" /> with clear, supportive information.</p>
              <div className="suggestions">
                {[
                  { title: "Understand a symptom", detail: "Learn what may be worth discussing", icon: "♡" },
                  { title: "Everyday wellness", detail: "Explore sleep, nutrition, and habits", icon: "☼" },
                  { title: "Prepare for a visit", detail: "Organize questions for your clinician", icon: "＋" },
                ].map(({ title, detail, icon }) => (
                    <button
                      className="suggestion-card"
                      key={title}
                      type="button"
                      onClick={() => setInput(title)}
                    >
                      <span className="suggestion-icon" aria-hidden="true">{icon}</span>
                      <span className="suggestion-copy"><strong>{title}</strong><small>{detail}</small></span>
                      <span className="suggestion-arrow" aria-hidden="true">↗</span>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                className={`message ${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.role === "assistant" && (
                  <div className="message-avatar" aria-hidden="true">✳</div>
                )}
                <div className="message-bubble">{message.content}</div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="message assistant">
              <div className="message-avatar" aria-hidden="true">✳</div>
              <div className="message-bubble typing" aria-label="Thinking">
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>

        <footer className="composer-area">
          <form className="composer" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="chat-message">Message</label>
            <input
              id="chat-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a health or wellness question..."
              autoComplete="off"
              disabled={isLoading}
            />
            <button type="submit" disabled={!input.trim() || isLoading}>
              <span className="sr-only">Send message</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.6 22 12 3.4 3.4 3 10l13 2-13 2 .4 6.6Z" /></svg>
            </button>
          </form>
          <p className="composer-hint"><span>♡</span> General health information <i /> Powered by {model === "llama3.2" ? "Llama 3.2" : "Mistral"} on your device</p>
          <p className="medical-note">Not for emergencies or a substitute for care from a qualified health professional.</p>
        </footer>
      </section>
    </main>
  );
}

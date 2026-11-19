"use client";

import { FormEvent, useRef, useState } from "react";

type Mode = "text" | "pdf";

export default function KnowledgeBasePanel() {
  const [mode, setMode] = useState<Mode>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function addDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setStatus("Please enter a document title.");
      setError(true);
      return;
    }

    if (mode === "text" && !content.trim()) {
      setStatus("Please paste some document content.");
      setError(true);
      return;
    }

    if (mode === "pdf" && !file) {
      setStatus("Please select a PDF file.");
      setError(true);
      return;
    }

    setIsSaving(true);
    setStatus("Processing your document and generating embeddings...");
    setError(false);

    try {
      let response: Response;

      if (mode === "text") {
        response = await fetch("/api/knowledge-base", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), content }),
        });
      } else {
        const formData = new FormData();
        formData.append("title", title.trim());
        formData.append("file", file!);

        response = await fetch("/api/knowledge-base", {
          method: "POST",
          body: formData,
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message ?? "Unable to add the document.");
      }

      setStatus(
        `${result.message} ${result.chunks} text chunks were indexed.`,
      );
      setError(false);
      setTitle("");
      setContent("");
      setFile(null);

      if (fileInput.current) {
        fileInput.current.value = "";
      }
    } catch (err) {
      setStatus(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="knowledge-panel" aria-label="Knowledge Base">
      <header className="knowledge-header">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-dot" /> YOUR REFERENCE LIBRARY
          </p>
          <h1>Knowledge <span>Base</span></h1>
          <p className="knowledge-intro">
            Add trusted information that Care Compass can reference when
            answering questions.
          </p>
        </div>
        <div className="knowledge-icon" aria-hidden="true">▤</div>
      </header>

      <div className="knowledge-content">
        <div className="knowledge-card">
          <div className="knowledge-card-heading">
            <div>
              <h2>Add a document</h2>
              <p>Choose how you want to add information to your library.</p>
            </div>
            <span className="knowledge-step">01 / ADD</span>
          </div>

          <div className="knowledge-tabs" role="tablist" aria-label="Document type">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "text"}
              className={mode === "text" ? "knowledge-tab active" : "knowledge-tab"}
              onClick={() => {
                setMode("text");
                setStatus("");
              }}
            >
              <span aria-hidden="true">✎</span> Paste text
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "pdf"}
              className={mode === "pdf" ? "knowledge-tab active" : "knowledge-tab"}
              onClick={() => {
                setMode("pdf");
                setStatus("");
              }}
            >
              <span aria-hidden="true">▧</span> Upload PDF
            </button>
          </div>

          <form className="knowledge-form" onSubmit={addDocument}>
            <label htmlFor="document-title">Document title</label>
            <input
              id="document-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Healthcare AI Security Policy"
              maxLength={150}
              disabled={isSaving}
            />

            {mode === "text" ? (
              <>
                <label htmlFor="document-content">Document content</label>
                <textarea
                  id="document-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Paste your notes, articles, policies, research, or other reference material here..."
                  rows={12}
                  maxLength={1_000_000}
                  disabled={isSaving}
                />
                <p className="knowledge-field-hint">
                  Up to 1 million characters. Your text will be split into
                  searchable sections automatically.
                </p>
              </>
            ) : (
              <>
                <label htmlFor="document-file">Select a PDF document</label>
                <button
                  type="button"
                  className="knowledge-upload"
                  onClick={() => fileInput.current?.click()}
                  disabled={isSaving}
                >
                  <span className="upload-symbol" aria-hidden="true">↑</span>
                  <strong>{file ? file.name : "Choose a PDF file"}</strong>
                  <span>
                    {file
                      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                      : "PDF format · Maximum size 10 MB"}
                  </span>
                </button>
                <input
                  ref={fileInput}
                  id="document-file"
                  type="file"
                  accept=".pdf,application/pdf"
                  className="sr-only"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  disabled={isSaving}
                />
                <p className="knowledge-field-hint">
                  Text-based PDFs are supported. Scanned PDFs may require OCR.
                </p>
              </>
            )}

            {status && (
              <div
                className={`knowledge-status ${error ? "error" : "success"}`}
                role="status"
              >
                {isSaving && <span className="status-spinner" />}
                {status}
              </div>
            )}

            <button
              type="submit"
              className="knowledge-submit"
              disabled={isSaving}
            >
              {isSaving ? "Adding to knowledge base..." : "Add to knowledge base"}
              {!isSaving && <span aria-hidden="true">→</span>}
            </button>
          </form>
        </div>

        <aside className="knowledge-info">
          <div className="knowledge-info-icon" aria-hidden="true">✳</div>
          <div>
            <h3>How document indexing works</h3>
            <p>
              When you add a document, Care Compass extracts its text,
              divides it into smaller sections, and generates embeddings
              using your local Ollama model.
            </p>
            <p>
              Those sections are stored in Supabase and become available
              to the chatbot through semantic search.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

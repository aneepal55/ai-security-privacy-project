const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "nomic-embed-text";

export async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) {
    throw new Error(
      `Embedding request failed (${res.status}). Did you run "ollama pull ${EMBEDDING_MODEL}"? ${await res.text()}`,
    );
  }
  const data = await res.json();
  return data.embeddings as number[][];
}

import { embed } from "./embeddings";
import { getSupabase } from "./supabase";

export type RetrievedChunk = {
  id: number;
  source: string;
  content: string;
  similarity: number;
};

export async function retrieveContext(query: string, count = 5): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await embed([query]);
  const { data, error } = await getSupabase().rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: count,
    min_similarity: 0.3,
  });
  if (error) throw new Error(`Supabase retrieval failed: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}

export function buildSystemPrompt(chunks: RetrievedChunk[]): string {
  const context = chunks
    .map((c, i) => `[${i + 1}] (source: ${c.source})\n${c.content}`)
    .join("\n\n");
  return [
    "Use the context below to answer the user's question when it is relevant.",
    "If the context does not contain the answer, say so and answer from general knowledge with appropriate caution.",
    "Cite sources like [1] when you use them.",
    "",
    "Context:",
    context,
  ].join("\n");
}

import { extractText, getDocumentProxy } from "unpdf";
import { embed } from "./embeddings";
import { getSupabase } from "./supabase";

const CHUNK_SIZE = 900;
const OVERLAP = 150;
const BATCH_SIZE = 16;

function splitLong(paragraph: string): string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  const parts: string[] = [];
  let current = "";

  const push = () => {
    if (current) parts.push(current);
    current = "";
  };

  for (const sentence of sentences) {
    if (sentence.length > CHUNK_SIZE) {
      push();
      for (let i = 0; i < sentence.length; i += CHUNK_SIZE - OVERLAP) {
        parts.push(sentence.slice(i, i + CHUNK_SIZE));
      }
    } else if (current && current.length + sentence.length + 1 > CHUNK_SIZE) {
      push();
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }

  push();
  return parts;
}

function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) =>
      paragraph.length > CHUNK_SIZE ? splitLong(paragraph) : [paragraph],
    );

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > CHUNK_SIZE) {
      chunks.push(current);
      current = current.slice(-OVERLAP) + "\n\n" + paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });

  return text
    .replace(/\n{2,}/g, "\u0001")
    .replace(/\n/g, " ")
    .replace(/\u0001/g, "\n\n")
    .replace(/\u0000/g, "")
    .trim();
}

export async function ingestDocument({
  source,
  title,
  content,
  kind,
  originalFilename,
}: {
  source: string;
  title: string;
  content: string;
  kind: "text" | "pdf";
  originalFilename?: string;
}): Promise<number> {
  const cleanContent = content.replace(/\u0000/g, "").trim();

  if (!cleanContent) {
    throw new Error("The document does not contain any readable text.");
  }

  const chunks = chunkText(cleanContent);

  if (chunks.length === 0) {
    throw new Error("No text chunks could be created from this document.");
  }

  const supabase = getSupabase();

  // Replace any previous version of this document.
  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("source", source);

  if (deleteError) {
    throw new Error(`Could not replace the previous document: ${deleteError.message}`);
  }

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await embed(batch);

    if (embeddings.length !== batch.length) {
      throw new Error("The embedding service returned an unexpected number of embeddings.");
    }

    const rows = batch.map((chunk, index) => ({
      source,
      chunk_index: i + index,
      content: chunk,
      embedding: embeddings[index],
      metadata: {
        title,
        kind,
        original_filename: originalFilename ?? null,
      },
    }));

    const { error } = await supabase.from("documents").insert(rows);

    if (error) {
      // Avoid leaving a partially indexed document behind.
      await supabase.from("documents").delete().eq("source", source);
      throw new Error(`Could not save document chunks: ${error.message}`);
    }
  }

  return chunks.length;
}

// Usage: npm run ingest            (reads everything in ./docs: .md, .txt, .pdf)
//        npm run ingest -- path/to/folder
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { embed } from "../lib/embeddings";
import { getSupabase } from "../lib/supabase";

const CHUNK_SIZE = 900;
const OVERLAP = 150;
const BATCH = 16;

// Split an oversized paragraph on sentence boundaries (and hard-slice as a last resort).
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
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => (p.length > CHUNK_SIZE ? splitLong(p) : [p]));
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && current.length + p.length + 2 > CHUNK_SIZE) {
      chunks.push(current);
      current = current.slice(-OVERLAP) + "\n\n" + p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function readPdf(file: string): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(file)));
  const { text } = await extractText(pdf, { mergePages: true });
  // PDFs hard-wrap lines: keep blank-line paragraph breaks, join the rest.
  return text.replace(/\n{2,}/g, "\u0001").replace(/\n/g, " ").replace(/\u0001/g, "\n\n");
}

async function readDocument(file: string): Promise<string> {
  const raw = /\.pdf$/i.test(file) ? await readPdf(file) : await readFile(file, "utf8");
  return raw.replace(/\u0000/g, ""); // Postgres text columns reject NUL characters
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : [full];
    }),
  );
  return files.flat().filter((f) => /\.(md|txt|pdf)$/i.test(f));
}

async function main() {
  const dir = process.argv[2] ?? "docs";
  const files = await walk(dir);
  if (files.length === 0) {
    console.log(`No .md, .txt or .pdf files found in ${dir}`);
    return;
  }
  const supabase = getSupabase();

  for (const file of files) {
    const source = path.relative(dir, file);
    const chunks = chunkText(await readDocument(file));
    if (chunks.length === 0) {
      console.log(`${source}: no extractable text (scanned PDF?), skipped`);
      continue;
    }
    console.log(`${source}: ${chunks.length} chunks`);

    // Re-ingesting a file replaces its old chunks.
    const { error: deleteError } = await supabase.from("documents").delete().eq("source", source);
    if (deleteError) throw new Error(deleteError.message);

    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const embeddings = await embed(batch);
      const rows = batch.map((content, j) => ({
        source,
        chunk_index: i + j,
        content,
        embedding: embeddings[j],
      }));
      const { error } = await supabase.from("documents").insert(rows);
      if (error) throw new Error(error.message);
    }
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

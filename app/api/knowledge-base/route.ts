import { NextRequest, NextResponse } from "next/server";
import { extractPdfText, ingestDocument } from "@/lib/document-ingestion";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 1_000_000;

function makeSource(title: string, kind: "text" | "pdf") {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);

  return `manual/${slug || "untitled"}-${kind}`;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    let title = "";
    let content = "";
    let kind: "text" | "pdf" = "text";
    let originalFilename: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const titleValue = formData.get("title");
      const file = formData.get("file");

      title = typeof titleValue === "string" ? titleValue.trim() : "";

      if (!(file instanceof File)) {
        return NextResponse.json(
          { message: "Please select a PDF file to upload." },
          { status: 400 },
        );
      }

      if (file.size === 0 || file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { message: "The PDF must be non-empty and no larger than 10 MB." },
          { status: 400 },
        );
      }

      if (
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
      ) {
        return NextResponse.json(
          { message: "Only PDF documents are supported right now." },
          { status: 400 },
        );
      }

      kind = "pdf";
      originalFilename = file.name;
      content = await extractPdfText(await file.arrayBuffer());
      title = title || file.name.replace(/\.pdf$/i, "");
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      title = typeof body.title === "string" ? body.title.trim() : "";
      content = typeof body.content === "string" ? body.content : "";

      if (content.length > MAX_TEXT_LENGTH) {
        return NextResponse.json(
          { message: "Pasted text must be no longer than 1,000,000 characters." },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { message: "Send pasted text as JSON or upload a PDF as form data." },
        { status: 415 },
      );
    }

    if (!title) {
      return NextResponse.json(
        { message: "Please provide a document title." },
        { status: 400 },
      );
    }

    if (!content.trim()) {
      return NextResponse.json(
        { message: "No readable text was found in the document." },
        { status: 400 },
      );
    }

    const source = makeSource(title, kind);
    const chunks = await ingestDocument({
      source,
      title,
      content,
      kind,
      originalFilename,
    });

    return NextResponse.json({
      message: "Document successfully added to the knowledge base.",
      source,
      title,
      chunks,
    });
  } catch (error) {
    console.error("Knowledge Base ingestion failed:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong while adding the document.",
      },
      { status: 500 },
    );
  }
}

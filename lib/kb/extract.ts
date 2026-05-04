import { PDFParse } from "pdf-parse";
import { extractRawText as mammothExtract } from "mammoth";

const PLAIN_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);
const PDF_MIMES = new Set(["application/pdf"]);
const DOCX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type SupportedMime =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "text/plain"
  | "text/markdown"
  | "text/x-markdown";

export function isSupportedMime(mime: string): boolean {
  return PDF_MIMES.has(mime) || DOCX_MIMES.has(mime) || PLAIN_MIMES.has(mime);
}

export function extensionFromFilename(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/**
 * Best-effort mime resolver. Browsers sometimes upload `.md` as
 * `application/octet-stream`; fall back to filename extension.
 */
export function resolveMime(mime: string, filename: string): string {
  if (isSupportedMime(mime)) return mime;
  const ext = extensionFromFilename(filename);
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === "md") return "text/markdown";
  if (ext === "txt") return "text/plain";
  return mime;
}

/**
 * Extract plain text from a binary buffer based on its mime. Returns the
 * full document text (no chunking). Throws on unsupported mime.
 */
export async function extractText(
  buf: Buffer,
  mime: string,
  filename: string,
): Promise<string> {
  const resolved = resolveMime(mime, filename);

  if (PDF_MIMES.has(resolved)) {
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    try {
      const { text } = await parser.getText();
      return normalize(text);
    } finally {
      await parser.destroy();
    }
  }

  if (DOCX_MIMES.has(resolved)) {
    const { value } = await mammothExtract({ buffer: buf });
    return normalize(value);
  }

  if (PLAIN_MIMES.has(resolved)) {
    return normalize(buf.toString("utf-8"));
  }

  throw new Error(`Unsupported mime: ${mime}`);
}

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ") // non-breaking spaces
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

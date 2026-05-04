import { get_encoding } from "tiktoken";

export interface Chunk {
  text: string;
  tokenCount: number;
}

interface ChunkOptions {
  size?: number; // target tokens per chunk
  overlap?: number; // overlap tokens between chunks
}

/**
 * Token-aware chunker using tiktoken's cl100k_base encoder. Gemini's tokenizer
 * isn't byte-identical to OpenAI's, but cl100k is close enough for budgeting
 * chunk sizes (we're staying well under any per-chunk model limit anyway).
 *
 * Strategy: encode whole text → slide a window of `size` tokens with
 * `overlap` tokens shared between consecutive windows → decode each window
 * back to text. This preserves coherence across paragraph breaks better than
 * a naïve word-count splitter.
 */
export function chunk(text: string, opts: ChunkOptions = {}): Chunk[] {
  const size = Math.max(64, opts.size ?? 500);
  const overlap = Math.max(0, Math.min(size - 1, opts.overlap ?? 50));
  const trimmed = text.trim();
  if (!trimmed) return [];

  const enc = get_encoding("cl100k_base");
  try {
    const tokens = enc.encode(trimmed);
    if (tokens.length <= size) {
      const decoded = textOf(enc, tokens);
      return [{ text: decoded, tokenCount: tokens.length }];
    }

    const out: Chunk[] = [];
    const step = size - overlap;
    for (let start = 0; start < tokens.length; start += step) {
      const slice = tokens.slice(start, start + size);
      if (slice.length === 0) break;
      out.push({
        text: textOf(enc, slice).trim(),
        tokenCount: slice.length,
      });
      if (start + size >= tokens.length) break;
    }
    return out.filter((c) => c.text.length > 0);
  } finally {
    enc.free();
  }
}

function textOf(
  enc: { decode: (tokens: Uint32Array) => Uint8Array },
  tokens: Uint32Array,
): string {
  const bytes = enc.decode(tokens);
  return new TextDecoder("utf-8").decode(bytes);
}

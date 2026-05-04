/**
 * Gemini embeddings via the public REST API.
 *
 * Model: gemini-embedding-001 with outputDimensionality=768. The KB schema's
 * vector(768) column is pinned to this size; if you change the dim you must
 * run a migration. (text-embedding-004 was retired on v1beta.)
 *
 * Batch size: Gemini's batchEmbedContents accepts up to 100 requests per
 * call. We respect that cap and chunk accordingly.
 *
 * Retries: 3 attempts with 500ms / 2s / 8s backoff on 429 / 5xx. Other
 * errors fail fast.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const BATCH_LIMIT = 100;
const OUTPUT_DIM = 768;

export interface EmbedOptions {
  taskType?:
    | "RETRIEVAL_DOCUMENT"
    | "RETRIEVAL_QUERY"
    | "SEMANTIC_SIMILARITY";
}

function modelId(): string {
  return process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

async function postWithRetry(
  url: string,
  body: unknown,
  attempt = 1,
): Promise<Response> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return res;
  const transient = res.status === 429 || res.status >= 500;
  if (!transient || attempt >= 3) return res;
  const delay = attempt === 1 ? 500 : attempt === 2 ? 2000 : 8000;
  await new Promise((r) => setTimeout(r, delay));
  return postWithRetry(url, body, attempt + 1);
}

/**
 * Embed up to BATCH_LIMIT texts in one Gemini call.
 */
async function embedBatchInner(
  texts: string[],
  taskType: EmbedOptions["taskType"],
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length > BATCH_LIMIT) {
    throw new Error(`embedBatchInner called with > ${BATCH_LIMIT} texts`);
  }
  const model = modelId();
  const url = `${ENDPOINT}/models/${model}:batchEmbedContents?key=${apiKey()}`;
  const requests = texts.map((text) => ({
    model: `models/${model}`,
    content: { parts: [{ text }] },
    outputDimensionality: OUTPUT_DIM,
    ...(taskType ? { taskType } : {}),
  }));

  const res = await postWithRetry(url, { requests });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Gemini embed failed (${res.status}): ${errText.slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as {
    embeddings?: Array<{ values: number[] }>;
  };
  if (!json.embeddings) {
    throw new Error("Gemini embed: no embeddings in response");
  }
  return json.embeddings.map((e) => e.values);
}

/**
 * Embed an arbitrary number of texts. Splits into batches of BATCH_LIMIT
 * under the hood and concatenates the results. Order is preserved.
 */
export async function embedBatch(
  texts: string[],
  opts: EmbedOptions = {},
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const slice = texts.slice(i, i + BATCH_LIMIT);
    const vectors = await embedBatchInner(slice, opts.taskType);
    out.push(...vectors);
  }
  return out;
}

/**
 * Single-text helper. Used at retrieval time for queries.
 */
export async function embedOne(
  text: string,
  opts: EmbedOptions = {},
): Promise<number[]> {
  const [vec] = await embedBatch([text], opts);
  return vec;
}

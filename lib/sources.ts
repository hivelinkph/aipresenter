/**
 * Demo source-type model.
 *
 * A demo can pull from multiple kinds of source material — websites, apps,
 * uploaded PDFs/pictures/PowerPoint, or a Google Slides URL. Each enabled
 * type contributes its own configuration block to `demos.sources` (jsonb).
 *
 * Today only `websites` and `apps` are wired to the live runtime; the other
 * types persist their config and will activate when their runtimes ship.
 */

export const SOURCE_TYPES = [
  "pdfs",
  "pictures",
  "googleSlides",
  "powerPoint",
  "websites",
  "apps",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_LABELS: Record<SourceType, string> = {
  pdfs: "PDFs",
  pictures: "Pictures",
  googleSlides: "Google Slides",
  powerPoint: "PowerPoint",
  websites: "Websites",
  apps: "Apps",
};

export const SOURCE_ORDER: SourceType[] = [
  "websites",
  "apps",
  "googleSlides",
  "pdfs",
  "pictures",
  "powerPoint",
];

export interface SourceFile {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: string;
}

export interface SourceUrlConfig {
  url: string;
}

export interface SourceFileBucket {
  files: SourceFile[];
}

export interface PdfSourceBucket extends SourceFileBucket {
  /** When true, the AI calls next_page to advance after finishing each page. */
  autoAdvance?: boolean;
  /**
   * Per-page narration scripts. Index 0 = page 1, index 1 = page 2, etc.
   * When present, the AI reads the script verbatim instead of freestyle-narrating.
   * Empty strings mean "freestyle this page from the page text."
   */
  pageNarrations?: string[];
  /** Human presenter name shown in the Q&A transition. */
  presenterName?: string;
  /** Q&A transition text spoken after the last page. Uses {presenterName} placeholder. */
  qaTransition?: string;
}

export interface DemoSources {
  websites?: { url?: string; roleNames?: string[] };
  apps?: { url?: string; roleNames?: string[] };
  googleSlides?: SourceUrlConfig;
  pdfs?: PdfSourceBucket;
  pictures?: SourceFileBucket;
  powerPoint?: SourceFileBucket;
}

export const FILE_SOURCE_TYPES: SourceType[] = [
  "pdfs",
  "pictures",
  "powerPoint",
];

export const URL_SOURCE_TYPES: SourceType[] = ["googleSlides"];

/** Source types that the live runtime can drive today. */
export const LIVE_RUNTIME_SOURCES: SourceType[] = ["websites", "apps"];

export function isLiveSourceEnabled(types: SourceType[]): boolean {
  return types.some((t) => LIVE_RUNTIME_SOURCES.includes(t));
}

/**
 * MIME accept strings + size limits per file source type.
 * (Limit also enforced server-side in the upload route.)
 */
export const FILE_SOURCE_RULES: Record<
  Extract<SourceType, "pdfs" | "pictures" | "powerPoint">,
  { accept: string; maxMB: number; mimes: string[] }
> = {
  pdfs: {
    accept: "application/pdf,.pdf",
    maxMB: 50,
    mimes: ["application/pdf"],
  },
  pictures: {
    accept: "image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif",
    maxMB: 25,
    mimes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  },
  powerPoint: {
    accept:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx",
    maxMB: 100,
    mimes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  },
};

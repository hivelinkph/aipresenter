declare module "mammoth" {
  interface ExtractRawTextOptions {
    buffer?: Buffer;
    path?: string;
  }
  interface ExtractRawTextResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  export function extractRawText(
    options: ExtractRawTextOptions,
  ): Promise<ExtractRawTextResult>;
}

const DOC = 'application/vnd.google-apps.document';
const SHEET = 'application/vnd.google-apps.spreadsheet';
const SLIDES = 'application/vnd.google-apps.presentation';

export const GOOGLE_NATIVE_MIME_TYPES: ReadonlySet<string> = new Set([DOC, SHEET, SLIDES]);

const DEFAULT_EXPORT_MIME: Readonly<Record<string, string>> = Object.freeze({
  [DOC]: 'text/markdown',
  [SHEET]: 'text/csv',
  [SLIDES]: 'text/plain',
});

export function isGoogleNative(mimeType: string): boolean {
  return GOOGLE_NATIVE_MIME_TYPES.has(mimeType);
}

export function defaultExportMime(sourceMime: string): string | undefined {
  return DEFAULT_EXPORT_MIME[sourceMime];
}

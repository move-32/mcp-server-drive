import { describe, it, expect } from 'vitest';
import { GOOGLE_NATIVE_MIME_TYPES, defaultExportMime, isGoogleNative } from '../src/export-mime.js';

describe('isGoogleNative', () => {
  it.each([
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
  ])('recognises %s as a Google native type', (mime) => {
    expect(isGoogleNative(mime)).toBe(true);
  });

  it.each(['application/pdf', 'text/plain', 'application/vnd.google-apps.folder', ''])(
    'rejects non-document type %s',
    (mime) => {
      expect(isGoogleNative(mime)).toBe(false);
    },
  );
});

describe('defaultExportMime', () => {
  it('maps Docs to text/markdown', () => {
    expect(defaultExportMime('application/vnd.google-apps.document')).toBe('text/markdown');
  });

  it('maps Sheets to text/csv', () => {
    expect(defaultExportMime('application/vnd.google-apps.spreadsheet')).toBe('text/csv');
  });

  it('maps Slides to text/plain', () => {
    expect(defaultExportMime('application/vnd.google-apps.presentation')).toBe('text/plain');
  });

  it('returns undefined for unknown types so the caller can fall back to alt=media', () => {
    expect(defaultExportMime('application/pdf')).toBeUndefined();
    expect(defaultExportMime('')).toBeUndefined();
  });
});

describe('GOOGLE_NATIVE_MIME_TYPES', () => {
  it('covers exactly the three Workspace native document types', () => {
    expect(GOOGLE_NATIVE_MIME_TYPES.size).toBe(3);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { readFileContent } from '../src/tools/read-file-content.js';
import type { Drive } from '../src/drive-client.js';

interface DriveHarness {
  drive: Drive;
  get: ReturnType<typeof vi.fn>;
  exportFn: ReturnType<typeof vi.fn>;
}

function makeDrive(sourceMime: string, body: string): DriveHarness {
  const get = vi.fn().mockImplementation(async (params: { alt?: string }) => {
    if (params.alt === 'media') {
      return { data: body };
    }
    return { data: { mimeType: sourceMime } };
  });
  const exportFn = vi.fn().mockResolvedValue({ data: body });
  return {
    drive: { files: { get, export: exportFn } } as unknown as Drive,
    get,
    exportFn,
  };
}

describe('readFileContent', () => {
  it('exports Google Docs as text/markdown by default', async () => {
    const { drive, exportFn } = makeDrive('application/vnd.google-apps.document', '# hello');

    const result = await readFileContent(drive, { file_id: 'abc' });

    expect(exportFn).toHaveBeenCalledWith(
      { fileId: 'abc', mimeType: 'text/markdown' },
      expect.objectContaining({ responseType: 'text' }),
    );
    expect(result).toEqual({
      content: '# hello',
      mime_type: 'text/markdown',
      source_mime_type: 'application/vnd.google-apps.document',
    });
  });

  it('exports Sheets as text/csv by default', async () => {
    const { drive, exportFn } = makeDrive('application/vnd.google-apps.spreadsheet', 'a,b\n1,2');

    const result = await readFileContent(drive, { file_id: 'abc' });

    expect(exportFn).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'text/csv' }),
      expect.any(Object),
    );
    expect(result.content).toBe('a,b\n1,2');
    expect(result.mime_type).toBe('text/csv');
  });

  it('exports Slides as text/plain by default', async () => {
    const { drive, exportFn } = makeDrive(
      'application/vnd.google-apps.presentation',
      'Slide 1\nSlide 2',
    );

    await readFileContent(drive, { file_id: 'abc' });

    expect(exportFn).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'text/plain' }),
      expect.any(Object),
    );
  });

  it('honors an explicit mime_type override on Google native files', async () => {
    const { drive, exportFn } = makeDrive('application/vnd.google-apps.document', 'plain version');

    await readFileContent(drive, { file_id: 'abc', mime_type: 'text/plain' });

    expect(exportFn).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'text/plain' }),
      expect.any(Object),
    );
  });

  it('falls through to alt=media for non-native files', async () => {
    const { drive, get, exportFn } = makeDrive('text/plain', 'raw bytes');

    const result = await readFileContent(drive, { file_id: 'abc' });

    expect(exportFn).not.toHaveBeenCalled();
    // The first call fetches metadata (no alt); the second fetches media.
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenLastCalledWith(
      { fileId: 'abc', alt: 'media' },
      expect.objectContaining({ responseType: 'text' }),
    );
    expect(result).toEqual({
      content: 'raw bytes',
      mime_type: 'text/plain',
      source_mime_type: 'text/plain',
    });
  });

  it('coerces Uint8Array bodies to UTF-8 strings', async () => {
    const bytes = new TextEncoder().encode('hello bytes');
    const get = vi.fn().mockImplementation(async (params: { alt?: string }) => {
      if (params.alt === 'media') return { data: bytes };
      return { data: { mimeType: 'application/octet-stream' } };
    });
    const drive = { files: { get, export: vi.fn() } } as unknown as Drive;

    const result = await readFileContent(drive, { file_id: 'abc' });

    expect(result.content).toBe('hello bytes');
  });
});

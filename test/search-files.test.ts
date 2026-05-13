import { describe, it, expect, vi } from 'vitest';
import {
  SearchFilesInputSchema,
  searchFiles,
  type SearchFilesInput,
} from '../src/tools/search-files.js';
import type { Drive } from '../src/drive-client.js';

function makeDrive(files: unknown[]) {
  const list = vi.fn().mockResolvedValue({ data: { files } });
  return { drive: { files: { list } } as unknown as Drive, list };
}

describe('searchFiles', () => {
  it('forwards query and page_size and uses the expected fields mask', async () => {
    const { drive, list } = makeDrive([
      { id: 'f1', name: 'foo.docx', mimeType: 'application/pdf' },
    ]);

    const result = await searchFiles(drive, {
      query: "name = 'foo'",
      page_size: 10,
    });

    expect(list).toHaveBeenCalledWith({
      q: "name = 'foo'",
      pageSize: 10,
      fields: 'files(id,name,mimeType,parents,modifiedTime)',
    });
    expect(result.files).toEqual([{ id: 'f1', name: 'foo.docx', mimeType: 'application/pdf' }]);
  });

  it('defaults page_size to 50 when omitted', async () => {
    const { drive, list } = makeDrive([]);

    await searchFiles(drive, { query: 'x' });

    expect(list).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 50 }));
  });

  it('returns an empty list when Drive returns no files key', async () => {
    const list = vi.fn().mockResolvedValue({ data: {} });
    const drive = { files: { list } } as unknown as Drive;

    const result = await searchFiles(drive, { query: 'x' });

    expect(result.files).toEqual([]);
  });

  it('includes parents and modifiedTime in the result only when present', async () => {
    const { drive } = makeDrive([
      {
        id: 'f1',
        name: 'with-parents',
        mimeType: 'text/plain',
        parents: ['root'],
        modifiedTime: '2025-01-02T03:04:05Z',
      },
      { id: 'f2', name: 'no-parents', mimeType: 'text/plain' },
    ]);

    const result = await searchFiles(drive, { query: 'x' });

    expect(result.files[0]).toEqual({
      id: 'f1',
      name: 'with-parents',
      mimeType: 'text/plain',
      parents: ['root'],
      modifiedTime: '2025-01-02T03:04:05Z',
    });
    const second = result.files[1];
    expect(second).toEqual({
      id: 'f2',
      name: 'no-parents',
      mimeType: 'text/plain',
    });
    expect(second && 'parents' in second).toBe(false);
    expect(second && 'modifiedTime' in second).toBe(false);
  });

  it('schema rejects an empty query', () => {
    expect(() =>
      SearchFilesInputSchema.parse({ query: '' } satisfies Partial<SearchFilesInput>),
    ).toThrow();
  });

  it('schema rejects oversize page_size', () => {
    expect(() =>
      SearchFilesInputSchema.parse({ query: 'x', page_size: 2000 } satisfies SearchFilesInput),
    ).toThrow();
  });

  it('schema rejects non-integer page_size', () => {
    expect(() => SearchFilesInputSchema.parse({ query: 'x', page_size: 1.5 })).toThrow();
  });
});

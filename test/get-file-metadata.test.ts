import { describe, it, expect, vi } from 'vitest';
import { getFileMetadata } from '../src/tools/get-file-metadata.js';
import type { Drive } from '../src/drive-client.js';

function makeDrive(data: unknown) {
  const get = vi.fn().mockResolvedValue({ data });
  return { drive: { files: { get } } as unknown as Drive, get };
}

describe('getFileMetadata', () => {
  it('requests the documented fields mask', async () => {
    const { drive, get } = makeDrive({ id: 'x', name: 'x', mimeType: 'text/plain' });

    await getFileMetadata(drive, { file_id: 'x' });

    expect(get).toHaveBeenCalledWith({
      fileId: 'x',
      fields:
        'id,name,mimeType,parents,modifiedTime,createdTime,size,' +
        'owners(displayName,emailAddress),webViewLink',
    });
  });

  it('returns the full snake-case shape when Drive supplies every field', async () => {
    const { drive } = makeDrive({
      id: 'f1',
      name: 'spec.docx',
      mimeType: 'application/vnd.google-apps.document',
      parents: ['root'],
      modifiedTime: '2025-02-01T00:00:00Z',
      createdTime: '2025-01-01T00:00:00Z',
      size: '12345',
      owners: [{ displayName: 'Alice', emailAddress: 'alice@move32.example' }],
      webViewLink: 'https://drive.google.com/file/d/f1/view',
    });

    const result = await getFileMetadata(drive, { file_id: 'f1' });

    expect(result).toEqual({
      id: 'f1',
      name: 'spec.docx',
      mime_type: 'application/vnd.google-apps.document',
      parents: ['root'],
      modified_time: '2025-02-01T00:00:00Z',
      created_time: '2025-01-01T00:00:00Z',
      size: '12345',
      owners: [{ display_name: 'Alice', email_address: 'alice@move32.example' }],
      web_view_link: 'https://drive.google.com/file/d/f1/view',
    });
  });

  it('omits optional fields when Drive does not return them', async () => {
    const { drive } = makeDrive({ id: 'f1', name: 'bare', mimeType: 'text/plain' });

    const result = await getFileMetadata(drive, { file_id: 'f1' });

    expect(result).toEqual({ id: 'f1', name: 'bare', mime_type: 'text/plain' });
    expect('parents' in result).toBe(false);
    expect('modified_time' in result).toBe(false);
    expect('owners' in result).toBe(false);
  });

  it('drops empty owners arrays rather than emitting owners: []', async () => {
    const { drive } = makeDrive({
      id: 'f1',
      name: 'lonely',
      mimeType: 'text/plain',
      owners: [],
    });

    const result = await getFileMetadata(drive, { file_id: 'f1' });

    expect('owners' in result).toBe(false);
  });

  it('handles owners with partial fields', async () => {
    const { drive } = makeDrive({
      id: 'f1',
      name: 'shared',
      mimeType: 'text/plain',
      owners: [{ emailAddress: 'bob@move32.example' }, { displayName: 'Carol' }],
    });

    const result = await getFileMetadata(drive, { file_id: 'f1' });

    expect(result.owners).toEqual([
      { email_address: 'bob@move32.example' },
      { display_name: 'Carol' },
    ]);
  });
});

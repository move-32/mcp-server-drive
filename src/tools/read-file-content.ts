import { z } from 'zod';
import type { Drive } from '../drive-client.js';
import { defaultExportMime, isGoogleNative } from '../export-mime.js';

export const ReadFileContentInputShape = {
  file_id: z.string().min(1).describe('Drive file ID.'),
  mime_type: z
    .string()
    .optional()
    .describe(
      'Export MIME type for Google native files. Defaults to text/markdown for ' +
        'Docs, text/csv for Sheets, text/plain for Slides. Ignored for non-native ' +
        'files, which are returned as raw bytes via files.get?alt=media.',
    ),
};

export const ReadFileContentInputSchema = z.object(ReadFileContentInputShape);
export type ReadFileContentInput = z.infer<typeof ReadFileContentInputSchema>;

export interface ReadFileContentResult {
  content: string;
  mime_type: string;
  source_mime_type: string;
}

export async function readFileContent(
  drive: Drive,
  input: ReadFileContentInput,
): Promise<ReadFileContentResult> {
  const meta = await drive.files.get({
    fileId: input.file_id,
    fields: 'mimeType',
  });
  const sourceMime = meta.data.mimeType ?? '';

  if (isGoogleNative(sourceMime)) {
    const exportMime = input.mime_type ?? defaultExportMime(sourceMime);
    if (!exportMime) {
      throw new Error(`No default export MIME type known for source ${sourceMime}.`);
    }
    const res = await drive.files.export(
      { fileId: input.file_id, mimeType: exportMime },
      { responseType: 'text' },
    );
    return {
      content: asString(res.data),
      mime_type: exportMime,
      source_mime_type: sourceMime,
    };
  }

  const res = await drive.files.get(
    { fileId: input.file_id, alt: 'media' },
    { responseType: 'text' },
  );
  return {
    content: asString(res.data),
    mime_type: sourceMime,
    source_mime_type: sourceMime,
  };
}

function asString(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data == null) return '';
  if (data instanceof Uint8Array) return Buffer.from(data).toString('utf8');
  return String(data);
}

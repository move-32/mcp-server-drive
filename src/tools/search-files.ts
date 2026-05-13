import { z } from 'zod';
import type { Drive } from '../drive-client.js';

export const SearchFilesInputShape = {
  query: z
    .string()
    .min(1)
    .describe(
      "Google Drive query string. Examples: \"name = 'My Doc' and " +
        "mimeType = 'application/vnd.google-apps.document' and trashed = false\". " +
        'See https://developers.google.com/drive/api/guides/search-files for syntax.',
    ),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum results to return. Defaults to 50.'),
};

export const SearchFilesInputSchema = z.object(SearchFilesInputShape);
export type SearchFilesInput = z.infer<typeof SearchFilesInputSchema>;

export interface SearchFilesResult {
  files: {
    id: string;
    name: string;
    mimeType: string;
    parents?: string[];
    modifiedTime?: string;
  }[];
}

export async function searchFiles(
  drive: Drive,
  input: SearchFilesInput,
): Promise<SearchFilesResult> {
  const res = await drive.files.list({
    q: input.query,
    pageSize: input.page_size ?? 50,
    fields: 'files(id,name,mimeType,parents,modifiedTime)',
  });
  const files = (res.data.files ?? []).map((f) => ({
    id: f.id ?? '',
    name: f.name ?? '',
    mimeType: f.mimeType ?? '',
    ...(f.parents ? { parents: f.parents } : {}),
    ...(f.modifiedTime ? { modifiedTime: f.modifiedTime } : {}),
  }));
  return { files };
}

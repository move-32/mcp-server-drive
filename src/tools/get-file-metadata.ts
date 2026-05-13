import { z } from 'zod';
import type { Drive } from '../drive-client.js';

export const GetFileMetadataInputShape = {
  file_id: z.string().min(1).describe('Drive file ID.'),
};

export const GetFileMetadataInputSchema = z.object(GetFileMetadataInputShape);
export type GetFileMetadataInput = z.infer<typeof GetFileMetadataInputSchema>;

export interface FileOwner {
  display_name?: string;
  email_address?: string;
}

export interface GetFileMetadataResult {
  id: string;
  name: string;
  mime_type: string;
  parents?: string[];
  modified_time?: string;
  created_time?: string;
  size?: string;
  owners?: FileOwner[];
  web_view_link?: string;
}

const FIELDS =
  'id,name,mimeType,parents,modifiedTime,createdTime,size,' +
  'owners(displayName,emailAddress),webViewLink';

export async function getFileMetadata(
  drive: Drive,
  input: GetFileMetadataInput,
): Promise<GetFileMetadataResult> {
  const res = await drive.files.get({
    fileId: input.file_id,
    fields: FIELDS,
  });
  const f = res.data;
  const result: GetFileMetadataResult = {
    id: f.id ?? '',
    name: f.name ?? '',
    mime_type: f.mimeType ?? '',
  };
  if (f.parents) result.parents = f.parents;
  if (f.modifiedTime) result.modified_time = f.modifiedTime;
  if (f.createdTime) result.created_time = f.createdTime;
  if (f.size) result.size = f.size;
  if (f.webViewLink) result.web_view_link = f.webViewLink;
  if (f.owners && f.owners.length > 0) {
    result.owners = f.owners.map((o) => {
      const owner: FileOwner = {};
      if (o.displayName) owner.display_name = o.displayName;
      if (o.emailAddress) owner.email_address = o.emailAddress;
      return owner;
    });
  }
  return result;
}

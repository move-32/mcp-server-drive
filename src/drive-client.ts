import { google, type drive_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export type Drive = drive_v3.Drive;

export function createDriveClient(auth: OAuth2Client): Drive {
  return google.drive({ version: 'v3', auth });
}

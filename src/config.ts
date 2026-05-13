import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const CLIENT_FILE_NAME = 'mcp-server-drive-tokens.json';

export interface Config {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly scopes: readonly string[];
  readonly tokenPath: string;
}

interface ClientCredentials {
  clientId: string;
  clientSecret: string;
}

export function loadConfig(): Config {
  const creds = resolveClientCredentials();
  return Object.freeze({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    scopes: Object.freeze([DRIVE_READONLY_SCOPE]),
    tokenPath: tokenCachePath(),
  });
}

export function resolveClientCredentials(home: string = os.homedir()): ClientCredentials {
  const filePath = path.join(home, CLIENT_FILE_NAME);
  const fromFile = readClientFile(filePath);
  if (fromFile) return fromFile;
  throw new Error(
    `OAuth client not configured. Download your Google Cloud OAuth client JSON ` +
      `and save it to ${filePath}.`,
  );
}

export function readClientFile(filePath: string): ClientCredentials | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const inner = isObject(obj.installed) ? obj.installed : isObject(obj.web) ? obj.web : obj;
  const id = (inner as Record<string, unknown>).client_id;
  const secret = (inner as Record<string, unknown>).client_secret;
  if (typeof id !== 'string' || typeof secret !== 'string' || !id || !secret) {
    return null;
  }
  return { clientId: id, clientSecret: secret };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function tokenCachePath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): string {
  if (platform === 'win32') {
    const base = env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
    return path.join(base, 'move32', 'drive', 'token.json');
  }
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'move32', 'drive', 'token.json');
  }
  const base = env.XDG_CONFIG_HOME ?? path.join(home, '.config');
  return path.join(base, 'move32', 'drive', 'token.json');
}

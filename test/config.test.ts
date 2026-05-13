import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readClientFile, resolveClientCredentials, tokenCachePath } from '../src/config.js';

describe('tokenCachePath', () => {
  // Fixture home dir.
  const HOME = '/home/test-user';

  it('uses %APPDATA% on Windows', () => {
    const result = tokenCachePath('win32', { APPDATA: 'C:\\Users\\m\\AppData\\Roaming' }, HOME);
    expect(result).toBe(
      path.join('C:\\Users\\m\\AppData\\Roaming', 'move32', 'drive', 'token.json'),
    );
  });

  it('falls back to ~/AppData/Roaming on Windows when APPDATA is unset', () => {
    const result = tokenCachePath('win32', {}, HOME);
    expect(result).toBe(path.join(HOME, 'AppData', 'Roaming', 'move32', 'drive', 'token.json'));
  });

  it('uses ~/Library/Application Support on macOS', () => {
    const result = tokenCachePath('darwin', {}, HOME);
    expect(result).toBe(
      path.join(HOME, 'Library', 'Application Support', 'move32', 'drive', 'token.json'),
    );
  });

  it('honors XDG_CONFIG_HOME on Linux', () => {
    const result = tokenCachePath('linux', { XDG_CONFIG_HOME: '/xdg' }, HOME);
    expect(result).toBe(path.join('/xdg', 'move32', 'drive', 'token.json'));
  });

  it('falls back to ~/.config on Linux without XDG_CONFIG_HOME', () => {
    const result = tokenCachePath('linux', {}, HOME);
    expect(result).toBe(path.join(HOME, '.config', 'move32', 'drive', 'token.json'));
  });
});

describe('readClientFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-drive-config-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns null when the file does not exist', () => {
    const missing = path.join(tmpDir, 'nope.json');
    expect(readClientFile(missing)).toBeNull();
  });

  it('returns null when the file is not valid JSON', async () => {
    const filePath = path.join(tmpDir, 'garbage.json');
    await fs.writeFile(filePath, 'not json', 'utf8');
    expect(readClientFile(filePath)).toBeNull();
  });

  it('parses the Desktop-app shape (installed.client_id, installed.client_secret)', async () => {
    const filePath = path.join(tmpDir, 'desktop.json');
    await fs.writeFile(
      filePath,
      JSON.stringify({
        installed: {
          client_id: 'desktop-id.apps.googleusercontent.com',
          client_secret: 'desktop-secret',
          project_id: 'foo',
          redirect_uris: ['http://localhost'],
        },
      }),
      'utf8',
    );
    expect(readClientFile(filePath)).toEqual({
      clientId: 'desktop-id.apps.googleusercontent.com',
      clientSecret: 'desktop-secret',
    });
  });

  it('parses the Web-app shape (web.client_id, web.client_secret)', async () => {
    const filePath = path.join(tmpDir, 'web.json');
    await fs.writeFile(
      filePath,
      JSON.stringify({
        web: { client_id: 'web-id', client_secret: 'web-secret' },
      }),
      'utf8',
    );
    expect(readClientFile(filePath)).toEqual({
      clientId: 'web-id',
      clientSecret: 'web-secret',
    });
  });

  it('parses a flat shape (client_id and client_secret at the top level)', async () => {
    const filePath = path.join(tmpDir, 'flat.json');
    await fs.writeFile(
      filePath,
      JSON.stringify({ client_id: 'flat-id', client_secret: 'flat-secret' }),
      'utf8',
    );
    expect(readClientFile(filePath)).toEqual({
      clientId: 'flat-id',
      clientSecret: 'flat-secret',
    });
  });

  it('returns null when client_id or client_secret is missing', async () => {
    const filePath = path.join(tmpDir, 'partial.json');
    await fs.writeFile(filePath, JSON.stringify({ installed: { client_id: 'only-id' } }), 'utf8');
    expect(readClientFile(filePath)).toBeNull();
  });

  it('returns null when client_id is the empty string', async () => {
    const filePath = path.join(tmpDir, 'empty.json');
    await fs.writeFile(
      filePath,
      JSON.stringify({ installed: { client_id: '', client_secret: 'x' } }),
      'utf8',
    );
    expect(readClientFile(filePath)).toBeNull();
  });
});

describe('resolveClientCredentials', () => {
  let tmpDir: string;
  let HOME: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-drive-resolve-test-'));
    HOME = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads ~/mcp-server-drive-tokens.json', async () => {
    await fs.writeFile(
      path.join(HOME, 'mcp-server-drive-tokens.json'),
      JSON.stringify({ installed: { client_id: 'file-id', client_secret: 'file-secret' } }),
      'utf8',
    );

    expect(resolveClientCredentials(HOME)).toEqual({
      clientId: 'file-id',
      clientSecret: 'file-secret',
    });
  });

  it('throws with a path-naming error when the file is missing', () => {
    expect(() => resolveClientCredentials(HOME)).toThrow(
      /OAuth client not configured.*mcp-server-drive-tokens\.json/,
    );
  });

  it('throws when the file exists but is malformed', async () => {
    await fs.writeFile(path.join(HOME, 'mcp-server-drive-tokens.json'), 'not even json', 'utf8');
    expect(() => resolveClientCredentials(HOME)).toThrow(/OAuth client not configured/);
  });

  it('throws when the file exists but has no client_secret', async () => {
    await fs.writeFile(
      path.join(HOME, 'mcp-server-drive-tokens.json'),
      JSON.stringify({ installed: { client_id: 'only-id' } }),
      'utf8',
    );
    expect(() => resolveClientCredentials(HOME)).toThrow(/OAuth client not configured/);
  });
});

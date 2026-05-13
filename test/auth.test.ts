import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadToken, saveToken } from '../src/auth.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-server-drive-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('loadToken', () => {
  it('returns null when the file does not exist', async () => {
    const tokenPath = path.join(tmpDir, 'missing.json');
    expect(await loadToken(tokenPath)).toBeNull();
  });

  it('returns null when the file is not valid JSON', async () => {
    const tokenPath = path.join(tmpDir, 'garbage.json');
    await fs.writeFile(tokenPath, 'not json at all', 'utf8');
    expect(await loadToken(tokenPath)).toBeNull();
  });

  it('returns parsed credentials when the file is valid JSON', async () => {
    const tokenPath = path.join(tmpDir, 'token.json');
    const creds = { access_token: 'a', refresh_token: 'r', expiry_date: 1700000000 };
    await fs.writeFile(tokenPath, JSON.stringify(creds), 'utf8');
    expect(await loadToken(tokenPath)).toEqual(creds);
  });
});

describe('saveToken', () => {
  it('writes the credentials as pretty JSON', async () => {
    const tokenPath = path.join(tmpDir, 'token.json');
    const creds = { access_token: 'a', refresh_token: 'r' };

    await saveToken(tokenPath, creds);

    const content = await fs.readFile(tokenPath, 'utf8');
    expect(JSON.parse(content)).toEqual(creds);
    expect(content).toMatch(/\n {2}"access_token"/); // pretty-printed
  });

  it('creates the parent directory if it does not exist', async () => {
    const tokenPath = path.join(tmpDir, 'deep', 'nested', 'token.json');
    await saveToken(tokenPath, { access_token: 'a' });
    const exists = await fs
      .stat(tokenPath)
      .then((s) => s.isFile())
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it('writes with mode 0o600 on POSIX systems', async () => {
    if (process.platform === 'win32') {
      return;
    }
    const tokenPath = path.join(tmpDir, 'mode.json');
    await saveToken(tokenPath, { access_token: 'a' });
    const stat = await fs.stat(tokenPath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('roundtrips through loadToken', async () => {
    const tokenPath = path.join(tmpDir, 'roundtrip.json');
    const creds = { access_token: 'a', refresh_token: 'r', scope: 'drive.readonly' };
    await saveToken(tokenPath, creds);
    expect(await loadToken(tokenPath)).toEqual(creds);
  });
});

import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { URL } from 'node:url';
import { OAuth2Client, type Credentials } from 'google-auth-library';
import type { Config } from './config.js';

export async function getAuthenticatedClient(config: Config): Promise<OAuth2Client> {
  const cached = await loadToken(config.tokenPath);
  if (cached) {
    const client = new OAuth2Client({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
    client.setCredentials(cached);
    try {
      await client.getAccessToken();
      return client;
    } catch (err) {
      logStderr(`cached token invalid (${formatError(err)}); re-running OAuth consent`);
    }
  }

  const client = await runOAuthDance(config);
  await saveToken(config.tokenPath, client.credentials);
  return client;
}

export async function loadToken(tokenPath: string): Promise<Credentials | null> {
  try {
    const content = await fs.readFile(tokenPath, 'utf8');
    return JSON.parse(content) as Credentials;
  } catch {
    return null;
  }
}

export async function saveToken(tokenPath: string, tokens: Credentials): Promise<void> {
  await fs.mkdir(path.dirname(tokenPath), { recursive: true });
  await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2), {
    mode: 0o600,
    encoding: 'utf8',
  });
}

async function runOAuthDance(config: Config): Promise<OAuth2Client> {
  return new Promise<OAuth2Client>((resolve, reject) => {
    const server = http.createServer();

    server.on('error', (err) => {
      reject(err);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Could not bind local OAuth callback server.'));
        return;
      }
      const redirectUri = `http://127.0.0.1:${addr.port}/callback`;
      const client = new OAuth2Client({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri,
      });
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: [...config.scopes],
        prompt: 'consent',
      });

      server.on('request', (req, res) => {
        void handleCallback(req, res, server, client, redirectUri, resolve, reject);
      });

      logStderr(`Open this URL in a browser to authenticate:\n  ${authUrl}`);
      openBrowser(authUrl);
    });
  });
}

async function handleCallback(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  server: http.Server,
  client: OAuth2Client,
  redirectUri: string,
  resolve: (client: OAuth2Client) => void,
  reject: (err: Error) => void,
): Promise<void> {
  if (!req.url) {
    res.writeHead(400).end();
    return;
  }
  const url = new URL(req.url, redirectUri);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }
  const oauthError = url.searchParams.get('error');
  if (oauthError) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Authentication failed: ${oauthError}`);
    server.close();
    reject(new Error(`OAuth error: ${oauthError}`));
    return;
  }
  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Missing authorization code.');
    server.close();
    reject(new Error('OAuth callback missing authorization code.'));
    return;
  }
  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(SUCCESS_HTML);
    server.close();
    resolve(client);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Token exchange failed.');
    server.close();
    reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;
  if (platform === 'win32') {
    command = `cmd /c start "" "${url}"`;
  } else if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (process.env.WSL_DISTRO_NAME) {
    // WSL reports platform 'linux' but usually has no GUI. Reach the
    // Windows-side default browser: wslview (from wslu) if installed,
    // otherwise explorer.exe via WSL interop.
    command = `wslview "${url}" 2>/dev/null || explorer.exe "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  exec(command, (err) => {
    if (err) {
      logStderr('could not auto-open browser; copy the URL above manually.');
    }
  });
}

function logStderr(message: string): void {
  process.stderr.write(`[mcp-server-drive] ${message}\n`);
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const SUCCESS_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authentication successful — mcp-server-drive</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f7f7f8;
      --card: #ffffff;
      --text: #18181b;
      --muted: #71717a;
      --border: #e4e4e7;
      --accent: #10b981;
      --accent-bg: #ecfdf5;
      --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0a0a0a;
        --card: #18181b;
        --text: #fafafa;
        --muted: #a1a1aa;
        --border: #27272a;
        --accent: #34d399;
        --accent-bg: #052e26;
      }
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter",
                   system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: grid;
      place-items: center;
      padding: 1.5rem;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 2.5rem 2rem 2rem;
      max-width: 24rem;
      width: 100%;
      text-align: center;
      box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.04),
        0 12px 32px rgba(0, 0, 0, 0.06);
    }
    .check {
      width: 56px;
      height: 56px;
      margin: 0 auto 1.25rem;
      display: grid;
      place-items: center;
      background: var(--accent-bg);
      border-radius: 50%;
    }
    .check svg {
      width: 28px;
      height: 28px;
      stroke: var(--accent);
      stroke-width: 3;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin: 0 0 0.5rem;
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 0.9375rem;
    }
    .tag {
      margin-top: 1.5rem;
      padding: 0.375rem 0.625rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-family: var(--mono);
      font-size: 0.75rem;
      color: var(--muted);
      display: inline-block;
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="check" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="presentation">
        <path d="M5 12l4 4 10-10"/>
      </svg>
    </div>
    <h1>Authentication successful</h1>
    <p>You can close this tab and return to your terminal.</p>
    <div class="tag">mcp-server-drive</div>
  </main>
</body>
</html>
`;

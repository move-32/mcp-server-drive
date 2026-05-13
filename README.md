# mcp-server-drive

A Google Drive MCP server. Runs locally as a subprocess of any MCP client (Claude Code, etc.), authenticates the user with their own Google account via OAuth, and exposes three read-only tools.


## Tools

| Tool | What it does |
|---|---|
| `search_files` | Run a Drive query string (`name = '…' and mimeType = '…' and trashed = false`). Returns id, name, mimeType, parents, modifiedTime. |
| `read_file_content` | Fetch a file's content. Google Docs auto-export to `text/markdown`, Sheets to `text/csv`, Slides to `text/plain`. Override with `mime_type`. Non-native files come back via `alt=media`. |
| `get_file_metadata` | Full Drive metadata for a file: name, mimeType, parents, modified/created time, size, owners, webViewLink. |

Scope: `https://www.googleapis.com/auth/drive.readonly`. The server never writes to Drive.

## Setup

1. **Register an OAuth client** in [Google Cloud Console](https://console.cloud.google.com):
   - Create a project (or reuse one).
   - Enable the Google Drive API.
   - APIs & Services → Credentials → Create credentials → OAuth client ID → Application type: **Desktop app**.
   - Click **Download JSON**.

2. **Save the downloaded file as `~/mcp-server-drive-tokens.json`** on every machine that will run the server. The server reads Google's JSON as-is and accepts the three shapes Google produces: `{installed: {...}}` (Desktop apps), `{web: {...}}` (Web apps), or a flat `{client_id, client_secret, ...}` blob.

> The file holds the **OAuth client credentials** (one per Cloud project, shared across users of that client). It is NOT the per-user refresh token — that's written separately after the consent flow; paths below.

## Install

```
npx -y mcp-server-drive
```

Or wire it into a plugin's `.mcp.json`:

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "npx",
      "args": ["-y", "mcp-server-drive"]
    }
  }
}
```

On first tool call, a browser tab opens for Google's consent screen. The user signs in with their personal Google account, grants read access, and the server stores the refresh token. Subsequent calls reuse the token silently. Access-token refresh is automatic.

## Development

```
npm install
npm run lint          # ESLint 9 flat config, zero warnings
npm run format:check  # Prettier
npm run typecheck     # tsc --noEmit
npm test              # Vitest unit tests
npm run test:coverage # with v8 coverage
npm run build         # emit to dist/
```

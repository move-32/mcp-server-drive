#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { getAuthenticatedClient } from './auth.js';
import { createDriveClient, type Drive } from './drive-client.js';
import { searchFiles, SearchFilesInputShape } from './tools/search-files.js';
import { readFileContent, ReadFileContentInputShape } from './tools/read-file-content.js';
import { getFileMetadata, GetFileMetadataInputShape } from './tools/get-file-metadata.js';

const PACKAGE_NAME = '@move32/mcp-server-drive';
const PACKAGE_VERSION = '0.1.0';

async function main(): Promise<void> {
  const config = loadConfig();
  const oauth = await getAuthenticatedClient(config);
  const drive = createDriveClient(oauth);

  const server = new McpServer({
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
  });

  registerTools(server, drive);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function registerTools(server: McpServer, drive: Drive): void {
  server.registerTool(
    'search_files',
    {
      description:
        'Search Google Drive files using a Drive query string. Returns id, name, ' +
        'mimeType, and (when present) parents and modifiedTime for each match.',
      inputSchema: SearchFilesInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      const result = await searchFiles(drive, input);
      return toTextResult(result);
    },
  );

  server.registerTool(
    'read_file_content',
    {
      description:
        'Read the content of a Drive file. Google native files (Docs/Sheets/Slides) ' +
        'are auto-exported to text/markdown, text/csv, and text/plain respectively. ' +
        'Other files are returned as raw bytes via files.get?alt=media.',
      inputSchema: ReadFileContentInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      const result = await readFileContent(drive, input);
      return toTextResult(result);
    },
  );

  server.registerTool(
    'get_file_metadata',
    {
      description:
        'Return Drive metadata for a file: id, name, mimeType, parents, ' +
        'modifiedTime, createdTime, size, owners, webViewLink.',
      inputSchema: GetFileMetadataInputShape,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      const result = await getFileMetadata(drive, input);
      return toTextResult(result);
    },
  );
}

function toTextResult(payload: unknown): {
  content: { type: 'text'; text: string }[];
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[mcp-server-drive] fatal: ${message}\n`);
  process.exit(1);
});

#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = (process.env.SNAPFORGE_BASE_URL || 'https://snapforge.org').replace(/\/$/, '');
const API_KEY = process.env.SNAPFORGE_API_KEY || '';

// Call a SnapForge render endpoint and return the raw bytes + content type.
async function render(endpoint, body) {
  if (!API_KEY) {
    throw new Error('Set the SNAPFORGE_API_KEY environment variable (get one at https://snapforge.org).');
  }
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { detail = await res.text().catch(() => ''); }
    throw new Error(`SnapForge ${endpoint} failed (HTTP ${res.status}): ${detail}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, contentType: res.headers.get('content-type') || 'application/octet-stream' };
}

const server = new McpServer({ name: 'snapforge', version: '1.0.0' });

const common = {
  url: z.string().url().optional().describe('Public http/https URL to render'),
  html: z.string().optional().describe('Raw HTML to render instead of a URL (max 2MB)'),
  waitUntil: z.enum(['load', 'networkidle']).optional().describe('When to consider the page ready'),
  delay: z.number().int().min(0).max(10000).optional().describe('Extra wait in ms before capture')
};

server.registerTool(
  'snapforge_screenshot',
  {
    title: 'SnapForge screenshot',
    description: 'Capture a screenshot of a public URL or raw HTML and return it as an image (PNG/JPEG).',
    inputSchema: {
      ...common,
      fullPage: z.boolean().optional().describe('Capture the full scrollable page'),
      width: z.number().int().min(100).max(3840).optional(),
      height: z.number().int().min(100).max(2160).optional(),
      scale: z.number().int().min(1).max(3).optional().describe('Device pixel ratio (high-DPI)'),
      format: z.enum(['png', 'jpeg']).optional(),
      quality: z.number().int().min(1).max(100).optional().describe('JPEG quality')
    }
  },
  async (args) => {
    try {
      const { buf, contentType } = await render('/v1/screenshot', args);
      const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
      const file = path.join(tmpdir(), `snapforge-${Date.now()}.${ext}`);
      await writeFile(file, buf);
      return {
        content: [
          { type: 'image', data: buf.toString('base64'), mimeType: contentType },
          { type: 'text', text: `Saved to ${file} (${buf.length} bytes).` }
        ]
      };
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: String(e.message || e) }] };
    }
  }
);

server.registerTool(
  'snapforge_pdf',
  {
    title: 'SnapForge PDF',
    description: 'Render a public URL or raw HTML to a PDF. The PDF is written to a temp file and its path is returned.',
    inputSchema: {
      ...common,
      singlePage: z.boolean().optional().describe('One continuous page sized to the content height (no A4 pagination)'),
      pageFormat: z.enum(['Letter', 'Legal', 'Tabloid', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6']).optional(),
      landscape: z.boolean().optional(),
      printBackground: z.boolean().optional(),
      margin: z.string().optional().describe('CSS size for all margins, e.g. "1cm"')
    }
  },
  async (args) => {
    try {
      const { buf } = await render('/v1/pdf', args);
      const file = path.join(tmpdir(), `snapforge-${Date.now()}.pdf`);
      await writeFile(file, buf);
      return { content: [{ type: 'text', text: `PDF saved to ${file} (${buf.length} bytes).` }] };
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: String(e.message || e) }] };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

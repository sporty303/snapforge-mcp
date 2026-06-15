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

const server = new McpServer({ name: 'snapforge', version: '1.2.2' });

// Annotations shared by all tools: they read remote/arbitrary web pages,
// never mutate the caller's environment, and may vary between calls.
const READ_WEB = { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true };

const common = {
  url: z.string().url().optional().describe('Public http/https URL to render. Provide either url or html.'),
  html: z.string().optional().describe('Raw HTML to render instead of a URL (max 2MB). Provide either url or html.'),
  waitUntil: z.enum(['load', 'networkidle']).optional().describe('When to consider the page ready: "load" (default) or "networkidle"'),
  delay: z.number().int().min(0).max(10000).optional().describe('Extra wait in milliseconds before capture (0–10000)')
};

server.registerTool(
  'snapforge_screenshot',
  {
    title: 'SnapForge screenshot',
    description: 'Capture a screenshot of a public URL or raw HTML and return it as an image (PNG/JPEG). Full-page by default.',
    annotations: { title: 'SnapForge screenshot', ...READ_WEB },
    inputSchema: {
      ...common,
      fullPage: z.boolean().optional().describe('Capture the full scrollable page (default true)'),
      width: z.number().int().min(100).max(3840).optional().describe('Viewport width in pixels (100–3840)'),
      height: z.number().int().min(100).max(2160).optional().describe('Viewport height in pixels (100–2160)'),
      scale: z.number().int().min(1).max(3).optional().describe('Device pixel ratio for high-DPI/retina output (1–3)'),
      format: z.enum(['png', 'jpeg']).optional().describe('Image format: "png" (default) or "jpeg"'),
      quality: z.number().int().min(1).max(100).optional().describe('JPEG quality 1–100 (ignored for PNG)')
    },
    outputSchema: {
      savedPath: z.string().describe('Absolute path to the saved image file'),
      bytes: z.number().int().describe('Size of the image in bytes'),
      mimeType: z.string().describe('Image MIME type, e.g. image/png')
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
        ],
        structuredContent: { savedPath: file, bytes: buf.length, mimeType: contentType }
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
    annotations: { title: 'SnapForge PDF', ...READ_WEB },
    inputSchema: {
      ...common,
      singlePage: z.boolean().optional().describe('Output one continuous page sized to the content height (no A4 pagination)'),
      pageFormat: z.enum(['Letter', 'Legal', 'Tabloid', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6']).optional().describe('Paper size when paginating (default A4)'),
      landscape: z.boolean().optional().describe('Landscape orientation (default false)'),
      printBackground: z.boolean().optional().describe('Include CSS background colors and images (default true)'),
      margin: z.string().optional().describe('CSS size applied to all margins, e.g. "1cm"')
    },
    outputSchema: {
      savedPath: z.string().describe('Absolute path to the saved PDF file'),
      bytes: z.number().int().describe('Size of the PDF in bytes')
    }
  },
  async (args) => {
    try {
      const { buf } = await render('/v1/pdf', args);
      const file = path.join(tmpdir(), `snapforge-${Date.now()}.pdf`);
      await writeFile(file, buf);
      return {
        content: [{ type: 'text', text: `PDF saved to ${file} (${buf.length} bytes).` }],
        structuredContent: { savedPath: file, bytes: buf.length }
      };
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: String(e.message || e) }] };
    }
  }
);

server.registerTool(
  'snapforge_markdown',
  {
    title: 'SnapForge URL to Markdown',
    description: 'Extract a clean Markdown version of a public URL or raw HTML (article extraction + HTML→Markdown). Great for feeding live web content to an LLM.',
    annotations: { title: 'SnapForge URL to Markdown', ...READ_WEB },
    inputSchema: { ...common },
    outputSchema: {
      markdown: z.string().describe('The extracted Markdown content'),
      savedPath: z.string().describe('Absolute path to the saved .md file')
    }
  },
  async (args) => {
    try {
      const { buf } = await render('/v1/markdown', args);
      const md = buf.toString('utf8');
      const file = path.join(tmpdir(), `snapforge-${Date.now()}.md`);
      await writeFile(file, buf);
      return {
        content: [
          { type: 'text', text: md },
          { type: 'text', text: `Saved to ${file}` }
        ],
        structuredContent: { markdown: md, savedPath: file }
      };
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: String(e.message || e) }] };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

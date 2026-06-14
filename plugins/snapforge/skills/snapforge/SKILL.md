---
name: snapforge
description: Capture a screenshot or render a PDF of any public URL or raw HTML using SnapForge. Use when the user wants to screenshot or preview a website, capture a page as an image, or turn a URL/HTML into a PDF.
---

# SnapForge

When the user asks to screenshot/preview a website or URL, capture HTML as an image, or render a URL/HTML to a PDF, use the SnapForge MCP tools provided by this plugin:

- **snapforge_screenshot** — PNG/JPEG of a URL or raw HTML. Options: `fullPage`, `width`, `height`, `scale`, `format` (png|jpeg), `quality`, `waitUntil` (load|networkidle), `delay`.
- **snapforge_pdf** — PDF of a URL or raw HTML. Options: `singlePage` (one tall page), `pageFormat` (A4, Letter, …), `landscape`, `printBackground`, `margin`.
- **snapforge_markdown** — clean Markdown of a URL or HTML (article extraction), great for feeding page content to an LLM.

Targets must be public http/https URLs (private/internal hosts are blocked). A SnapForge API key is required and is configured when the plugin is installed. Each render counts against the key's monthly quota.

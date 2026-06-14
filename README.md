# snapforge-mcp

MCP server for [SnapForge](https://snapforge.org) — gives AI agents two tools:

- **`snapforge_screenshot`** — capture a URL or HTML as PNG/JPEG (returned inline as an image)
- **`snapforge_pdf`** — render a URL or HTML to a PDF (saved to a temp file, path returned)

## Setup

Get a free API key at <https://snapforge.org> (POST your email to `/signup`), then:

### Claude Desktop / Claude Code

Add to your MCP config (`claude_desktop_config.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "snapforge": {
      "command": "npx",
      "args": ["-y", "snapforge-mcp"],
      "env": { "SNAPFORGE_API_KEY": "sf_your_key_here" }
    }
  }
}
```

### Any MCP client

```bash
SNAPFORGE_API_KEY=sf_your_key npx -y snapforge-mcp
```

## Environment

- `SNAPFORGE_API_KEY` (required) — your SnapForge API key
- `SNAPFORGE_BASE_URL` (optional) — defaults to `https://snapforge.org`

## Tool parameters

Both tools accept `url` **or** `html`, plus `waitUntil` (`load`|`networkidle`) and `delay` (ms).
- `snapforge_screenshot`: `fullPage`, `width`, `height`, `scale`, `format` (`png`|`jpeg`), `quality`
- `snapforge_pdf`: `pageFormat` (`A4`, `Letter`, …), `landscape`, `printBackground`, `margin`

## License

MIT

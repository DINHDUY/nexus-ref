# NEXUS REF — Developer Reference System

A production-ready, zero-dependency cheat sheet platform with a cyberpunk terminal aesthetic.
Deploy to GitHub Pages or any static host.

---

## Project Structure

```
nexus-ref/
├── index.html                        # App shell (no inline data)
├── assets/
│   ├── styles.css                    # Complete design system (CSS custom properties)
│   └── app.js                        # Application logic (vanilla JS)
├── data/
│   ├── index.json                    # Manifest: metadata only, no commands
│   ├── version-control/
│   │   └── git.json
│   ├── editor/
│   │   └── vim.json
│   ├── shell/
│   │   └── linux-bash.json
│   ├── language/
│   │   ├── python.json
│   │   ├── javascript.json
│   │   └── typescript.json
│   ├── devops/
│   │   ├── docker.json
│   │   └── kubernetes.json
│   ├── web/
│   │   ├── css.json
│   │   └── http-rest.json
│   ├── database/
│   │   └── sql.json
│   └── utilities/
│       └── regex.json
└── README.md
```

---

## Quick Start

### Local development

```bash
# Python (any version)
python -m http.server 8080

# Node.js
npx serve .

# VS Code
# Install "Live Server" extension → right-click index.html → "Open with Live Server"
```

> **Note:** The app uses `fetch()` to load JSON data, so it requires an HTTP server.
> Opening `index.html` directly as a `file://` URL will fail due to CORS restrictions.

### GitHub Pages

1. Push the entire project to a GitHub repository.
2. Go to **Settings → Pages → Source → main / root**.
3. Your site will be live at `https://<username>.github.io/<repo>/`.

---

## Adding a Cheat Sheet

### Step 1 — Create the data file

Create `data/<category-slug>/<topic-slug>.json`:

```json
{
  "id": "my-tool",
  "title": "My Tool",
  "category": "DevOps",
  "icon": "🔧",
  "accent": "#00d4ff",
  "description": "Short description for the sheet header.",
  "tags": ["mytool", "cli"],
  "sections": [
    {
      "title": "Section Title",
      "items": [
        ["command --flag", "What this command does"],
        ["another command", "Brief description"]
      ]
    }
  ]
}
```

### Step 2 — Register it in the manifest

Add an entry to `data/index.json`:

```json
{
  "id": "my-tool",
  "path": "data/devops/my-tool.json",
  "title": "My Tool",
  "category": "DevOps",
  "icon": "🔧",
  "accent": "#00d4ff",
  "description": "Short description shown in the sidebar.",
  "tags": ["mytool", "cli"]
}
```

That's it — refresh the page and the new sheet appears automatically.

---

## JSON Schema Reference

### `data/index.json` — Manifest entry

| Field         | Type     | Required | Description                                    |
|---------------|----------|----------|------------------------------------------------|
| `id`          | string   | ✓        | Unique slug (must match the JSON file's `id`)  |
| `path`        | string   | ✓        | Relative path to the sheet JSON file           |
| `title`       | string   | ✓        | Display name                                   |
| `category`    | string   | ✓        | Category for grouping in the sidebar           |
| `icon`        | string   | ✓        | Emoji icon                                     |
| `accent`      | string   | ✓        | Hex color — `#00d4ff` `#00ff9f` `#ffb700` `#ff006e` |
| `description` | string   | ✓        | Short description (shown in sidebar & header)  |
| `tags`        | string[] | ✓        | Search tags (lowercase slugs)                  |

### `data/<category>/<id>.json` — Sheet data

Inherits all manifest fields, plus:

| Field      | Type      | Required | Description               |
|------------|-----------|----------|---------------------------|
| `sections` | Section[] | ✓        | Array of command sections |

### `Section`

| Field   | Type       | Required | Description                          |
|---------|------------|----------|--------------------------------------|
| `title` | string     | ✓        | Section heading                      |
| `items` | [string, string][] | ✓ | Array of `[command, description]` pairs |

---

## Theming

The design system is fully token-based via CSS custom properties in `assets/styles.css`.

### Accent color mapping

| Hex       | Token name | Usage                                  |
|-----------|------------|----------------------------------------|
| `#00d4ff` | `--cyan`   | Default accent (Vim, Docker, TypeScript, K8s) |
| `#00ff9f` | `--green`  | Git, Bash, HTTP                        |
| `#ffb700` | `--amber`  | Python, SQL, JavaScript                |
| `#ff006e` | `--magenta`| CSS, Regex                             |

### Switching themes

Theme preference is saved to `localStorage` under the key `nexus-theme`. 
Toggle via the button in the topbar or by changing `data-theme` on `<html>`:

```js
document.documentElement.dataset.theme = 'light'; // or 'dark'
```

---

## Architecture Notes

### Data loading strategy

- **Manifest-first**: `data/index.json` is loaded on startup and contains only
  metadata (no commands). This keeps the initial load small regardless of
  how many sheets you add.
- **Lazy + cached**: Individual sheet JSON files are fetched on first selection
  and stored in a `Map`. Subsequent visits to the same sheet use the in-memory
  cache with no additional network requests.

### No build step

The app is intentionally build-tool-free. It uses:
- Vanilla ES2020+ JavaScript (supported in all modern browsers)
- CSS custom properties for theming
- `fetch()` for data loading
- Google Fonts via `@import` in the stylesheet

### File size budget

| File             | Size (approx.) |
|------------------|----------------|
| `index.html`     | ~6 KB          |
| `assets/styles.css` | ~12 KB      |
| `assets/app.js`  | ~8 KB          |
| `data/index.json` | ~2 KB         |
| Each sheet JSON  | ~2–5 KB        |

---

## Browser Support

All modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+).
Requires `fetch`, CSS custom properties, and `navigator.clipboard`.

---

## License

MIT — use, modify, and redistribute freely.

# Oxide website

Voice lab notebook for researchers — https://anasbq.github.io/Oxide.github.io/

- `index.html` — home page, drawn from `content.json`
- `page.html?p=<slug>` — extra pages (also in `content.json`, written in Markdown)
- **Edit in place:** open any page with `?edit` (e.g. `/?edit`). Click any text to change it; each section and card has buttons to move, duplicate, delete and add. Pages are managed from the 📄 button. "Save & publish" commits `content.json` with a fine-grained GitHub token (Contents: Read and write on this repository) that stays in your browser. `admin/` now redirects there.
- `assets/editor.js` — the in-place editor (only loaded with `?edit`).
- `assets/` — shared styles and the renderer

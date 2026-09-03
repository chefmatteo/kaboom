# Kaboom

A local-first kanban board for macOS. Your tickets live in plain JSON on your machine — no accounts, no cloud, no sync drama.

![Kaboom](https://img.shields.io/badge/platform-macOS-lightgrey)
![License](https://img.shields.io/badge/license-private-lightgrey)

## Why Kaboom?

Most task apps want your data on their servers. Kaboom keeps everything on your Mac:

- **Four columns** — Backlog, To Do, In Progress, Done
- **Drag and drop** — reorder within a column or move across columns
- **Categories & tags** — filter the board by either, or both
- **Due dates** — overdue tickets get a terracotta nudge
- **Search** — finds matches in titles, notes, and tags
- **Archive** — clearing Done tickets moves them to `archive.json`, not the trash

Data is stored in Electron's app-data folder (see below), so reinstalling or updating the app won't wipe your board.

## Quick start

```bash
git clone https://github.com/chefmatteo/kaboom.git
cd kaboom
npm install
npm start
```

## Build the `.app`

```bash
npm run dist
```

This produces:

| Output | Location |
|--------|----------|
| `Kaboom.app` | `dist/mac-arm64/Kaboom.app` |
| Installer | `dist/Kaboom-0.1.0-arm64.dmg` |

Drag the `.app` to Applications, or open the DMG and install from there.

For a faster unpack-only build (no DMG):

```bash
npm run dist:dir
```

## Where your data lives

Kaboom never writes tickets into the repo. At runtime, files go to:

```
~/Library/Application Support/Kaboom/
├── tasks.json      ← active board
└── archive.json    ← cleared Done tickets
```

Both files are plain JSON you can back up, diff, or edit by hand.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ N` | New ticket |
| `⌘ F` | Focus search |
| `Esc` | Clear search |

## Project layout

```
kaboom/
├── src/
│   ├── main.js       # Electron main process
│   ├── renderer.js   # Board UI & persistence
│   ├── store.js      # Pure state helpers (no DOM, no fs)
│   ├── styles.css    # Warm parchment theme
│   ├── index.html    # Shell markup
│   └── test.js       # State helper tests
├── package.json
└── README.md
```

## Tests

State logic is fully tested — no browser needed:

```bash
npm test
```

## License

Private / personal use. See [chefmatteo/kaboom](https://github.com/chefmatteo/kaboom) on GitHub.
>>>>>>> 74a5b57 (Restructure Kaboom as a tidy Electron app under src/)

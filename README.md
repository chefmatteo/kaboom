# Kaboom

A local-first kanban board for macOS. Your tickets stay on your Mac as plain JSON files.

## Features

- **Four columns** — Backlog, To Do, In Progress, Done
- **Drag and drop** — move tickets between columns  
- **Categories & tags** — organize and filter your work
- **Due dates** — see overdue tickets at a glance
- **Search** — find tickets by title, notes, or tags
- **Archive** — cleared tickets go to `archive.json`, not the trash

## Quick start

```bash
git clone https://github.com/chefmatteo/kaboom.git
cd kaboom
npm install
npm start
```

## Build the app

```bash
npm run dist        # Creates Kaboom.app + DMG
npm run dist:dir    # App only (faster)
```

## Download

Get the latest release from [GitHub Releases](https://github.com/chefmatteo/kaboom/releases).

**macOS Security Note:** If you see "Kaboom is damaged", run this in Terminal:
```bash
xattr -cr /path/to/Kaboom.app
```

## Data location

Your tickets live in `~/Library/Application Support/Kaboom/`:
- `tasks.json` — active board
- `archive.json` — cleared tickets

Both files are plain JSON you can backup or edit directly.
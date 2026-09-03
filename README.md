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
npm run build:app    # Creates dist/Kaboom.app + DMG
npm run verify:app   # Proves the bundle is installable, not just runnable here
npm run dist         # Both of the above
```

The bundle is re-signed at the end of the build. That step is not optional: editing
Electron's contents invalidates the signature it ships with, and macOS reports an
invalid signature as *"Kaboom is damaged and can't be opened"*.

## Install

Download the DMG from [Releases](https://github.com/chefmatteo/kaboom/releases), open
it, and drag **Kaboom** to Applications.

Kaboom is signed ad-hoc rather than notarized, so macOS will say *"Apple could not
verify Kaboom is free of malware"* on first launch. Clear the download flag **before**
opening it:

```bash
xattr -cr /Applications/Kaboom.app
```

Order matters — once macOS has blocked the app, that command fails with
*Operation not permitted* and you have to delete and re-copy it. If you already hit
the block, allow it under **System Settings → Privacy & Security → Open Anyway**.

## Data location

Your tickets live in `~/Library/Application Support/Kaboom/`:
- `tasks.json` — active board
- `archive.json` — cleared tickets

Both files are plain JSON you can backup or edit directly.
# Harbour Hustle

Harbour Hustle is a fresh TypeScript web-app recreation of the classic Dopewars loop, currently focused on a faithful single-player terminal-style experience with Halifax-flavored NPC systems.

## Current Features

- React, TypeScript, and Vite web app.
- Retro terminal UI with responsive desktop and mobile layouts.
- Config-driven drugs, locations, prices, services, dealers, police, and street intel contacts.
- Dealer-specific inventories and relationships.
- Robbery, gifting, reputation, turf, and combat mechanics.
- Named street intel contacts with trust, threat, gift, and intel systems.
- Historical price charts with missing-stock gaps.
- West End Halifax, J-Wood, Chebucto Cam, Tims references, apologetic police, and adult-language flavor.
- NPC context documents in `docs/npcs/` for future LLM-driven dialog.

## Requirements

- macOS or Linux.
- Node.js `20.19+` or `22.12+`.
- npm.

## Install

```bash
./install.sh
```

## Run

```bash
./run.sh
```

By default the app starts at:

```text
http://127.0.0.1:5173/
```

Override host or port if needed:

```bash
HOST=0.0.0.0 PORT=3000 ./run.sh
```

## Development

```bash
npm run dev
npm run build
npm run preview
```

## Project Structure

- `src/game/` - core game config, types, RNG, formatting, and engine logic.
- `src/components/` - React UI panels and terminal controls.
- `src/styles.css` - terminal visual system and responsive layout.
- `docs/npcs/` - structured NPC context files for future LLM dialog generation.
- `install.sh` - OS-aware dependency install helper.
- `run.sh` - OS-aware local dev server helper.

## Notes

The original source reference folder is intentionally excluded from git via `.gitignore`.

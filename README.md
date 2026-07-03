# Harbour Hustle

Harbour Hustle is a fresh TypeScript web app inspired by the classic street-trading game loop. It is not a C-to-WebAssembly port. The current `0.9.0` release is a single-player, retro-terminal recreation with a Halifax/HRM setting, config-driven game data, and new NPC systems layered on top of the original buy-low/sell-high structure.

The project is intentionally built as a modern web app first so it can grow into richer dialog, persistence, and multiplayer later.

## Version

Current version: `0.9.0`

See [CHANGELOG.md](CHANGELOG.md) for the full change history.

## Current Features

- React, TypeScript, and Vite app architecture.
- Responsive retro terminal UI for desktop and mobile.
- Config-driven drugs, locations, prices, services, dealers, police, street intel contacts, and weapons.
- HRM-only travel map: Downtown Halifax, North End Halifax, West End Halifax, Dartmouth, Bedford, Sackville, Spryfield, Halifax Public Gardens, and Eastern Passage.
- Stay-in-place and travel actions, each advancing the simulation.
- Dealer-specific drug coverage, stock, relationship thresholds, gifting, robbery, retaliation, combat, and reputation effects.
- Named street intel contacts with trust, threats, gifts, paid intel, and conversational dialog options.
- Action-report overlays for robbery, combat, intel purchases, threats, and follow-up dialog choices.
- Typed NPC conversation windows for dealers and street contacts, with Ollama-backed replies when available.
- Startup Ollama availability check with static fallback dialog when the local model is offline.
- Ollama-backed NPC dialog generation that feeds each NPC's markdown context into `llama3.1:8b`.
- Market price history and per-drug price charts, including simulated history before day one and gaps when a drug was unavailable.
- Player-facing Halifax flavor: Tims, Timbits, hoser phrasing, "eh", "my guy", apologetic police, swearing, and local NPC personalities.
- Downtown Halifax now includes Shanobi, a rhyming fiddle-playing intel contact, and Sweet Aidan, a sketchy dealer with odd questions and obscure facts.
- Canadian improvised weapon shop replacing firearms: tire iron, glass Coke-a-Cola bottle, sock full of loonies, sharpened hockey stick, Zamboni-part mace, bow and arrow, and more.
- New Game button in the persistent status bar.
- Structured NPC context documents in `docs/npcs/` for runtime LLM-driven dialog.

## Requirements

- macOS or Linux.
- Node.js `20.19+` or `22.12+`.
- npm.
- Optional: Ollama running `llama3.1:8b` at `http://127.0.0.1:11434` for generated NPC dialog. The app falls back to static dialog when Ollama or the configured model is unavailable.
- `zip` and `unzip` for release packaging.

## Install

```bash
./install.sh
```

## Run

Start Ollama separately if you want generated NPC dialog:

```bash
ollama run llama3.1:8b
```

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

## Package a Shareable Build

The release version is stored in `VERSION`.

Create a shareable static web zip with:

```bash
./package.sh
```

The script runs a production build and writes:

```text
harbour-hustle-<version>.zip
```

For example, if `VERSION` contains `0.9.0`, the output is:

```text
harbour-hustle-0.9.0.zip
```

The zip contains the built `index.html` and `assets/` files at the archive root. Git files and metadata such as `.git`, `.gitignore`, `.gitattributes`, and `.gitmodules` are excluded, and packaging fails if any are detected.

## Project Structure

- `src/game/` - core game config, types, RNG, formatting, and engine logic.
- `src/hooks/useNpcDialogue.ts` - local Ollama dialog hook that feeds NPC markdown into each prompt.
- `src/hooks/useOllamaAvailability.ts` - startup Ollama health check used to choose generated or fallback dialog.
- `src/components/` - React UI panels and terminal controls.
- `src/styles.css` - terminal visual system and responsive layout.
- `docs/locations.md` - HRM location, service, and NPC placement map.
- `docs/npcs/` - structured NPC context files bundled into Ollama dialog prompts, including role, hoser phrasing, and example dialog.
- `docs/concepts/` - concept and QA screenshots captured during UI development.
- `install.sh` - OS-aware dependency install helper.
- `run.sh` - OS-aware local dev server helper.
- `package.sh` - builds and zips a shareable release from `VERSION`.

## Notes

- The original source reference folder is intentionally excluded from git via `.gitignore`.
- The internal code still has some legacy names such as `guns` for save and engine compatibility, but the player-facing game uses weapons.
- The game currently targets single player. Multiplayer is planned, so the game data and engine boundaries are being kept relatively clean.

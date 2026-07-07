# Harbour Hustle

Harbour Hustle is a fresh TypeScript web app inspired by the classic street-trading game loop. It is not a C-to-WebAssembly port. The current `0.9.0` release is a single-player, retro-terminal recreation with a Halifax/HRM setting, config-driven game data, and new NPC systems layered on top of the original buy-low/sell-high structure.

The project is intentionally built as a modern web app first so it can grow into richer dialog, persistence, and multiplayer later.

## Version

Current version: `0.9.0`

See [CHANGELOG.md](CHANGELOG.md) for the full change history.

## Current Features

- React, TypeScript, and Vite app architecture.
- Responsive retro terminal UI for desktop and mobile.
- Dealer-name startup prompt with browser-local profile saves keyed by that name.
- Config-driven drugs, locations, prices, services, dealers, police, street intel contacts, and weapons.
- HRM-only travel map: Downtown Halifax, North End Halifax, West End Halifax, Westmount, Dartmouth, Bedford, Sackville, Spryfield, Halifax Public Gardens, and Eastern Passage.
- Stay-in-place and travel actions, each advancing the simulation.
- Dealer-specific drug coverage, stock, relationship thresholds, gifting, robbery, retaliation, combat, and reputation effects.
- Named street intel contacts with trust, threats, gifts, paid intel, and conversational dialog options.
- Dialog-style overlays for robbery, combat, police encounters, random events, intel purchases, threats, side offers, and follow-up choices.
- Robbery reports and follow-on police encounters are sequenced into separate overlays so dealer retaliation does not interrupt the robbery summary.
- Doctor NPC services in selected HRM locations; healing is an explicit paid visit instead of an automatic post-combat prompt.
- Typed NPC conversation windows for dealers and street contacts, with Ollama-backed replies when available.
- Persistent NPC memory for chat, trades, gifts, threats, robberies, offers, and intel, including relative timing in later prompts.
- Startup LLM availability check with static fallback dialog when the local model is offline.
- Server-side Ollama proxy endpoints so browsers call the web app at `/api/llm/*` instead of contacting Ollama directly.
- Ollama-backed NPC dialog generation that feeds each NPC's markdown context into `llama3.1:8b` from the web app server.
- Prompt rails keep generated NPC dialog in character, prevent invented mechanics, and encourage adult Halifax street profanity without slurs.
- Market price history and per-drug price charts, including simulated history before day one and gaps when a drug was unavailable.
- Player-facing Halifax flavor: Tims, Timbits, hoser phrasing, "eh", "my guy", apologetic police, swearing, and local NPC personalities.
- Downtown Halifax now includes Shanobi, a rhyming fiddle-playing intel contact, and Sweet Aidan, a sketchy dealer with odd questions and obscure facts.
- Westmount includes Johnathan, a posh physics-and-biking dealer focused on cocaine, hallucinogens, and protecting his cat Newton.
- Location merchants with changing buy/sell prices who sell configured weapon/item lists and buy any carried weapon.
- Canadian improvised weapons replacing firearms: tire iron, glass Coke-a-Cola bottle, sock full of loonies, sharpened hockey stick, Zamboni-part mace, bow and arrow, and more.
- New Game button in the persistent status bar.
- Structured NPC context documents in `docs/npcs/` for runtime LLM-driven dialog.

## Requirements

- macOS or Linux.
- Node.js `20.19+` or `22.12+`.
- npm.
- Optional: Ollama running `llama3.1:8b` at `http://127.0.0.1:11434` for generated NPC dialog. The app server calls Ollama; browsers only call the web app. The app falls back to static dialog when Ollama or the configured model is unavailable.
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

Override the server-side Ollama target or model if needed:

```bash
OLLAMA_ENDPOINT=http://127.0.0.1:11434 OLLAMA_MODEL=llama3.1:8b ./run.sh
```

LLM proxy logs appear in the same terminal as `./run.sh` with the prefix `[harbour-hustle llm]`. Ollama's own logs are usually under `~/.ollama/logs/` on macOS.

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
- `src/game/npcMemory.ts` - prompt formatting for persistent NPC interaction memory.
- `src/hooks/useNpcDialogue.ts` - client hook that calls the same-origin LLM proxy and falls back to static dialog.
- `src/hooks/useOllamaAvailability.ts` - startup Ollama health check used to choose generated or fallback dialog.
- `vite.config.ts` - Vite config plus `/api/llm` middleware that reads NPC markdown and calls Ollama server-side.
- `src/components/` - React UI panels and terminal controls.
- `src/styles.css` - terminal visual system and responsive layout.
- `docs/player-profiles.md` - dealer-name profile save and resume behavior.
- `docs/locations.md` - HRM location, service, and NPC placement map.
- `docs/npcs/` - structured NPC context files bundled into Ollama dialog prompts, including dealers, street contacts, doctors, police, role, hoser phrasing, and example dialog.
- `docs/concepts/` - concept and QA screenshots captured during UI development.
- `install.sh` - OS-aware dependency install helper.
- `run.sh` - OS-aware local dev server helper.
- `package.sh` - builds and zips a shareable release from `VERSION`.

## Notes

- The original source reference folder is intentionally excluded from git via `.gitignore`.
- Player profiles are stored in the browser's local storage for the current app origin. Using the same dealer name on the same browser/origin resumes that saved run.
- Generated dialog requires the web app server middleware. A plain static file server can run the game, but it cannot proxy Ollama requests.
- The internal code still has some legacy names such as `guns` for save and engine compatibility, but the player-facing game uses weapons.
- The game currently targets single player. Multiplayer is planned, so the game data and engine boundaries are being kept relatively clean.

# Changelog

All notable changes to Harbour Hustle are documented here.

## [0.9.0] - 2026-07-03

### Added

- Rebuilt the original game concept as a fresh React, TypeScript, and Vite web app instead of a C-to-WebAssembly port.
- Added a responsive retro terminal UI for desktop and mobile.
- Added config-driven game data for locations, drugs, services, dealers, police, street intel contacts, weapons, prices, and flavor text.
- Added an HRM-only map with Downtown Halifax, North End Halifax, West End Halifax, Dartmouth, Bedford, Sackville, Spryfield, Halifax Public Gardens, and Eastern Passage.
- Added stay-in-place travel flow so the player can advance time without changing location.
- Added market price history charts for each drug, including simulated pre-start history and gaps for unavailable stock.
- Added clickable per-drug price charts from the market screen.
- Added dealer-specific drug coverage, stock limits, buy/sell support, relationships, refusal thresholds, gifts, robbery, retaliation, and combat.
- Added reputation and turf systems affected by trades, gifts, threats, robberies, and other hostile actions.
- Added named street intel contacts at every location with paid intel, gifts, threats, relationship values, and fight-back behavior.
- Added conversational intel UI with dialog-style choices instead of simple info buttons.
- Added NPC context documents in `docs/npcs/` for future LLM-generated dialog.
- Added a persistent New Game button in the status bar.
- Added OS-aware `install.sh` and `run.sh` helpers for macOS and Linux.

### Changed

- Renamed and themed the game as Harbour Hustle.
- Reworked the setting from the original city list into a Halifax/HRM setting.
- Replaced generic market access with named dealers who sell static subsets of drugs and can have changing daily stock.
- Replaced firearms in the player-facing game with Canadian improvised weapons, including a tire iron, glass Coke-a-Cola bottle, sock full of loonies, sharpened hockey stick, Zamboni-part mace, rusty fillet knife, and bow and arrow.
- Replaced the old gun shop flavor with Sackville Salvage & Sporting Goods.
- Renamed the Downtown Halifax dealer to Shady Rich and made him a paranoid conspiracy theorist.
- Added Shady Rich dialog seeds such as asking about cameras, harbour fog, price spikes, and whether the player is wired.
- Added J-Wood in West End Halifax as a paranoid, violent, unpredictable dealer who can offer an ultrasound.
- Updated police flavor so they apologize frequently, including during threats and violence.
- Updated NPC dialog flavor to include Halifax hoser phrasing, "eh", "my guy", Tims, Timbits, and adult language.
- Changed Tims wording so "coffee" is not used for that flavor.
- Removed the CONFIG panel from the UI.
- Removed the bottom command line from the UI.
- Changed market max controls to one-click Max Buy and Max Sell actions.
- Added dealer stock display and prevented buying more than the dealer has.
- Updated UI title/header layout so Harbour Hustle is not clipped.

### Fixed

- Fixed empty price history on day one by simulating historic market days before the start date.
- Fixed price chart rendering so unavailable drugs do not draw dots or connected lines.
- Fixed sell availability so dealer and inventory rules line up with dealer drug coverage.
- Fixed mobile and desktop overflow issues around the conversational intel panel and weapon shop.
- Added hydration safeguards so newer configured weapon IDs exist in older saved game states.

### Documentation

- Added and updated HRM location documentation.
- Added structured NPC docs for dealers, street intel contacts, and police.
- Updated NPC docs for current weapons, Shady Rich, J-Wood, Halifax flavor rules, and future LLM dialog context.
- Added this changelog and refreshed the README for the `0.9.0` milestone.

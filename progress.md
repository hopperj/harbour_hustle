Original prompt: I'd like random events, police interactions, and robbery/offer interactions to all happen in the dialog window. please implement all your suggestions. also, the hobo intel shouldn't be things I can get from the UI like my reputation with a dealer or the police risk at a location.

Progress:
- Started refactor to make encounter/dialog windows own random events, police prompts, robbery results, dealer offers, and typed NPC chat.
- Planned cleanup: remove duplicated NPC opener text from dealer/hobo panels, remove center prompt panel usage, and restrict hobo intel away from visible UI stats such as dealer relationship/reputation/police risk.
- Implemented modal-owned pending prompts and action outcomes in `src/App.tsx`; removed the old center `PromptPanel` component and styles.
- Replaced inline dealer/hobo spoken lines with compact interaction status copy and renamed typed freeform action buttons to `CHAT`.
- Updated hobo intel report text so it no longer exposes exact police percentages, turf scores, dealer refusal thresholds, or current market prices.
- Verified with `npm run build`.
- Verified with Playwright smoke checks:
  - no `.prompt-panel` rendered;
  - no inline `.npc-line` remains in dealer/hobo panels;
  - dealer chat opens a conversation modal with an NPC opener;
  - injected police prompt opens in the modal with no close button, no empty-state copy, RUN/FIGHT actions, and no console errors.

TODO:
- None known.

Follow-up progress:
- Added persistent NPC memory entries for direct chat, trades, gifts, robbery, threats, side offers, hobo intel, and generated outcome reactions.
- LLM scenes for dealer/hobo chat, offer/police prompts, robbery reactions, and intel handoffs now include prior direct history with relative timing such as today / N days ago.
- Hobo intel reports now store structured game-decided details; the LLM prompt receives those facts and is told not to invent extra mechanical facts.
- Verified `npm run build`.
- Verified browser smoke checks:
  - typed dealer chat writes NPC memory;
  - dealer robbery writes violence memory and remembers generated robbery reaction;
  - hobo intel writes an intel report with structured details and stores an intel memory entry.

Merchant progress:
- Dealer selector buttons now label each NPC as `DEALER / <relationship>`.
- Added config-driven local merchants in Sackville, North End Halifax, Spryfield, Dartmouth, and Eastern Passage.
- Merchant prices now roll with the daily/location market; each merchant sells only a configured subset but buys every weapon/item.
- Replaced the fixed gun-shop service table with a merchant table showing buy price, sell price, held quantity, and buy/sell commands.
- Added a weapons/items inventory table so carried merchant goods are visible beyond the top-line count.
- Verified `npm run build`.
- Verified browser smoke checks against the Vite dev server:
  - dealer selector includes `DEALER /`;
  - Sackville renders the merchant services table with changing buy/sell quotes;
  - enabled merchant buy buttons are present;
  - buying from the merchant writes a purchase log entry.

Robbery follow-up progress:
- Added per-dealer same-day successful robbery tracking in game state.
- Dealer robbery now records the current turn only when the robbery succeeds.
- Same-day repeat robbery is blocked by the engine after a successful robbery.
- Robbery outcome windows now include a `ROB AGAIN` follow-up action for the same dealer.
- `ROB AGAIN` is disabled after a successful same-day robbery and becomes available again after time advances.
- Verified `npm run build`.
- Verified browser smoke checks:
  - successful robbery summary shows `ROB AGAIN`;
  - `ROB AGAIN` is disabled after success;
  - saved robbery turn matches the current turn after success;
  - advancing the turn makes the same dealer eligible again.

NPC prompt rail progress:
- Reviewed LLM prompt surfaces: shared Ollama system prompt, dealer openings, street intel openings, action reports, police/offer prompts, and typed conversations.
- Added shared NPC style rails that encourage ambient adult profanity such as `fuckin' right, boy`, `fuck, shit, sorry`, and `fuuuuckin' eh`.
- Added guardrails against slurs, hate terms, sexual threats, and mechanical hallucinations.
- Reused the same rails across dealer, hobo, police, offer, outcome, and typed-chat scene prompts.
- Strengthened typed conversation instructions so chat can deflect, hint, and posture, but cannot create trades, rewards, intel reports, relationship changes, time changes, or new facts.
- Updated offline fallback chat responses to include more passive swearing while still refusing free mechanical facts.
- Lightly expanded the non-LLM swear injector with `fuck, shit, sorry`, `fuckin'`, and `fuuuuckin' eh`.
- Verified `npm run build`.
- Verified browser smoke checks:
  - live dialogue window still opens and accepts Enter-to-send;
  - forced Ollama-offline fallback shows passive swearing and refuses free police/intel facts.

Police encounter stability progress:
- Prompt encounter body text now always shows the mechanical prompt text instead of swapping from fallback to LLM text.
- Generated NPC prompt lines are withheld until the LLM response is ready, then appear as a separate NPC line.
- Existing freeform NPC chat overlays are closed when a new encounter or action report opens, preventing stale conversations from sitting on top of police/run results.
- Verified `npm run build`.
- Verified browser smoke check with delayed fake LLM response:
  - police prompt text stayed unchanged while waiting;
  - no fallback NPC line rendered before the LLM response;
  - generated officer line appeared separately after the response.

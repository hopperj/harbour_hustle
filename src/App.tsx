import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConversationOverlay, type NpcConversationTarget } from "./components/ConversationOverlay";
import { EventLog } from "./components/EventLog";
import { FinancePanel } from "./components/FinancePanel";
import { InventoryPanel } from "./components/InventoryPanel";
import { MarketPanel } from "./components/MarketPanel";
import { OutcomeOverlay } from "./components/OutcomeOverlay";
import { ServicePanel } from "./components/ServicePanel";
import { StatusBar } from "./components/StatusBar";
import { StreetIntelPanel } from "./components/StreetIntelPanel";
import { TerminalButton } from "./components/TerminalButton";
import { TravelPanel } from "./components/TravelPanel";
import { DEFAULT_GAME_CONFIG } from "./game/config";
import { applyCommand, createGame, hoboIntelPrice, hydrateGameState } from "./game/engine";
import { formatMoney } from "./game/format";
import { npcSceneRails } from "./game/llmDialogue";
import { formatNpcMemoryForPrompt } from "./game/npcMemory";
import type { EventLogEntry, GameCommand, GameConfig, GameState, PendingPrompt, Tone } from "./game/types";
import { useNpcDialogue } from "./hooks/useNpcDialogue";
import { useOllamaAvailability } from "./hooks/useOllamaAvailability";

const SAVE_KEY = "harbour-hustle-state-v1";
const PROFILE_SAVE_PREFIX = "harbour-hustle-profile-v1:";
const PROFILE_INDEX_KEY = "harbour-hustle-profile-index-v1";
const PRE_RENAME_SAVE_PREFIX = ["dope", "wars-web-state-v"].join("");
const LEGACY_SAVE_KEYS = [
  "harbour-hustle-state-v0",
  `${PRE_RENAME_SAVE_PREFIX}4`,
  `${PRE_RENAME_SAVE_PREFIX}3`,
  `${PRE_RENAME_SAVE_PREFIX}2`,
  `${PRE_RENAME_SAVE_PREFIX}1`,
];

interface ActionOutcome {
  dealerId?: string;
  dialogueFallback: string;
  dialogueScene: string;
  entries: EventLogEntry[];
  hoboId?: string;
  id: string;
  npcId?: string;
  npcName?: string;
  npcRole?: string;
  prompt: GameState["pendingPrompt"];
  title: string;
  tone: Tone;
}

interface DealerProfile {
  key: string;
  name: string;
}

interface DealerProfileRecord {
  dealerName: string;
  savedAt: string;
  state: GameState;
  version: 1;
}

function cleanDealerName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function dealerProfileKey(name: string): string {
  return cleanDealerName(name).toLowerCase();
}

function profileStorageKey(key: string): string {
  return `${PROFILE_SAVE_PREFIX}${encodeURIComponent(key)}`;
}

function readProfileIndex(): DealerProfile[] {
  try {
    const saved = window.localStorage.getItem(PROFILE_INDEX_KEY);
    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved) as DealerProfile[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((profile) => typeof profile?.key === "string" && typeof profile?.name === "string");
  } catch {
    return [];
  }
}

function writeProfileIndex(profile: DealerProfile): void {
  try {
    const profiles = readProfileIndex().filter((item) => item.key !== profile.key);
    profiles.unshift(profile);
    window.localStorage.setItem(PROFILE_INDEX_KEY, JSON.stringify(profiles.slice(0, 20)));
  } catch {
    // Saves still work without the profile index; the name key is the source of truth.
  }
}

function readSavedRecord(key: string): DealerProfileRecord | null {
  try {
    const saved = window.localStorage.getItem(profileStorageKey(key));
    if (!saved) {
      return null;
    }

    const parsed = JSON.parse(saved) as DealerProfileRecord;
    if (!parsed || typeof parsed.dealerName !== "string" || !parsed.state) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function readLegacyState(config: GameConfig, removeMigrated: boolean): GameState | null {
  const keys = [SAVE_KEY, ...LEGACY_SAVE_KEYS];
  for (const key of keys) {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(key);
    } catch {
      saved = null;
    }

    if (!saved) {
      continue;
    }

    try {
      const state = hydrateGameState(config, JSON.parse(saved) as GameState);
      if (removeMigrated) {
        window.localStorage.removeItem(key);
      }
      return state;
    } catch {
      window.localStorage.removeItem(key);
    }
  }

  return null;
}

function buildDealerProfile(name: string): DealerProfile | null {
  const cleaned = cleanDealerName(name);
  if (!cleaned) {
    return null;
  }

  const key = dealerProfileKey(cleaned);
  const saved = readSavedRecord(key);
  return {
    key,
    name: saved?.dealerName ?? cleaned,
  };
}

function withDealerName(state: GameState, profile: DealerProfile): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      name: profile.name,
    },
  };
}

function loadProfileState(config: GameConfig, profile: DealerProfile): GameState {
  const saved = readSavedRecord(profile.key);
  if (saved) {
    return withDealerName(hydrateGameState(config, saved.state), profile);
  }

  const canAdoptLegacySave = readProfileIndex().length === 0;
  if (canAdoptLegacySave) {
    const legacyState = readLegacyState(config, true);
    if (legacyState) {
      return withDealerName(legacyState, profile);
    }
  }

  return withDealerName(createGame(config), profile);
}

interface DealerNamePromptProps {
  currentName?: string;
  onCancel?: () => void;
  onSubmit: (name: string) => void;
}

function DealerNamePrompt({ currentName = "", onCancel, onSubmit }: DealerNamePromptProps) {
  const [name, setName] = useState(currentName);
  const cleaned = cleanDealerName(name);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cleaned) {
      return;
    }
    onSubmit(cleaned);
  };

  return (
    <div className="outcome-overlay profile-overlay" role="presentation">
      <section aria-labelledby="profile-title" aria-modal="true" className="outcome-dialog profile-dialog" role="dialog">
        <div className="outcome-header">
          <div>
            <p className="panel-caption">PROFILE CHECK</p>
            <h2 id="profile-title">DEALER NAME</h2>
          </div>
          {onCancel && (
            <TerminalButton className="outcome-close" onClick={onCancel}>
              CLOSE
            </TerminalButton>
          )}
        </div>

        <form className="profile-form" onSubmit={submit}>
          <label htmlFor="dealer-name-input">NAME</label>
          <input
            autoComplete="nickname"
            autoFocus
            id="dealer-name-input"
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            placeholder="Solo Dealer"
            value={name}
          />
          <div className="profile-actions">
            <TerminalButton disabled={!cleaned} tone="good" type="submit">
              START / CONTINUE
            </TerminalButton>
          </div>
        </form>
      </section>
    </div>
  );
}

function shouldShowOutcome(command: GameCommand): boolean {
  return command.type === "robDealer" ||
    command.type === "buyHoboIntel" ||
    command.type === "threatenHobo" ||
    command.type === "answerPrompt" ||
    command.type === "approachDealer" ||
    command.type === "dropDrug" ||
    command.type === "stay" ||
    command.type === "travel";
}

function outcomeTitle(command: GameCommand): string {
  if (command.type === "approachDealer") {
    return "STREET OFFER";
  }
  if (command.type === "robDealer") {
    return "ROBBERY SUMMARY";
  }
  if (command.type === "buyHoboIntel") {
    return "INTEL REPORT";
  }
  if (command.type === "threatenHobo") {
    return "STREET ENCOUNTER";
  }
  if (command.type === "answerPrompt" && command.answer === "fight") {
    return "COMBAT SUMMARY";
  }
  if (command.type === "answerPrompt" && command.answer === "run") {
    return "CHASE SUMMARY";
  }
  if (command.type === "travel" || command.type === "stay" || command.type === "dropDrug") {
    return "STREET ENCOUNTER";
  }
  return "DIALOG SUMMARY";
}

function newEntries(previous: GameState, next: GameState): EventLogEntry[] {
  const previousMaxId = previous.eventLog.reduce((maxId, entry) => Math.max(maxId, entry.id), 0);
  return next.eventLog.filter((entry) => entry.id > previousMaxId).sort((a, b) => a.id - b.id);
}

function outcomeTone(entries: EventLogEntry[], prompt: GameState["pendingPrompt"]): Tone {
  if (entries.some((entry) => entry.tone === "bad")) {
    return "bad";
  }
  if (prompt || entries.some((entry) => entry.tone === "warn")) {
    return "warn";
  }
  if (entries.some((entry) => entry.tone === "good")) {
    return "good";
  }
  return "info";
}

function promptNpc(config: GameConfig, prompt: PendingPrompt | null): { id: string; name: string; role: string } | null {
  if (prompt?.type === "cops") {
    const cop = config.cops.find((item) => item.id === prompt.copId);
    return cop ? { id: cop.id, name: cop.name, role: "police officer" } : null;
  }

  if (prompt?.type === "dealer-offer") {
    const dealer = config.dealers.find((item) => item.id === prompt.dealerId);
    return dealer ? { id: dealer.id, name: dealer.name, role: "drug dealer" } : null;
  }

  return null;
}

function outcomeNpc(config: GameConfig, command: GameCommand, previous: GameState, next: GameState): { id: string; name: string; role: string } | null {
  if (command.type === "buyHoboIntel" || command.type === "threatenHobo") {
    const hobo = config.hobos.find((item) => item.id === command.hoboId);
    return hobo ? { id: hobo.id, name: hobo.name, role: "street intel contact and hobo" } : null;
  }

  if (command.type === "approachDealer") {
    const dealer = config.dealers.find((item) => item.id === command.dealerId);
    return dealer ? { id: dealer.id, name: dealer.name, role: "drug dealer" } : null;
  }

  if (command.type === "robDealer") {
    const dealer = config.dealers.find((item) => item.id === command.dealerId);
    return dealer ? { id: dealer.id, name: dealer.name, role: "drug dealer" } : null;
  }

  if (command.type === "answerPrompt" && previous.pendingPrompt?.type === "cops") {
    const copId = previous.pendingPrompt.copId;
    const cop = config.cops.find((item) => item.id === copId);
    return cop ? { id: cop.id, name: cop.name, role: "police officer" } : null;
  }

  if (command.type === "answerPrompt" && previous.pendingPrompt?.type === "dealer-offer") {
    const dealerId = previous.pendingPrompt.dealerId;
    const dealer = config.dealers.find((item) => item.id === dealerId);
    return dealer ? { id: dealer.id, name: dealer.name, role: "drug dealer" } : null;
  }

  return promptNpc(config, next.pendingPrompt);
}

function promptTitle(prompt: PendingPrompt): string {
  if (prompt.type === "cops") {
    return "POLICE ENCOUNTER";
  }
  if (prompt.type === "dealer-offer") {
    return "STREET OFFER";
  }
  if (prompt.type === "doctor") {
    return "DOCTOR OFFER";
  }
  if (prompt.type === "bargain-helper" || prompt.type === "bargain-gun") {
    return "SIDE OFFER";
  }
  return "STREET ENCOUNTER";
}

function promptTone(prompt: PendingPrompt): Tone {
  if (prompt.type === "cops" || prompt.type === "wild-weed") {
    return "warn";
  }
  if (prompt.type === "doctor") {
    return "good";
  }
  return "info";
}

function promptScene(config: GameConfig, prompt: PendingPrompt, state: GameState): string {
  const npc = promptNpc(config, prompt);
  if (!npc) {
    return "";
  }

  if (prompt.type === "cops") {
    return [
      "A police encounter starts.",
      `${npc.name} and ${prompt.deputies} deputies are chasing the player.`,
      "The player must choose RUN or FIGHT.",
      "Prior direct history with this NPC:",
      formatNpcMemoryForPrompt(state, npc.id),
      `Existing mechanical prompt: ${prompt.text}`,
      ...npcSceneRails("Police line should be urgent, apologetic, threatening, and tied only to this chase prompt."),
      "Say the opening police line directly to the player.",
    ].join("\n");
  }

  if (prompt.type === "dealer-offer") {
    return [
      "A potential buyer approaches you and says hello.",
      `${npc.name} is making a side offer before normal business continues.`,
      `Offer price: ${prompt.price}. Relationship gain if accepted: ${prompt.relationshipGain}.`,
      `Player location id: ${state.player.locationId}. Player cash: ${state.player.cash}. Player reputation: ${state.player.reputation}.`,
      "Prior direct history with this NPC:",
      formatNpcMemoryForPrompt(state, npc.id),
      `Existing mechanical prompt: ${prompt.text}`,
      ...npcSceneRails("Dealer offer line should sell the provided offer and price only."),
      "Say the offer directly to the player.",
    ].join("\n");
  }

  return "";
}

function isRandomEncounterEntry(entry: EventLogEntry): boolean {
  return [
    /Somebody mugs you/i,
    /You meet a friend/i,
    /Police dogs chase you/i,
    /Your mama made brownies/i,
    /paraquat/i,
    /You stopped to/i,
    /The lady next to you/i,
    /You hear someone playing/i,
    /cops spot you dropping/i,
  ].some((pattern) => pattern.test(entry.text));
}

function outcomeEntries(command: GameCommand, entries: EventLogEntry[], prompt: PendingPrompt | null): EventLogEntry[] {
  const withoutPromptEcho = prompt ? entries.filter((entry) => entry.text !== prompt.text) : entries;

  if (command.type === "travel" || command.type === "stay" || command.type === "dropDrug") {
    return withoutPromptEcho.filter(isRandomEncounterEntry);
  }

  if (command.type === "approachDealer") {
    return withoutPromptEcho;
  }

  return withoutPromptEcho;
}

function outcomeScene(
  command: GameCommand,
  npc: { id: string; name: string; role: string } | null,
  entries: EventLogEntry[],
  previous: GameState,
  next: GameState,
): string {
  if (!npc) {
    return "";
  }

  const summary = entries.map((entry) => `- ${entry.text}`).join("\n") || "- No new event log lines.";
  const latestIntel = command.type === "buyHoboIntel" || command.type === "threatenHobo"
    ? next.intelReports.find((report) => report.sourceId === npc.id)
    : null;
  const opener = "A potential buyer approaches you and says hello.";
  const common = [
    opener,
    `${npc.name} is a ${npc.role}.`,
    `Player location id: ${next.player.locationId}. Player cash: ${next.player.cash}. Player reputation: ${next.player.reputation}.`,
    "Prior direct history with this NPC:",
    formatNpcMemoryForPrompt(next, npc.id),
    "Recent mechanical outcome:",
    summary,
    ...npcSceneRails("React to the resolved outcome only. Do not add rewards, losses, injuries, prices, intel, or police consequences that are not listed above."),
  ];

  if (command.type === "buyHoboIntel") {
    if (latestIntel) {
      common.push("Game-decided intel facts to convey in character:");
      common.push(...(latestIntel.details ?? [latestIntel.text]));
    }
    common.push("The player just bought or received intel from you. Say what you say while handing over those facts. Do not add new mechanical facts.");
  } else if (command.type === "threatenHobo") {
    if (latestIntel) {
      common.push("Game-decided intel facts to convey in character:");
      common.push(...(latestIntel.details ?? [latestIntel.text]));
    }
    common.push("The player just threatened you for intel. React to the threat and outcome. If you gave intel, convey only the game-decided facts.");
  } else if (command.type === "robDealer") {
    common.push("The player just tried to rob you. React to the robbery outcome as the dealer who experienced it. This line should be the NPC's generated reaction.");
  } else if (command.type === "approachDealer" && next.pendingPrompt?.type === "dealer-offer") {
    common.push(`You are making this side offer to the player: ${next.pendingPrompt.text}`);
  } else if (next.pendingPrompt?.type === "cops") {
    common.push(`You just confronted the player with this police prompt: ${next.pendingPrompt.text}`);
  } else if (next.pendingPrompt?.type === "dealer-offer") {
    common.push(`You are making this side offer to the player: ${next.pendingPrompt.text}`);
  } else if (command.type === "answerPrompt" && previous.pendingPrompt?.type === "cops") {
    common.push(`The player chose ${command.answer.toUpperCase()} during a police encounter. React to that result.`);
  } else if (command.type === "answerPrompt" && previous.pendingPrompt?.type === "dealer-offer") {
    common.push(`The player answered ${command.answer.toUpperCase()} to your side offer. React to that answer.`);
  }

  return common.join("\n");
}

function buildOutcome(config: GameConfig, command: GameCommand, previous: GameState, next: GameState): ActionOutcome | null {
  if (!shouldShowOutcome(command)) {
    return null;
  }

  const prompt = next.pendingPrompt;
  const entries = outcomeEntries(command, newEntries(previous, next), prompt);
  if (entries.length === 0 && !prompt) {
    return null;
  }

  const npc = outcomeNpc(config, command, previous, next);

  return {
    dialogueFallback: npc ? `${npc.name} watches how you react.` : "",
    dialogueScene: outcomeScene(command, npc, entries, previous, next),
    dealerId: command.type === "robDealer" ? command.dealerId : undefined,
    entries,
    hoboId: "hoboId" in command ? command.hoboId : undefined,
    id: `${next.logIndex}:${command.type}:${"answer" in command ? command.answer : ""}`,
    npcId: npc?.id,
    npcName: npc?.name,
    npcRole: npc?.role,
    prompt,
    title: outcomeTitle(command),
    tone: outcomeTone(entries, prompt),
  };
}

function buildPromptOutcome(config: GameConfig, state: GameState): ActionOutcome | null {
  const prompt = state.pendingPrompt;
  if (!prompt) {
    return null;
  }

  const npc = promptNpc(config, prompt);
  return {
    dialogueFallback: npc ? prompt.text : "",
    dialogueScene: promptScene(config, prompt, state),
    entries: [],
    id: `${state.logIndex}:prompt:${prompt.type}:${prompt.text}`,
    npcId: npc?.id,
    npcName: npc?.name,
    npcRole: npc?.role,
    prompt,
    title: promptTitle(prompt),
    tone: promptTone(prompt),
  };
}

export default function App() {
  const config = DEFAULT_GAME_CONFIG;
  const ollamaStatus = useOllamaAvailability(config);
  const llmAvailable = ollamaStatus === "available";
  const [dealerProfile, setDealerProfile] = useState<DealerProfile | null>(null);
  const [profilePromptOpen, setProfilePromptOpen] = useState(true);
  const [state, setState] = useState<GameState>(() => createGame(config));
  const [outcome, setOutcome] = useState<ActionOutcome | null>(null);
  const [conversation, setConversation] = useState<NpcConversationTarget | null>(null);
  const rememberedOutcomeLineRef = useRef<string | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
    if (!dealerProfile) {
      return;
    }

    try {
      window.localStorage.setItem(profileStorageKey(dealerProfile.key), JSON.stringify({
        dealerName: dealerProfile.name,
        savedAt: new Date().toISOString(),
        state,
        version: 1,
      } satisfies DealerProfileRecord));
      writeProfileIndex(dealerProfile);
    } catch {
      // localStorage can be unavailable or full; the active in-memory game still works.
    }
  }, [dealerProfile, state]);

  const startDealerProfile = useCallback(
    (name: string) => {
      const profile = buildDealerProfile(name);
      if (!profile) {
        return;
      }

      const next = loadProfileState(config, profile);
      stateRef.current = next;
      rememberedOutcomeLineRef.current = null;
      setDealerProfile(profile);
      writeProfileIndex(profile);
      setState(next);
      setOutcome(null);
      setConversation(null);
      setProfilePromptOpen(false);
    },
    [config],
  );

  const dispatch = useCallback(
    (command: GameCommand) => {
      const current = stateRef.current;
      const next = applyCommand(config, current, command);
      stateRef.current = next;
      setState(next);
      if (command.type === "rememberNpc") {
        return;
      }
      const nextOutcome = buildOutcome(config, command, current, next);
      setOutcome(nextOutcome);
      if (nextOutcome || next.pendingPrompt) {
        setConversation(null);
      }
    },
    [config],
  );

  const newGame = useCallback(() => {
    setProfilePromptOpen(true);
  }, []);

  const openConversation = useCallback((target: NpcConversationTarget) => {
    setConversation(target);
  }, []);

  const activeOutcome = outcome ?? buildPromptOutcome(config, state);
  const canFight = Object.values(state.player.guns).some((item) => item.carried > 0);
  const outcomeHobo = outcome?.hoboId ? config.hobos.find((hobo) => hobo.id === outcome.hoboId) : null;
  const outcomeDealer = outcome?.dealerId ? config.dealers.find((dealer) => dealer.id === outcome.dealerId) : null;
  const outcomeHoboIsHere = outcomeHobo?.locationId === state.player.locationId;
  const outcomeDealerIsHere = outcomeDealer?.locationId === state.player.locationId;
  const outcomeHoboIntelPrice = outcomeHobo ? hoboIntelPrice(config, state, outcomeHobo) : 0;
  const outcomeLocked = state.pendingPrompt !== null || state.gameOver || !outcomeHoboIsHere;
  const dealerRobbedToday = outcomeDealer ? (state.dealerRobberyTurns?.[outcomeDealer.id] ?? 0) === state.player.turn : false;
  const dealerActionLocked = state.pendingPrompt !== null || state.gameOver || !outcomeDealerIsHere;
  const dealerActions = outcomeDealer ? [
    {
      detail: dealerRobbedToday ? "Already robbed successfully today" : "Try to hit the same dealer again",
      disabled: dealerActionLocked || dealerRobbedToday,
      label: "ROB AGAIN",
      onClick: () => dispatch({ type: "robDealer", dealerId: outcomeDealer.id }),
      tone: "bad" as const,
    },
  ] : [];
  const hoboActions = outcomeHobo ? [
    {
      detail: outcomeHoboIntelPrice === 0
        ? "Ask for another local tip"
        : `${formatMoney(config, outcomeHoboIntelPrice)} for another local tip`,
      disabled: outcomeLocked || outcomeHoboIntelPrice > state.player.cash,
      label: "GET MORE INTEL",
      onClick: () => dispatch({ type: "buyHoboIntel", hoboId: outcomeHobo.id }),
      tone: outcomeHoboIntelPrice === 0 ? "good" as const : "default" as const,
    },
    {
      detail: "Force another story out of them",
      disabled: outcomeLocked,
      label: "THREATEN",
      onClick: () => dispatch({ type: "threatenHobo", hoboId: outcomeHobo.id }),
      tone: "bad" as const,
    },
  ] : [];
  const outcomeDialogue = useNpcDialogue({
    config,
    disabled: !activeOutcome?.npcId,
    fallback: activeOutcome?.dialogueFallback ?? "",
    llmAvailable,
    npcId: activeOutcome?.npcId,
    npcName: activeOutcome?.npcName,
    refreshKey: activeOutcome?.id ?? null,
    scene: activeOutcome?.dialogueScene ?? "",
  });
  const visibleOutcomeDialogue = activeOutcome?.prompt
    ? outcomeDialogue.status === "ready" ? outcomeDialogue.text : ""
    : outcomeDialogue.text;
  useEffect(() => {
    if (activeOutcome?.prompt || !activeOutcome?.npcId || !activeOutcome.npcName || !visibleOutcomeDialogue.trim()) {
      return;
    }

    const key = `${activeOutcome.id}:${activeOutcome.npcId}:${visibleOutcomeDialogue}`;
    if (rememberedOutcomeLineRef.current === key) {
      return;
    }

    rememberedOutcomeLineRef.current = key;
    dispatch({
      type: "rememberNpc",
      kind: "interaction",
      npcId: activeOutcome.npcId,
      text: `${activeOutcome.npcName} said during ${activeOutcome.title}: ${visibleOutcomeDialogue}`,
    });
  }, [activeOutcome, dispatch, visibleOutcomeDialogue]);
  const outcomeConversation = useMemo(() => activeOutcome?.npcId && activeOutcome.npcName && !activeOutcome.prompt ? {
    fallback: activeOutcome.dialogueFallback,
    id: activeOutcome.npcId,
    name: activeOutcome.npcName,
    openingLine: visibleOutcomeDialogue,
    role: activeOutcome.npcRole ?? "encounter NPC",
    scene: [
      activeOutcome.dialogueScene,
      "The player is typing directly in the same action report window.",
    ].join("\n"),
    title: `CHAT WITH ${activeOutcome.npcName.toUpperCase()}`,
    tone: activeOutcome.tone,
  } satisfies NpcConversationTarget : null, [
    activeOutcome?.dialogueFallback,
    activeOutcome?.dialogueScene,
    activeOutcome?.id,
    activeOutcome?.npcId,
    activeOutcome?.npcName,
    activeOutcome?.npcRole,
    activeOutcome?.prompt,
    activeOutcome?.tone,
    visibleOutcomeDialogue,
  ]);

  return (
    <main className="terminal-shell">
      <StatusBar config={config} dealerName={dealerProfile?.name ?? null} state={state} onNewGame={newGame} />

      <div className="app-grid">
        <aside className="left-column">
          <InventoryPanel config={config} state={state} />
          <FinancePanel config={config} state={state} dispatch={dispatch} />
        </aside>

        <section className="center-column">
          {state.gameOver && (
            <section className="terminal-panel game-over-panel" aria-label="Game over">
              <h2>GAME OVER</h2>
              <p>Final score: {formatMoney(config, state.finalScore ?? 0)}</p>
              <TerminalButton tone="good" onClick={newGame}>
                NEW GAME
              </TerminalButton>
            </section>
          )}
          <MarketPanel config={config} state={state} dispatch={dispatch} llmAvailable={llmAvailable} onTalkToNpc={openConversation} />
          <StreetIntelPanel config={config} state={state} dispatch={dispatch} llmAvailable={llmAvailable} onTalkToNpc={openConversation} />
          <EventLog state={state} />
          <ServicePanel config={config} state={state} dispatch={dispatch} />
        </section>

        <aside className="right-column">
          <TravelPanel config={config} state={state} dispatch={dispatch} />
        </aside>
      </div>

      {activeOutcome && (
        <OutcomeOverlay
          actions={[...dealerActions, ...hoboActions]}
          canFight={canFight}
          config={config}
          conversationTarget={outcomeConversation}
          entries={activeOutcome.entries}
          id={activeOutcome.id}
          npcDialogue={visibleOutcomeDialogue}
          npcName={activeOutcome.npcName}
          ollamaStatus={ollamaStatus}
          onAnswer={(answer) => dispatch({ type: "answerPrompt", answer })}
          onClose={activeOutcome.prompt ? undefined : () => setOutcome(null)}
          onRemember={(npcId, kind, text) => dispatch({ type: "rememberNpc", npcId, kind, text })}
          prompt={activeOutcome.prompt}
          title={activeOutcome.title}
          tone={activeOutcome.tone}
        />
      )}

      {conversation && (
        <ConversationOverlay
          config={config}
          ollamaStatus={ollamaStatus}
          onRemember={(npcId, kind, text) => dispatch({ type: "rememberNpc", npcId, kind, text })}
          onClose={() => setConversation(null)}
          target={conversation}
        />
      )}

      {profilePromptOpen && (
        <DealerNamePrompt
          currentName={dealerProfile?.name}
          onCancel={dealerProfile ? () => setProfilePromptOpen(false) : undefined}
          onSubmit={startDealerProfile}
        />
      )}

    </main>
  );
}

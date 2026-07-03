import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationOverlay, type NpcConversationTarget } from "./components/ConversationOverlay";
import { EventLog } from "./components/EventLog";
import { FinancePanel } from "./components/FinancePanel";
import { InventoryPanel } from "./components/InventoryPanel";
import { MarketPanel } from "./components/MarketPanel";
import { OutcomeOverlay } from "./components/OutcomeOverlay";
import { PromptPanel } from "./components/PromptPanel";
import { ServicePanel } from "./components/ServicePanel";
import { StatusBar } from "./components/StatusBar";
import { StreetIntelPanel } from "./components/StreetIntelPanel";
import { TerminalButton } from "./components/TerminalButton";
import { TravelPanel } from "./components/TravelPanel";
import { DEFAULT_GAME_CONFIG } from "./game/config";
import { applyCommand, createGame, hoboIntelPrice, hydrateGameState } from "./game/engine";
import { formatMoney } from "./game/format";
import type { EventLogEntry, GameCommand, GameConfig, GameState, Tone } from "./game/types";
import { useNpcDialogue } from "./hooks/useNpcDialogue";
import { useOllamaAvailability } from "./hooks/useOllamaAvailability";

const SAVE_KEY = "harbour-hustle-state-v1";
const PRE_RENAME_SAVE_PREFIX = ["dope", "wars-web-state-v"].join("");
const LEGACY_SAVE_KEYS = [
  "harbour-hustle-state-v0",
  `${PRE_RENAME_SAVE_PREFIX}4`,
  `${PRE_RENAME_SAVE_PREFIX}3`,
  `${PRE_RENAME_SAVE_PREFIX}2`,
  `${PRE_RENAME_SAVE_PREFIX}1`,
];

interface ActionOutcome {
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

function loadState(): GameState {
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
      const state = hydrateGameState(DEFAULT_GAME_CONFIG, JSON.parse(saved) as GameState);
      if (key !== SAVE_KEY) {
        window.localStorage.removeItem(key);
      }
      return state;
    } catch {
      window.localStorage.removeItem(key);
    }
  }

  return createGame(DEFAULT_GAME_CONFIG);
}

function shouldShowOutcome(command: GameCommand): boolean {
  return command.type === "robDealer" ||
    command.type === "buyHoboIntel" ||
    command.type === "threatenHobo" ||
    command.type === "answerPrompt";
}

function outcomeTitle(command: GameCommand): string {
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

function outcomeNpc(
  config: GameConfig,
  command: GameCommand,
  previous: GameState,
): { id: string; name: string; role: string } | null {
  if (command.type === "buyHoboIntel" || command.type === "threatenHobo") {
    const hobo = config.hobos.find((item) => item.id === command.hoboId);
    return hobo ? { id: hobo.id, name: hobo.name, role: "street intel contact and hobo" } : null;
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

  return null;
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
  const opener = "A potential buyer approaches you and says hello.";
  const common = [
    opener,
    `${npc.name} is a ${npc.role}.`,
    `Player location id: ${next.player.locationId}. Player cash: ${next.player.cash}. Player reputation: ${next.player.reputation}.`,
    "Recent mechanical outcome:",
    summary,
  ];

  if (command.type === "buyHoboIntel") {
    common.push("The player just bought or received intel from you. Say what you say while handing over the information.");
  } else if (command.type === "threatenHobo") {
    common.push("The player just threatened you for intel. React to the threat and outcome.");
  } else if (command.type === "robDealer") {
    common.push("The player just tried to rob you. React to the robbery outcome.");
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

  const entries = newEntries(previous, next);
  const prompt = next.pendingPrompt;
  if (entries.length === 0 && !prompt) {
    return null;
  }

  const npc = outcomeNpc(config, command, previous);

  return {
    dialogueFallback: npc ? `${npc.name} watches how you react.` : "",
    dialogueScene: outcomeScene(command, npc, entries, previous, next),
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

export default function App() {
  const config = DEFAULT_GAME_CONFIG;
  const ollamaStatus = useOllamaAvailability(config);
  const llmAvailable = ollamaStatus === "available";
  const [state, setState] = useState<GameState>(() => loadState());
  const [outcome, setOutcome] = useState<ActionOutcome | null>(null);
  const [conversation, setConversation] = useState<NpcConversationTarget | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      // localStorage can be unavailable or full; the active in-memory game still works.
    }
  }, [state]);

  const dispatch = useCallback(
    (command: GameCommand) => {
      const current = stateRef.current;
      const next = applyCommand(config, current, command);
      stateRef.current = next;
      setState(next);
      const nextOutcome = buildOutcome(config, command, current, next);
      if (nextOutcome) {
        setOutcome(nextOutcome);
      }
    },
    [config],
  );

  const newGame = useCallback(() => {
    const next = createGame(config);
    stateRef.current = next;
    setState(next);
    setOutcome(null);
    setConversation(null);
  }, [config]);

  const openConversation = useCallback((target: NpcConversationTarget) => {
    setConversation(target);
  }, []);

  const canFight = Object.values(state.player.guns).some((item) => item.carried > 0);
  const outcomeHobo = outcome?.hoboId ? config.hobos.find((hobo) => hobo.id === outcome.hoboId) : null;
  const outcomeHoboIsHere = outcomeHobo?.locationId === state.player.locationId;
  const outcomeHoboIntelPrice = outcomeHobo ? hoboIntelPrice(config, state, outcomeHobo) : 0;
  const outcomeLocked = state.pendingPrompt !== null || state.gameOver || !outcomeHoboIsHere;
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
    disabled: !outcome?.npcId,
    fallback: outcome?.dialogueFallback ?? "",
    llmAvailable,
    npcId: outcome?.npcId,
    npcName: outcome?.npcName,
    refreshKey: outcome?.id ?? null,
    scene: outcome?.dialogueScene ?? "",
  });
  const outcomeConversation = outcome?.npcId && outcome.npcName ? {
    fallback: outcome.dialogueFallback,
    id: outcome.npcId,
    name: outcome.npcName,
    openingLine: outcomeDialogue.text,
    role: outcome.npcRole ?? "encounter NPC",
    scene: [
      outcome.dialogueScene,
      "The player opened a typed follow-up conversation from the action report window.",
    ].join("\n"),
    title: `TALK TO ${outcome.npcName.toUpperCase()}`,
    tone: outcome.tone,
  } satisfies NpcConversationTarget : null;

  return (
    <main className="terminal-shell">
      <StatusBar config={config} state={state} onNewGame={newGame} />

      <div className="app-grid">
        <aside className="left-column">
          <InventoryPanel config={config} state={state} />
          <FinancePanel config={config} state={state} dispatch={dispatch} />
        </aside>

        <section className="center-column">
          <PromptPanel config={config} state={state} dispatch={dispatch} llmAvailable={llmAvailable} />
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

      {outcome && (
        <OutcomeOverlay
          actions={hoboActions}
          canFight={canFight}
          entries={outcome.entries}
          id={outcome.id}
          npcDialogue={outcomeDialogue.text}
          npcName={outcome.npcName}
          onAnswer={(answer) => dispatch({ type: "answerPrompt", answer })}
          onClose={() => setOutcome(null)}
          onTalk={outcomeConversation ? () => openConversation(outcomeConversation) : undefined}
          prompt={outcome.prompt}
          title={outcome.title}
          tone={outcome.tone}
        />
      )}

      {conversation && (
        <ConversationOverlay
          config={config}
          ollamaStatus={ollamaStatus}
          onClose={() => setConversation(null)}
          target={conversation}
        />
      )}

    </main>
  );
}

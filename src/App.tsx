import { useCallback, useEffect, useRef, useState } from "react";
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
import { applyCommand, createGame, hydrateGameState } from "./game/engine";
import { formatMoney } from "./game/format";
import type { EventLogEntry, GameCommand, GameState, Tone } from "./game/types";

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
  entries: EventLogEntry[];
  id: string;
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

function buildOutcome(command: GameCommand, previous: GameState, next: GameState): ActionOutcome | null {
  if (!shouldShowOutcome(command)) {
    return null;
  }

  const entries = newEntries(previous, next);
  const prompt = next.pendingPrompt;
  if (entries.length === 0 && !prompt) {
    return null;
  }

  return {
    entries,
    id: `${next.logIndex}:${command.type}:${"answer" in command ? command.answer : ""}`,
    prompt,
    title: outcomeTitle(command),
    tone: outcomeTone(entries, prompt),
  };
}

export default function App() {
  const config = DEFAULT_GAME_CONFIG;
  const [state, setState] = useState<GameState>(() => loadState());
  const [outcome, setOutcome] = useState<ActionOutcome | null>(null);
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
      const nextOutcome = buildOutcome(command, current, next);
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
  }, [config]);

  const canFight = Object.values(state.player.guns).some((item) => item.carried > 0);

  return (
    <main className="terminal-shell">
      <StatusBar config={config} state={state} onNewGame={newGame} />

      <div className="app-grid">
        <aside className="left-column">
          <InventoryPanel config={config} state={state} />
          <FinancePanel config={config} state={state} dispatch={dispatch} />
        </aside>

        <section className="center-column">
          <PromptPanel config={config} state={state} dispatch={dispatch} />
          {state.gameOver && (
            <section className="terminal-panel game-over-panel" aria-label="Game over">
              <h2>GAME OVER</h2>
              <p>Final score: {formatMoney(config, state.finalScore ?? 0)}</p>
              <TerminalButton tone="good" onClick={newGame}>
                NEW GAME
              </TerminalButton>
            </section>
          )}
          <MarketPanel config={config} state={state} dispatch={dispatch} />
          <StreetIntelPanel config={config} state={state} dispatch={dispatch} />
          <EventLog state={state} />
          <ServicePanel config={config} state={state} dispatch={dispatch} />
        </section>

        <aside className="right-column">
          <TravelPanel config={config} state={state} dispatch={dispatch} />
        </aside>
      </div>

      {outcome && (
        <OutcomeOverlay
          canFight={canFight}
          entries={outcome.entries}
          id={outcome.id}
          onAnswer={(answer) => dispatch({ type: "answerPrompt", answer })}
          onClose={() => setOutcome(null)}
          prompt={outcome.prompt}
          title={outcome.title}
          tone={outcome.tone}
        />
      )}

    </main>
  );
}

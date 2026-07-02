import { useCallback, useEffect, useMemo, useState } from "react";
import { EventLog } from "./components/EventLog";
import { FinancePanel } from "./components/FinancePanel";
import { InventoryPanel } from "./components/InventoryPanel";
import { MarketPanel } from "./components/MarketPanel";
import { PromptPanel } from "./components/PromptPanel";
import { ServicePanel } from "./components/ServicePanel";
import { StatusBar } from "./components/StatusBar";
import { StreetIntelPanel } from "./components/StreetIntelPanel";
import { TerminalButton } from "./components/TerminalButton";
import { TravelPanel } from "./components/TravelPanel";
import { DEFAULT_GAME_CONFIG } from "./game/config";
import { applyCommand, createGame, hydrateGameState } from "./game/engine";
import { formatMoney } from "./game/format";
import type { GameCommand, GameState } from "./game/types";

const SAVE_KEY = "dopewars-web-state-v4";
const LEGACY_SAVE_KEYS = ["dopewars-web-state-v3", "dopewars-web-state-v2", "dopewars-web-state-v1"];

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

export default function App() {
  const config = DEFAULT_GAME_CONFIG;
  const [state, setState] = useState<GameState>(() => loadState());

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      // localStorage can be unavailable or full; the active in-memory game still works.
    }
  }, [state]);

  const dispatch = useCallback(
    (command: GameCommand) => {
      setState((current) => applyCommand(config, current, command));
    },
    [config],
  );

  const newGame = useCallback(() => {
    setState(createGame(config));
  }, [config]);

  const configSummary = useMemo(
    () =>
      `${config.locations.length} LOC / ${config.dealers.length} DEALER / ${config.hobos.length} INTEL / ${config.drugs.length} DRUG / ${config.guns.length} GUN / JSON CONFIG`,
    [config],
  );

  return (
    <main className="terminal-shell">
      <StatusBar config={config} state={state} />

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
          <section className="terminal-panel config-panel" aria-label="Configuration">
            <h2>CONFIG</h2>
            <p>{configSummary}</p>
            <p>Seed: {state.rngState}</p>
            <TerminalButton tone="warn" onClick={newGame}>
              RESET
            </TerminalButton>
          </section>
        </aside>
      </div>

      <footer className="command-line" aria-label="Command line">
        <span>COMMAND:</span>
        <span className="cursor">{state.pendingPrompt ? "ANSWER" : state.gameOver ? "NEW GAME" : state.lastCommand}</span>
      </footer>
    </main>
  );
}

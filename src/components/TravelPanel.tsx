import { TerminalButton } from "./TerminalButton";
import { effectivePolicePresence, locationInfluence } from "../game/engine";
import type { GameCommand, GameConfig, GameState } from "../game/types";

interface TravelPanelProps {
  config: GameConfig;
  state: GameState;
  dispatch: (command: GameCommand) => void;
}

function riskFor(policePresence: number): "LOW" | "MED" | "HIGH" {
  if (policePresence >= 65) {
    return "HIGH";
  }
  if (policePresence >= 25) {
    return "MED";
  }
  return "LOW";
}

function turfClass(value: number): string {
  if (value < -20) {
    return "money-bad";
  }
  if (value > 20) {
    return "money-good";
  }
  return value < 0 ? "money-warn" : "";
}

export function TravelPanel({ config, state, dispatch }: TravelPanelProps) {
  return (
    <section className="terminal-panel travel-panel" aria-label="Travel">
      <h2>TRAVEL</h2>
      <p className="panel-caption">SELECT ACTION</p>
      <TerminalButton
        className="stay-row"
        tone="good"
        disabled={state.pendingPrompt !== null || state.gameOver}
        onClick={() => dispatch({ type: "stay" })}
      >
        STAY HERE
      </TerminalButton>
      <div className="travel-list">
        {config.locations.map((location) => {
          const active = location.id === state.player.locationId;
          const policePresence = effectivePolicePresence(config, state, location);
          const risk = riskFor(policePresence);
          const influence = locationInfluence(state, location.id);
          return (
            <TerminalButton
              key={location.id}
              className={`travel-row ${active ? "is-active" : ""}`}
              disabled={active || state.pendingPrompt !== null || state.gameOver}
              aria-current={active ? "location" : undefined}
              onClick={() => dispatch({ type: "travel", locationId: location.id })}
            >
              <span className="travel-location-name">
                {location.name}
                {active && <span className="travel-current-label">CURRENT</span>}
              </span>
              <span className="travel-location-stats">
                <span>{policePresence}% police</span>
                <span className={turfClass(influence)}>Turf {influence}</span>
                <span className={risk === "HIGH" ? "money-bad" : risk === "MED" ? "money-warn" : "money-good"}>{risk} risk</span>
              </span>
            </TerminalButton>
          );
        })}
      </div>
      <div className="travel-info">
        <h3>TRAVEL INFO</h3>
        <p>Stay advances one day here.</p>
        <p>Travel advances one day.</p>
        <p>Police % reflects rep and turf.</p>
        <p>Turf rises from trade and gifts; threats and robberies damage it.</p>
        <p>Debt interest: {config.debtInterest}% daily.</p>
        <p>Bank interest: {config.bankInterest}% daily.</p>
      </div>
    </section>
  );
}

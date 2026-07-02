import { useEffect, useState } from "react";
import { TerminalButton } from "./TerminalButton";
import { hoboIntelPrice } from "../game/engine";
import { formatMoney, parseAmount } from "../game/format";
import type { GameCommand, GameConfig, GameState, HoboConfig } from "../game/types";

interface StreetIntelPanelProps {
  config: GameConfig;
  state: GameState;
  dispatch: (command: GameCommand) => void;
}

function relationshipLabel(value: number): "HOSTILE" | "COLD" | "NEUTRAL" | "WARM" | "TRUSTED" {
  if (value < -40) {
    return "HOSTILE";
  }
  if (value < 0) {
    return "COLD";
  }
  if (value < 35) {
    return "NEUTRAL";
  }
  if (value < 70) {
    return "WARM";
  }
  return "TRUSTED";
}

function relationshipClass(value: number): string {
  if (value < -40) {
    return "money-bad";
  }
  if (value < 0) {
    return "money-warn";
  }
  if (value >= 70) {
    return "money-good";
  }
  return "";
}

function hoboDanger(hobo: HoboConfig): "LOW" | "MED" | "HIGH" {
  if (hobo.toughness >= 45) {
    return "HIGH";
  }
  if (hobo.toughness >= 28) {
    return "MED";
  }
  return "LOW";
}

export function StreetIntelPanel({ config, state, dispatch }: StreetIntelPanelProps) {
  const [selectedHoboId, setSelectedHoboId] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const currentHobos = config.hobos.filter((hobo) => hobo.locationId === state.player.locationId);
  const selectedHobo = currentHobos.find((hobo) => hobo.id === selectedHoboId) ?? currentHobos[0] ?? null;
  const carriedDrugs = config.drugs.filter((drug) => state.player.drugs[drug.id].carried > 0);

  useEffect(() => {
    if (!selectedHobo || selectedHobo.id !== selectedHoboId) {
      setSelectedHoboId(selectedHobo?.id ?? null);
    }
  }, [selectedHobo, selectedHoboId]);

  function amountFor(drugId: string): number {
    return parseAmount(amounts[drugId] ?? "1");
  }

  if (!selectedHobo) {
    return (
      <section className="terminal-panel street-intel-panel" aria-label="Street intel">
        <h2>STREET INTEL</h2>
        <p className="is-empty">Nobody is talking here.</p>
      </section>
    );
  }

  const relationship = state.hoboRelationships?.[selectedHobo.id] ?? 0;
  const price = hoboIntelPrice(config, state, selectedHobo);
  const danger = hoboDanger(selectedHobo);
  const localReports = state.intelReports.filter((report) => report.locationId === state.player.locationId).slice(0, 4);

  return (
    <section className="terminal-panel street-intel-panel" aria-label="Street intel">
      <div className="section-heading">
        <h2>STREET INTEL</h2>
        <span>{state.lastCommand}</span>
      </div>

      <div className="hobo-selector" aria-label="Hobos">
        {currentHobos.map((hobo) => {
          const hoboRelationship = state.hoboRelationships?.[hobo.id] ?? 0;
          return (
            <TerminalButton
              key={hobo.id}
              className={hobo.id === selectedHobo.id ? "hobo-tab is-active" : "hobo-tab"}
              onClick={() => setSelectedHoboId(hobo.id)}
            >
              {hobo.name}
              <span className={relationshipClass(hoboRelationship)}>{relationshipLabel(hoboRelationship)}</span>
            </TerminalButton>
          );
        })}
      </div>

      <div className="hobo-card">
        <div>
          <h3>{selectedHobo.name}</h3>
          <dl className="dealer-stats">
            <div>
              <dt>Relationship</dt>
              <dd className={relationshipClass(relationship)}>
                {relationshipLabel(relationship)} {relationship}
              </dd>
            </div>
            <div>
              <dt>Intel price</dt>
              <dd className={price === 0 ? "money-good" : ""}>{price === 0 ? "FREE" : formatMoney(config, price)}</dd>
            </div>
            <div>
              <dt>Quality</dt>
              <dd>{selectedHobo.intelQuality}</dd>
            </div>
            <div>
              <dt>Danger</dt>
              <dd className={danger === "HIGH" ? "money-bad" : danger === "MED" ? "money-warn" : "money-good"}>{danger}</dd>
            </div>
            <div>
              <dt>Likes</dt>
              <dd>{selectedHobo.favoriteDrugIds.map((drugId) => config.drugs.find((drug) => drug.id === drugId)?.name ?? drugId).join("/")}</dd>
            </div>
          </dl>
        </div>
        <div className="hobo-actions">
          <TerminalButton
            tone={price === 0 ? "good" : "default"}
            disabled={state.pendingPrompt !== null || state.gameOver || price > state.player.cash}
            onClick={() => dispatch({ type: "buyHoboIntel", hoboId: selectedHobo.id })}
          >
            INFO
          </TerminalButton>
          <TerminalButton
            tone="bad"
            disabled={state.pendingPrompt !== null || state.gameOver}
            onClick={() => dispatch({ type: "threatenHobo", hoboId: selectedHobo.id })}
          >
            THREATEN
          </TerminalButton>
        </div>
      </div>

      {carriedDrugs.length > 0 ? (
        <div className="hobo-gifts">
          <h3>GIFTS</h3>
          <table className="terminal-table compact-table">
            <thead>
              <tr>
                <th>Drug</th>
                <th>Held</th>
                <th>Qty</th>
                <th>Command</th>
              </tr>
            </thead>
            <tbody>
              {carriedDrugs.map((drug) => {
                const inventory = state.player.drugs[drug.id];
                const amount = amountFor(drug.id);
                return (
                  <tr key={drug.id}>
                    <td>{drug.name}</td>
                    <td>{inventory.carried}</td>
                    <td>
                      <input
                        aria-label={`${drug.name} hobo gift quantity`}
                        inputMode="numeric"
                        min={0}
                        value={amounts[drug.id] ?? "1"}
                        onChange={(event) => setAmounts((current) => ({ ...current, [drug.id]: event.target.value }))}
                      />
                    </td>
                    <td className="command-cell">
                      <TerminalButton
                        tone="good"
                        disabled={amount <= 0 || amount > inventory.carried || state.pendingPrompt !== null}
                        onClick={() => dispatch({ type: "giftHoboDrug", hoboId: selectedHobo.id, drugId: drug.id, amount })}
                      >
                        GIFT
                      </TerminalButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="is-empty">Carry drugs if you want to gift this contact.</p>
      )}

      <div className="intel-feed">
        <h3>RECENT INTEL</h3>
        {localReports.length > 0 ? (
          <ol>
            {localReports.map((report) => (
              <li key={report.id} className={report.accurate ? "" : "money-warn"}>
                <span>{report.topic.toUpperCase()}</span>
                <span>{report.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="is-empty">No local intel yet.</p>
        )}
      </div>
    </section>
  );
}

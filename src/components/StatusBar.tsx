import { formatMoney } from "../game/format";
import { netWorth, totalCapacity } from "../game/engine";
import type { GameConfig, GameState } from "../game/types";
import { TerminalButton } from "./TerminalButton";

interface StatusBarProps {
  config: GameConfig;
  dealerName?: string | null;
  state: GameState;
  onNewGame: () => void;
}

export function StatusBar({ config, dealerName, state, onNewGame }: StatusBarProps) {
  const { player } = state;
  const location = config.locations.find((item) => item.id === player.locationId) ?? config.locations[0];
  const repClass = player.reputation < 0 ? "money-bad" : player.reputation > 0 ? "money-good" : "";
  const netClass = netWorth(player) >= 0 ? "money-good" : "money-bad";

  return (
    <header className="status-grid" aria-label="Game status">
      <div className="brand">
        <span>HARBOUR HUSTLE</span>
        {dealerName && <small className="dealer-profile">DEALER {dealerName}</small>}
      </div>
      <div className="status-location">{location.name.toUpperCase()}</div>
      <div className="status-stat money-good">
        <span>CASH</span>
        <strong>{formatMoney(config, player.cash)}</strong>
      </div>
      <div className="status-stat money-bad">
        <span>DEBT</span>
        <strong>{formatMoney(config, player.debt)}</strong>
      </div>
      <div className="status-stat">
        <span>BANK</span>
        <strong>{formatMoney(config, player.bank)}</strong>
      </div>
      <div className="status-stat">
        <span>HEALTH</span>
        <strong>{player.health}</strong>
      </div>
      <div className="status-stat">
        <span>SPACE</span>
        <strong>{player.space}/{totalCapacity(config, player)}</strong>
      </div>
      <div className={`status-stat ${repClass}`}>
        <span>REP</span>
        <strong>{player.reputation}</strong>
      </div>
      <div className={`status-stat ${netClass}`}>
        <span>NET</span>
        <strong>{formatMoney(config, netWorth(player))}</strong>
      </div>
      <div className="status-action">
        <TerminalButton className="status-new-game" tone="warn" onClick={onNewGame}>
          NEW GAME
        </TerminalButton>
      </div>
    </header>
  );
}

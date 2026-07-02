import { formatMoney } from "../game/format";
import { netWorth, totalCapacity } from "../game/engine";
import type { GameConfig, GameState } from "../game/types";

interface StatusBarProps {
  config: GameConfig;
  state: GameState;
}

export function StatusBar({ config, state }: StatusBarProps) {
  const { player } = state;
  const location = config.locations.find((item) => item.id === player.locationId) ?? config.locations[0];

  return (
    <header className="status-grid" aria-label="Game status">
      <div className="brand">HARBOUR HUSTLE</div>
      <div className="status-location">{location.name.toUpperCase()}</div>
      <div className="money-good">CASH {formatMoney(config, player.cash)}</div>
      <div className="money-bad">DEBT {formatMoney(config, player.debt)}</div>
      <div>BANK {formatMoney(config, player.bank)}</div>
      <div>HEALTH {player.health}</div>
      <div>
        SPACE {player.space}/{totalCapacity(config, player)}
      </div>
      <div className={player.reputation < 0 ? "money-bad" : player.reputation > 0 ? "money-good" : ""}>REP {player.reputation}</div>
      <div className={netWorth(player) >= 0 ? "money-good" : "money-bad"}>
        NET {formatMoney(config, netWorth(player))}
      </div>
    </header>
  );
}

import { formatMoney } from "../game/format";
import { locationInfluence, totalCapacity } from "../game/engine";
import type { GameConfig, GameState } from "../game/types";

interface InventoryPanelProps {
  config: GameConfig;
  state: GameState;
}

export function InventoryPanel({ config, state }: InventoryPanelProps) {
  const capacity = totalCapacity(config, state.player);
  const used = capacity - state.player.space;
  const usedPercent = capacity > 0 ? Math.max(0, Math.min(100, (used / capacity) * 100)) : 0;
  const currentTurf = locationInfluence(state, state.player.locationId);

  return (
    <section className="terminal-panel panel-stack" aria-label="Player inventory">
      <div>
        <h2>PLAYER STATS</h2>
        <dl className="stats-list">
          <div>
            <dt>Turn</dt>
            <dd>
              {state.player.turn}/{config.numTurns}
            </dd>
          </div>
          <div>
            <dt>Health</dt>
            <dd>{state.player.health}</dd>
          </div>
          <div>
            <dt>{config.names.helperPlural}</dt>
            <dd>{state.player.helpers}</dd>
          </div>
          <div>
            <dt>{config.names.gunPlural}</dt>
            <dd>{Object.values(state.player.guns).reduce((sum, item) => sum + item.carried, 0)}</dd>
          </div>
          <div>
            <dt>Reputation</dt>
            <dd className={state.player.reputation < 0 ? "money-bad" : state.player.reputation > 0 ? "money-good" : ""}>
              {state.player.reputation}
            </dd>
          </div>
          <div>
            <dt>Turf</dt>
            <dd className={currentTurf < 0 ? "money-bad" : currentTurf > 0 ? "money-good" : ""}>{currentTurf}</dd>
          </div>
        </dl>
      </div>

      <div>
        <h2>INVENTORY</h2>
        <table className="terminal-table compact-table">
          <thead>
            <tr>
              <th>Drug</th>
              <th>Qty</th>
              <th>Purchase</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {config.drugs.map((drug) => {
              const inventory = state.player.drugs[drug.id];
              const average = inventory.carried > 0 ? Math.floor(inventory.totalValue / inventory.carried) : 0;
              return (
                <tr key={drug.id} className={inventory.carried === 0 ? "is-empty" : ""}>
                  <td>{drug.name}</td>
                  <td>{inventory.carried}</td>
                  <td>{average ? formatMoney(config, average) : "--"}</td>
                  <td>{inventory.totalValue ? formatMoney(config, inventory.totalValue) : "--"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h2>{config.names.gunPlural}</h2>
        <table className="terminal-table compact-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Space</th>
              <th>Damage</th>
            </tr>
          </thead>
          <tbody>
            {config.guns.map((gun) => {
              const carried = state.player.guns[gun.id]?.carried ?? 0;
              return (
                <tr key={gun.id} className={carried === 0 ? "is-empty" : ""}>
                  <td>{gun.name}</td>
                  <td>{carried}</td>
                  <td>{gun.space}</td>
                  <td>{gun.damage}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h2>CARRYING CAPACITY</h2>
        <div className="capacity-meter" aria-label={`${used} used out of ${capacity}`}>
          <span style={{ inlineSize: `${usedPercent}%` }} />
        </div>
        <dl className="stats-list stats-list--tight">
          <div>
            <dt>Used space</dt>
            <dd>{used}</dd>
          </div>
          <div>
            <dt>Free space</dt>
            <dd>{state.player.space}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

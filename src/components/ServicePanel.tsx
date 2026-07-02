import { useState } from "react";
import { TerminalButton } from "./TerminalButton";
import { formatMoney, parseAmount } from "../game/format";
import type { GameCommand, GameConfig, GameState } from "../game/types";

interface ServicePanelProps {
  config: GameConfig;
  state: GameState;
  dispatch: (command: GameCommand) => void;
}

export function ServicePanel({ config, state, dispatch }: ServicePanelProps) {
  const [gunAmounts, setGunAmounts] = useState<Record<string, string>>({});
  const [helperAmount, setHelperAmount] = useState("1");
  const atGunShop = state.player.locationId === config.serviceLocations.gunShop;
  const atPub = state.player.locationId === config.serviceLocations.roughPub;

  return (
    <section className="terminal-panel service-panel" aria-label="Local services">
      <h2>LOCAL SERVICES</h2>

      {atGunShop ? (
        <div>
          <h3>{config.names.gunShop.toUpperCase()}</h3>
          <table className="terminal-table compact-table">
            <thead>
              <tr>
                <th>Gun</th>
                <th>Price</th>
                <th>Space</th>
                <th>Held</th>
                <th>Qty</th>
                <th>Command</th>
              </tr>
            </thead>
            <tbody>
              {config.guns.map((gun) => {
                const amount = parseAmount(gunAmounts[gun.id] ?? "1");
                return (
                  <tr key={gun.id}>
                    <td>{gun.name}</td>
                    <td>{formatMoney(config, gun.price)}</td>
                    <td>{gun.space}</td>
                    <td>{state.player.guns[gun.id].carried}</td>
                    <td>
                      <input
                        aria-label={`${gun.name} quantity`}
                        value={gunAmounts[gun.id] ?? "1"}
                        onChange={(event) => setGunAmounts((current) => ({ ...current, [gun.id]: event.target.value }))}
                      />
                    </td>
                    <td className="command-cell">
                      <TerminalButton onClick={() => dispatch({ type: "buyGun", gunId: gun.id, amount })}>BUY</TerminalButton>
                      <TerminalButton onClick={() => dispatch({ type: "sellGun", gunId: gun.id, amount })}>SELL</TerminalButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="panel-caption">{config.names.gunShop}: Ghetto.</p>
      )}

      {atPub ? (
        <div className="helper-hire">
          <h3>{config.names.roughPub.toUpperCase()}</h3>
          <p>
            Hire a {config.names.helperSingular} for{" "}
            {state.currentHelperPrice ? formatMoney(config, state.currentHelperPrice) : "--"}.
          </p>
          <div className="inline-form">
            <input
              aria-label={`${config.names.helperPlural} quantity`}
              value={helperAmount}
              onChange={(event) => setHelperAmount(event.target.value)}
            />
            <TerminalButton
              onClick={() => dispatch({ type: "hireHelper", amount: parseAmount(helperAmount) })}
              disabled={!state.currentHelperPrice}
            >
              HIRE
            </TerminalButton>
          </div>
        </div>
      ) : (
        <p className="panel-caption">{config.names.roughPub}: Ghetto.</p>
      )}
    </section>
  );
}

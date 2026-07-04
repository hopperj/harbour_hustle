import { useState } from "react";
import { TerminalButton } from "./TerminalButton";
import { formatMoney, parseAmount } from "../game/format";
import { merchantQuote, merchantsForLocation } from "../game/engine";
import type { GameCommand, GameConfig, GameState } from "../game/types";

interface ServicePanelProps {
  config: GameConfig;
  state: GameState;
  dispatch: (command: GameCommand) => void;
}

export function ServicePanel({ config, state, dispatch }: ServicePanelProps) {
  const [gunAmounts, setGunAmounts] = useState<Record<string, string>>({});
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [helperAmount, setHelperAmount] = useState("1");
  const atPub = state.player.locationId === config.serviceLocations.roughPub;
  const localMerchants = merchantsForLocation(config, state.player.locationId);
  const selectedMerchant =
    localMerchants.find((merchant) => merchant.id === selectedMerchantId) ?? localMerchants[0] ?? null;
  const merchantLocations = Array.from(
    new Set(
      config.merchants.map((merchant) => config.locations.find((location) => location.id === merchant.locationId)?.name ?? merchant.locationId),
    ),
  ).join(", ");
  const pubLocation = config.locations.find((location) => location.id === config.serviceLocations.roughPub)?.name ?? "unknown";

  return (
    <section className="terminal-panel service-panel" aria-label="Local services">
      <h2>LOCAL SERVICES</h2>

      {selectedMerchant ? (
        <div>
          <h3>MERCHANTS</h3>
          {localMerchants.length > 1 ? (
            <div className="merchant-selector" aria-label="Merchants">
              {localMerchants.map((merchant) => (
                <TerminalButton
                  key={merchant.id}
                  className={merchant.id === selectedMerchant.id ? "dealer-tab is-active" : "dealer-tab"}
                  onClick={() => setSelectedMerchantId(merchant.id)}
                >
                  {merchant.name}
                  <span>MERCHANT</span>
                </TerminalButton>
              ))}
            </div>
          ) : (
            <p className="panel-caption">{selectedMerchant.name}</p>
          )}
          <table className="terminal-table compact-table service-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Buy</th>
                <th>Sell</th>
                <th>Space</th>
                <th>Held</th>
                <th>Qty</th>
                <th>Command</th>
              </tr>
            </thead>
            <tbody>
              {config.guns.map((gun) => {
                const amount = parseAmount(gunAmounts[gun.id] ?? "1");
                const quote = merchantQuote(state, selectedMerchant.id, gun.id);
                const stocksItem = selectedMerchant.gunIds.includes(gun.id);
                const held = state.player.guns[gun.id]?.carried ?? 0;
                return (
                  <tr key={gun.id} className={!stocksItem && held === 0 ? "is-unavailable" : ""}>
                    <td>{gun.name}</td>
                    <td>{stocksItem && quote ? formatMoney(config, quote.price) : "--"}</td>
                    <td>{quote ? formatMoney(config, quote.bidPrice) : "--"}</td>
                    <td>{gun.space}</td>
                    <td>{held}</td>
                    <td>
                      <input
                        aria-label={`${gun.name} quantity`}
                        value={gunAmounts[gun.id] ?? "1"}
                        onChange={(event) => setGunAmounts((current) => ({ ...current, [gun.id]: event.target.value }))}
                      />
                    </td>
                    <td className="command-cell">
                      <TerminalButton
                        onClick={() => dispatch({ type: "buyGun", merchantId: selectedMerchant.id, gunId: gun.id, amount })}
                        disabled={!stocksItem || !quote}
                      >
                        BUY
                      </TerminalButton>
                      <TerminalButton
                        onClick={() => dispatch({ type: "sellGun", merchantId: selectedMerchant.id, gunId: gun.id, amount })}
                        disabled={held <= 0 || !quote}
                      >
                        SELL
                      </TerminalButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="panel-caption">Merchants trade in {merchantLocations}.</p>
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
        <p className="panel-caption">{config.names.roughPub}: {pubLocation}.</p>
      )}
    </section>
  );
}

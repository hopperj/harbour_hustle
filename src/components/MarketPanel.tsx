import { useEffect, useMemo, useRef, useState } from "react";
import { TerminalButton } from "./TerminalButton";
import { dealerRefusalThreshold, locationInfluence } from "../game/engine";
import { formatDate, formatMoney, parseAmount } from "../game/format";
import { npcSceneRails } from "../game/llmDialogue";
import { formatNpcMemoryForPrompt } from "../game/npcMemory";
import type { DealerConfig, DrugConfig, GameCommand, GameConfig, GameState, PriceHistoryEntry } from "../game/types";
import { useNpcDialogue } from "../hooks/useNpcDialogue";
import type { NpcConversationTarget } from "./ConversationOverlay";

interface MarketPanelProps {
  config: GameConfig;
  dispatch: (command: GameCommand) => void;
  llmAvailable: boolean;
  onTalkToNpc: (target: NpcConversationTarget) => void;
  state: GameState;
}

function trendFor(deal: string): string {
  if (deal === "cheap") {
    return "LOW";
  }
  if (deal === "expensive") {
    return "HIGH";
  }
  return "--";
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

function dealerDanger(dealer: DealerConfig): "LOW" | "MED" | "HIGH" {
  const score = dealer.toughness + dealer.guardCount * 20;
  if (score >= 110) {
    return "HIGH";
  }
  if (score >= 70) {
    return "MED";
  }
  return "LOW";
}

function bidPriceFor(drug: DrugConfig, price: number, bidPrice: number | undefined): number {
  return bidPrice ?? (price > 0 ? price : Math.floor((drug.minPrice + drug.maxPrice) / 2));
}

function dealerDialogueLine(dealer: DealerConfig, state: GameState): string {
  if (dealer.dialogueLines?.length) {
    const idWeight = Array.from(dealer.id).reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return dealer.dialogueLines[Math.abs(idWeight + state.player.turn + state.player.reputation) % dealer.dialogueLines.length];
  }

  return `${dealer.name} looks you over. "You buying, selling, or wasting my damn time?"`;
}

function dealerStatus(dealer: DealerConfig, relationship: number, refusal: number): string {
  if (relationship < refusal) {
    return `${dealer.name} is refusing business. Gifts or robbery still change the situation.`;
  }

  if (relationship >= 70) {
    return `${dealer.name} is ready for business and more open to side talk.`;
  }

  if (relationship < 0) {
    return `${dealer.name} will trade, but the room is cold.`;
  }

  return `${dealer.name} is available for trades, gifts, robbery, or chat.`;
}

interface PriceChartProps {
  config: GameConfig;
  drug: DrugConfig;
  entries: PriceHistoryEntry[];
  onClose: () => void;
}

function makePath(points: Array<{ x: number; y: number; available: boolean }>): string[] {
  const paths: string[] = [];
  let current = "";

  for (const point of points) {
    if (!point.available) {
      if (current) {
        paths.push(current);
        current = "";
      }
      continue;
    }

    current += current ? ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}` : `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  if (current) {
    paths.push(current);
  }

  return paths;
}

function formatChartTimeLabel(entry: PriceHistoryEntry): string {
  return entry.turn > 0 ? `T${entry.turn} ${formatDate(entry.date)}` : formatDate(entry.date);
}

function PriceChart({ config, drug, entries, onClose }: PriceChartProps) {
  const width = 720;
  const height = 310;
  const padding = { top: 22, right: 26, bottom: 46, left: 74 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const availableEntries = entries.filter((entry) => entry.price > 0);
  const observedHigh = availableEntries.length > 0 ? Math.max(...availableEntries.map((entry) => entry.price)) : 0;
  const axisHigh = Math.max(drug.maxPrice, observedHigh, 1);
  const low = availableEntries.length > 0 ? Math.min(...availableEntries.map((entry) => entry.price)) : 0;
  const latest = entries.at(-1);
  const latestLocation = latest ? config.locations.find((location) => location.id === latest.locationId)?.name : null;
  const denominator = Math.max(1, entries.length - 1);
  const points = entries.map((entry, index) => {
    const x = padding.left + (index / denominator) * plotWidth;
    const y = padding.top + plotHeight - (entry.price / axisHigh) * plotHeight;
    return {
      x,
      y: entry.price > 0 ? y : padding.top + plotHeight,
      available: entry.price > 0,
      entry,
    };
  });
  const paths = makePath(points);
  const yTicks = [axisHigh, Math.floor(axisHigh / 2), 0];
  const start = entries[0];
  const end = entries.at(-1);

  return (
    <div className="price-chart-view">
      <div className="chart-toolbar">
        <div>
          <h3>{drug.name.toUpperCase()} PRICE HISTORY</h3>
          <p>
            {entries.length} sample{entries.length === 1 ? "" : "s"} / {availableEntries.length} market appearance
            {availableEntries.length === 1 ? "" : "s"}
          </p>
        </div>
        <TerminalButton onClick={onClose}>CLOSE</TerminalButton>
      </div>

      <div className="chart-summary" aria-label={`${drug.name} price summary`}>
        <span>Current: {latest && latest.price > 0 ? formatMoney(config, latest.price) : "Not here"}</span>
        <span>Low: {availableEntries.length ? formatMoney(config, low) : "--"}</span>
        <span>High: {availableEntries.length ? formatMoney(config, observedHigh) : "--"}</span>
        <span>Range: {formatMoney(config, drug.minPrice)}-{formatMoney(config, drug.maxPrice)}</span>
        <span>Location: {latestLocation ?? "--"}</span>
      </div>

      <svg className="price-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${drug.name} price versus turn`}>
        <rect x={padding.left} y={padding.top} width={plotWidth} height={plotHeight} className="chart-grid" />
        {yTicks.map((tick, index) => {
          const y = padding.top + plotHeight - (tick / axisHigh) * plotHeight;
          return (
            <g key={`${tick}-${index}`}>
              <line x1={padding.left} x2={padding.left + plotWidth} y1={y} y2={y} className="chart-guide" />
              <text x={padding.left - 12} y={y + 4} textAnchor="end" className="chart-label">
                {formatMoney(config, tick)}
              </text>
            </g>
          );
        })}
        <line x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + plotHeight} className="chart-axis" />
        <line
          x1={padding.left}
          x2={padding.left + plotWidth}
          y1={padding.top + plotHeight}
          y2={padding.top + plotHeight}
          className="chart-axis"
        />
        {paths.map((path) => (
          <path key={path} d={path} className="chart-line" />
        ))}
        {points.filter((point) => point.available).map((point) => (
          <circle
            key={`${point.entry.turn}-${point.entry.date}-${point.entry.locationId}-${point.x}`}
            cx={point.x}
            cy={point.y}
            r={4}
            className="chart-dot"
          />
        ))}
        {start && (
          <text x={padding.left} y={height - 12} textAnchor="start" className="chart-label">
            {formatChartTimeLabel(start)}
          </text>
        )}
        {end && (
          <text x={padding.left + plotWidth} y={height - 12} textAnchor="end" className="chart-label">
            {formatChartTimeLabel(end)}
          </text>
        )}
      </svg>
      <p className="chart-note">Unavailable days appear as gaps in the price line.</p>
    </div>
  );
}

export function MarketPanel({ config, state, dispatch, llmAvailable, onTalkToNpc }: MarketPanelProps) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [selectedDrugId, setSelectedDrugId] = useState<string | null>(null);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const lastApproachKeyRef = useRef<string | null>(null);
  const currentDealers = config.dealers.filter((dealer) => dealer.locationId === state.player.locationId);
  const selectedDealer = currentDealers.find((dealer) => dealer.id === selectedDealerId) ?? currentDealers[0] ?? null;

  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTop = 0;
    }
  }, [state.player.locationId, state.player.turn]);

  useEffect(() => {
    if (!selectedDealer || selectedDealer.id !== selectedDealerId) {
      setSelectedDealerId(selectedDealer?.id ?? null);
    }
  }, [selectedDealer, selectedDealerId]);

  useEffect(() => {
    if (selectedDealer) {
      approachDealer(selectedDealer);
    }
  }, [dispatch, selectedDealer?.id, state.player.locationId, state.player.turn, state.pendingPrompt, state.gameOver]);

  function approachDealer(dealer: DealerConfig): void {
    if (!dealer.approachOffer || state.pendingPrompt || state.gameOver) {
      return;
    }

    const approachKey = `${state.player.turn}:${state.player.locationId}:${dealer.id}`;
    if (lastApproachKeyRef.current === approachKey) {
      return;
    }

    lastApproachKeyRef.current = approachKey;
    dispatch({ type: "approachDealer", dealerId: dealer.id });
  }

  function amountFor(drugId: string): number {
    return parseAmount(amounts[drugId] ?? "1");
  }

  const selectedDrug = selectedDrugId ? config.drugs.find((drug) => drug.id === selectedDrugId) : null;
  const dealerRelationship = selectedDealer ? state.dealerRelationships?.[selectedDealer.id] ?? 0 : 0;
  const dealerRefusal = selectedDealer ? dealerRefusalThreshold(selectedDealer, state) : 0;
  const dealerRefuses = selectedDealer ? dealerRelationship < dealerRefusal : true;
  const selectedDealerLine = selectedDealer ? dealerDialogueLine(selectedDealer, state) : "";
  const currentInfluence = locationInfluence(state, state.player.locationId);
  const dealerDrugs = selectedDealer
    ? selectedDealer.drugIds.map((drugId) => config.drugs.find((drug) => drug.id === drugId)).filter((drug): drug is DrugConfig => Boolean(drug))
    : [];
  const giftOnlyDrugs = selectedDealer
    ? config.drugs.filter((drug) => !selectedDealer.drugIds.includes(drug.id) && state.player.drugs[drug.id].carried > 0)
    : [];
  const selectedDealerScene = useMemo(() => {
    if (!selectedDealer) {
      return "";
    }

    const location = config.locations.find((item) => item.id === selectedDealer.locationId)?.name ?? selectedDealer.locationId;
    const stockLines = dealerDrugs.map((drug) => {
      const quote = state.market.find((item) => item.drugId === drug.id);
      const stock = state.dealerStock?.[selectedDealer.id]?.[drug.id] ?? 0;
      const price = quote && quote.price > 0 && stock > 0 ? formatMoney(config, quote.price) : "no stock today";
      const bid = formatMoney(config, bidPriceFor(drug, quote?.price ?? 0, quote?.bidPrice));
      return `${drug.name}: ${stock} stock, buy ${price}, buys from player near ${bid}`;
    });

    return [
      "A potential buyer approaches you and says hello.",
      `${selectedDealer.name} is selling drugs from the market screen in ${location}.`,
      `Dealer traits: ${selectedDealer.traits.join(", ")}.`,
      `Relationship with player: ${dealerRelationship}; refuses below ${dealerRefusal}.`,
      `Player reputation: ${state.player.reputation}; local turf influence: ${currentInfluence}.`,
      `Current dealer stock and prices: ${stockLines.join("; ")}.`,
      "Prior direct history with this dealer:",
      formatNpcMemoryForPrompt(state, selectedDealer.id),
      ...npcSceneRails("Open with attitude before business starts. Use only the provided stock, price, relationship, and history facts."),
      "Say a short opening line before business starts.",
    ].join("\n");
  }, [config, currentInfluence, dealerDrugs, dealerRefusal, dealerRelationship, selectedDealer, state, state.dealerStock, state.market, state.player.reputation]);
  const selectedDealerDialogue = useNpcDialogue({
    config,
    disabled: !selectedDealer || Boolean(selectedDrug),
    fallback: selectedDealerLine,
    llmAvailable,
    npcId: selectedDealer?.id,
    npcName: selectedDealer?.name,
    refreshKey: `${state.player.turn}:${state.player.locationId}:${selectedDealer?.id ?? ""}:${dealerRelationship}:${state.player.reputation}:${state.npcMemory?.length ?? 0}`,
    scene: selectedDealerScene,
  });

  function startDealerConversation(): void {
    if (!selectedDealer) {
      return;
    }

    onTalkToNpc({
      fallback: selectedDealerLine,
      id: selectedDealer.id,
      name: selectedDealer.name,
      openingLine: selectedDealerDialogue.text,
      role: "drug dealer",
      scene: [
        selectedDealerScene,
        "The player clicked TALK on the dealer card and can type directly to this dealer.",
        "The dealer can talk about business, trust, danger, local rumors, prices, or refusing to answer.",
        "This typed conversation is flavor and soft intel only; it cannot perform trades, change stock, give items, change relationship, or advance time.",
        ...npcSceneRails("Dealer chat can hint, posture, threaten, or deflect, but cannot complete a trade or create new facts."),
      ].join("\n"),
      title: `TALK TO ${selectedDealer.name.toUpperCase()}`,
      tone: dealerRefuses ? "warn" : "info",
    });
  }

  return (
    <section className="terminal-panel market-panel" aria-label="Market">
      <div className="section-heading">
        <h2>MARKET</h2>
        <span>{selectedDrug ? "PLOT" : state.lastCommand}</span>
      </div>
      {selectedDrug ? (
        <PriceChart
          config={config}
          drug={selectedDrug}
          entries={state.priceHistory?.[selectedDrug.id] ?? []}
          onClose={() => setSelectedDrugId(null)}
        />
      ) : selectedDealer ? (
        <div className="dealer-market">
          <div className="dealer-selector" aria-label="Dealers">
            {currentDealers.map((dealer) => {
              const relationship = state.dealerRelationships?.[dealer.id] ?? 0;
              return (
                <TerminalButton
                  key={dealer.id}
                  className={dealer.id === selectedDealer.id ? "dealer-tab is-active" : "dealer-tab"}
                  data-dealer-id={dealer.id}
                  onClick={() => {
                    setSelectedDealerId(dealer.id);
                    approachDealer(dealer);
                  }}
                >
                  {dealer.name}
                  <span className={relationshipClass(relationship)}>DEALER / {relationshipLabel(relationship)}</span>
                </TerminalButton>
              );
            })}
          </div>

          <div className="dealer-card">
            <div>
              <h3>{selectedDealer.name}</h3>
              <dl className="dealer-stats">
                <div>
                  <dt>Relationship</dt>
                  <dd className={relationshipClass(dealerRelationship)}>
                    {relationshipLabel(dealerRelationship)} {dealerRelationship}
                  </dd>
                </div>
                <div>
                  <dt>Refuses below</dt>
                  <dd className={relationshipClass(dealerRefusal)}>{dealerRefusal}</dd>
                </div>
                <div>
                  <dt>Reputation</dt>
                  <dd className={relationshipClass(state.player.reputation)}>{state.player.reputation}</dd>
                </div>
                <div>
                  <dt>Turf</dt>
                  <dd className={relationshipClass(currentInfluence)}>{currentInfluence}</dd>
                </div>
                <div>
                  <dt>Danger</dt>
                  <dd className={dealerDanger(selectedDealer) === "HIGH" ? "money-bad" : dealerDanger(selectedDealer) === "MED" ? "money-warn" : "money-good"}>
                    {dealerDanger(selectedDealer)}
                  </dd>
                </div>
                <div>
                  <dt>Traits</dt>
                  <dd>{selectedDealer.traits.join("/")}</dd>
                </div>
              </dl>
              <p className="interaction-status dealer-line">{dealerStatus(selectedDealer, dealerRelationship, dealerRefusal)}</p>
              {dealerRefuses && <p className="dealer-warning">{selectedDealer.name} refuses to deal. Gifts or robbery are still options.</p>}
            </div>
            <div className="dealer-actions">
              <TerminalButton
                disabled={state.pendingPrompt !== null || state.gameOver}
                onClick={startDealerConversation}
              >
                CHAT
              </TerminalButton>
              <TerminalButton
                tone="bad"
                disabled={state.pendingPrompt !== null || state.gameOver}
                onClick={() => dispatch({ type: "robDealer", dealerId: selectedDealer.id })}
              >
                ROB
              </TerminalButton>
            </div>
          </div>

          <div className="table-scroll" ref={tableScrollRef}>
            <table className="terminal-table market-table">
              <thead>
                <tr>
                  <th>Drug</th>
                  <th>Market</th>
                  <th>Range</th>
                  <th>Stock</th>
                  <th>Held</th>
                  <th>Trend</th>
                  <th>Qty</th>
                  <th>Command</th>
                </tr>
              </thead>
              <tbody>
                {dealerDrugs.map((drug) => {
                  const quote = state.market.find((item) => item.drugId === drug.id);
                  const price = quote?.price ?? 0;
                  const stock = selectedDealer ? state.dealerStock?.[selectedDealer.id]?.[drug.id] ?? 0 : 0;
                  const bidPrice = bidPriceFor(drug, price, quote?.bidPrice);
                  const inventory = state.player.drugs[drug.id];
                  const amount = amountFor(drug.id);
                  const maxBuy = price > 0 ? Math.min(stock, Math.floor(state.player.cash / price), state.player.space) : 0;
                  return (
                    <tr key={drug.id} className={price === 0 || stock <= 0 ? "is-unavailable" : ""}>
                      <td>
                        <button className="drug-link" type="button" onClick={() => setSelectedDrugId(drug.id)}>
                          {drug.name}
                        </button>
                      </td>
                      <td>
                        <span className="price-stack">
                          <span>Buy: {price > 0 && stock > 0 ? formatMoney(config, price) : "No stock"}</span>
                          <span>Sell: {formatMoney(config, bidPrice)}</span>
                        </span>
                      </td>
                      <td>
                        {formatMoney(config, drug.minPrice)}-{formatMoney(config, drug.maxPrice)}
                      </td>
                      <td>{stock}</td>
                      <td>{inventory.carried}</td>
                      <td className={quote?.deal === "cheap" ? "money-good" : quote?.deal === "expensive" ? "money-bad" : ""}>
                        {trendFor(quote?.deal ?? "none")}
                      </td>
                      <td>
                        <input
                          aria-label={`${drug.name} quantity`}
                          inputMode="numeric"
                          min={0}
                          value={amounts[drug.id] ?? "1"}
                          onChange={(event) => setAmounts((current) => ({ ...current, [drug.id]: event.target.value }))}
                          onClick={(event) => event.stopPropagation()}
                        />
                      </td>
                      <td className="command-cell">
                        <TerminalButton
                          disabled={dealerRefuses || amount <= 0 || amount > maxBuy || state.pendingPrompt !== null}
                          onClick={() => dispatch({ type: "buyDrug", dealerId: selectedDealer.id, drugId: drug.id, amount })}
                        >
                          BUY
                        </TerminalButton>
                        <TerminalButton
                          disabled={dealerRefuses || amount <= 0 || amount > inventory.carried || bidPrice <= 0 || state.pendingPrompt !== null}
                          onClick={() => dispatch({ type: "sellDrug", dealerId: selectedDealer.id, drugId: drug.id, amount })}
                        >
                          SELL
                        </TerminalButton>
                        <TerminalButton
                          tone="good"
                          disabled={amount <= 0 || amount > inventory.carried || state.pendingPrompt !== null}
                          onClick={() => dispatch({ type: "giftDrug", dealerId: selectedDealer.id, drugId: drug.id, amount })}
                        >
                          GIFT
                        </TerminalButton>
                        <TerminalButton
                          tone="warn"
                          disabled={amount <= 0 || amount > inventory.carried}
                          onClick={() => dispatch({ type: "dropDrug", drugId: drug.id, amount })}
                        >
                          DROP
                        </TerminalButton>
                        <TerminalButton
                          className="max-button"
                          disabled={dealerRefuses || maxBuy <= 0 || state.pendingPrompt !== null}
                          onClick={() => dispatch({ type: "buyDrug", dealerId: selectedDealer.id, drugId: drug.id, amount: maxBuy })}
                        >
                          MAX BUY
                        </TerminalButton>
                        <TerminalButton
                          className="max-button"
                          disabled={dealerRefuses || inventory.carried <= 0 || bidPrice <= 0 || state.pendingPrompt !== null}
                          onClick={() => dispatch({ type: "sellDrug", dealerId: selectedDealer.id, drugId: drug.id, amount: inventory.carried })}
                        >
                          MAX SELL
                        </TerminalButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {giftOnlyDrugs.length > 0 && (
            <div className="gift-only">
              <h3>GIFT-ONLY INVENTORY</h3>
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
                  {giftOnlyDrugs.map((drug) => {
                    const inventory = state.player.drugs[drug.id];
                    const amount = amountFor(drug.id);
                    return (
                      <tr key={drug.id}>
                        <td>{drug.name}</td>
                        <td>{inventory.carried}</td>
                        <td>
                          <input
                            aria-label={`${drug.name} gift quantity`}
                            inputMode="numeric"
                            min={0}
                            value={amounts[drug.id] ?? "1"}
                            onChange={(event) => setAmounts((current) => ({ ...current, [drug.id]: event.target.value }))}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </td>
                        <td className="command-cell">
                          <TerminalButton
                            tone="good"
                            disabled={amount <= 0 || amount > inventory.carried || state.pendingPrompt !== null}
                            onClick={() => dispatch({ type: "giftDrug", dealerId: selectedDealer.id, drugId: drug.id, amount })}
                          >
                            GIFT
                          </TerminalButton>
                          <TerminalButton
                            tone="warn"
                            disabled={amount <= 0 || amount > inventory.carried}
                            onClick={() => dispatch({ type: "dropDrug", drugId: drug.id, amount })}
                          >
                            DROP
                          </TerminalButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <p className="is-empty">No dealers are working this location.</p>
      )}
    </section>
  );
}

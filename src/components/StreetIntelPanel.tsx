import { useEffect, useMemo, useState } from "react";
import { TerminalButton } from "./TerminalButton";
import { hoboIntelPrice } from "../game/engine";
import { formatMoney, parseAmount } from "../game/format";
import type { GameCommand, GameConfig, GameState, HoboConfig } from "../game/types";
import { useNpcDialogue } from "../hooks/useNpcDialogue";
import type { NpcConversationTarget } from "./ConversationOverlay";

interface StreetIntelPanelProps {
  config: GameConfig;
  dispatch: (command: GameCommand) => void;
  llmAvailable: boolean;
  onTalkToNpc: (target: NpcConversationTarget) => void;
  state: GameState;
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

function favoriteDrugNames(config: GameConfig, hobo: HoboConfig): string {
  return hobo.favoriteDrugIds.map((drugId) => config.drugs.find((drug) => drug.id === drugId)?.name ?? drugId).join("/");
}

function contactLine(hobo: HoboConfig, relationship: number, price: number, canAffordIntel: boolean): string {
  if (hobo.dialogStyle === "rhyme") {
    if (relationship < -40) {
      return `${hobo.name} rosins the bow. "Cross me again and hear the string; ask real careful or feel the sting."`;
    }

    if (price > 0 && !canAffordIntel) {
      return `${hobo.name} taps the fiddle case. "No Tims in hand, no tale in flight; bring me a cup and I'll sing it right."`;
    }

    if (price === 0) {
      return `${hobo.name} leans close. "Trust earned the tune, so ask what you bring; I'll bow you the truth on a Halifax string."`;
    }

    return `${hobo.name} smiles over the fiddle. "Buy me a Tims and I'll hum what I know; the harbour keeps secrets where cold waters flow."`;
  }

  if (relationship < -40) {
    return `${hobo.name} keeps a hard eye on you. "Talk quick, eh. I'm not in the mood for bullshit."`;
  }

  if (price > 0 && !canAffordIntel) {
    return `${hobo.name} taps an empty cup. "No Tims money, no story, my guy."`;
  }

  if (price === 0) {
    return `${hobo.name} leans in. "You've been decent. Ask straight and I'll tell ya what I heard."`;
  }

  return `${hobo.name} glances down the block. "Buy me a Tims and I'll tell ya what's moving."`;
}

export function StreetIntelPanel({ config, state, dispatch, llmAvailable, onTalkToNpc }: StreetIntelPanelProps) {
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

  const relationship = selectedHobo ? state.hoboRelationships?.[selectedHobo.id] ?? 0 : 0;
  const price = selectedHobo ? hoboIntelPrice(config, state, selectedHobo) : 0;
  const canAffordIntel = price <= state.player.cash;
  const selectedHoboLine = selectedHobo ? contactLine(selectedHobo, relationship, price, canAffordIntel) : "";
  const selectedHoboScene = useMemo(() => {
    if (!selectedHobo) {
      return "";
    }

    const location = config.locations.find((item) => item.id === selectedHobo.locationId)?.name ?? selectedHobo.locationId;
    const favoriteDrugs = favoriteDrugNames(config, selectedHobo);
    const priceText = price === 0 ? "free because trust is high" : formatMoney(config, price);

    return [
      "A potential buyer approaches you and says hello.",
      `${selectedHobo.name} is a hobo and street intel contact in ${location}.`,
      "They can sell or give intel, accept drug gifts, and may be threatened for information.",
      `Relationship with player: ${relationship}.`,
      `Intel price right now: ${priceText}. Player cash: ${formatMoney(config, state.player.cash)}.`,
      `Can afford the intel: ${canAffordIntel ? "yes" : "no"}. Favorite gifts: ${favoriteDrugs}.`,
      `Player reputation: ${state.player.reputation}; local turf influence: ${state.locationInfluence[selectedHobo.locationId] ?? 0}.`,
      "Say the opening line for this conversation before the player chooses whether to buy intel, threaten, or gift drugs.",
    ].join("\n");
  }, [canAffordIntel, config, price, relationship, selectedHobo, state.locationInfluence, state.player.cash, state.player.reputation]);
  const selectedHoboDialogue = useNpcDialogue({
    config,
    disabled: !selectedHobo,
    fallback: selectedHoboLine,
    llmAvailable,
    npcId: selectedHobo?.id,
    npcName: selectedHobo?.name,
    refreshKey: `${state.player.turn}:${state.player.locationId}:${selectedHobo?.id ?? ""}:${relationship}:${price}:${state.player.cash}`,
    scene: selectedHoboScene,
  });

  if (!selectedHobo) {
    return (
      <section className="terminal-panel street-intel-panel" aria-label="Street intel">
        <h2>STREET INTEL</h2>
        <p className="is-empty">Nobody is talking here.</p>
      </section>
    );
  }

  const danger = hoboDanger(selectedHobo);
  const disabled = state.pendingPrompt !== null || state.gameOver;
  const localReports = state.intelReports.filter((report) => report.locationId === state.player.locationId).slice(0, 4);

  function startHoboConversation(): void {
    onTalkToNpc({
      fallback: selectedHoboLine,
      id: selectedHobo.id,
      name: selectedHobo.name,
      openingLine: selectedHoboDialogue.text,
      role: "hobo and street intel contact",
      scene: [
        selectedHoboScene,
        "The player clicked TALK in the Street Intel panel and can type directly to this street contact.",
        "The contact can chat, hint, ask for payment, refuse, warn, or steer the player toward buying intel, gifting, or backing off.",
        "This typed conversation is flavor and soft intel only; it cannot create a paid intel report, change relationship, accept gifts, trigger threats, or advance time.",
      ].join("\n"),
      title: `TALK TO ${selectedHobo.name.toUpperCase()}`,
      tone: relationship < -40 ? "bad" : price === 0 ? "good" : "info",
    });
  }

  return (
    <section className="terminal-panel street-intel-panel" aria-label="Street intel">
      <h2>STREET INTEL</h2>

      <div className="hobo-selector" aria-label="Hobos">
        {currentHobos.map((hobo) => {
          const hoboRelationship = state.hoboRelationships?.[hobo.id] ?? 0;
          return (
            <TerminalButton
              key={hobo.id}
              className={hobo.id === selectedHobo.id ? "hobo-tab is-active" : "hobo-tab"}
              data-hobo-id={hobo.id}
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
              <dd>{favoriteDrugNames(config, selectedHobo)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="conversation-panel" aria-label={`${selectedHobo.name} conversation`}>
        <p className="npc-line">{selectedHoboDialogue.text}</p>
        <div className="dialogue-options" aria-label="Dialog options">
          <TerminalButton
            className="dialogue-option"
            disabled={disabled}
            onClick={startHoboConversation}
          >
            <span>TALK</span>
            <small>Type your own question</small>
          </TerminalButton>
          <TerminalButton
            className="dialogue-option"
            tone={price === 0 ? "good" : "default"}
            disabled={disabled || !canAffordIntel}
            onClick={() => dispatch({ type: "buyHoboIntel", hoboId: selectedHobo.id })}
          >
            <span>{price === 0 ? "Ask what they know" : "Buy a Tims and ask around"}</span>
            <small>{price === 0 ? "Free local intel" : `${formatMoney(config, price)} for local intel`}</small>
          </TerminalButton>
          <TerminalButton
            className="dialogue-option threaten-option"
            tone="bad"
            disabled={disabled}
            onClick={() => dispatch({ type: "threatenHobo", hoboId: selectedHobo.id })}
          >
            <span>THREATEN</span>
            <small>Force a story out of them</small>
          </TerminalButton>
        </div>
      </div>

      {carriedDrugs.length > 0 ? (
        <div className="dialogue-gifts">
          <h3>OFFER A GIFT</h3>
          <div className="gift-options" aria-label="Gift dialog options">
            {carriedDrugs.map((drug) => {
              const inventory = state.player.drugs[drug.id];
              const amount = amountFor(drug.id);
              const favorite = selectedHobo.favoriteDrugIds.includes(drug.id);
              return (
                <div className="gift-option" key={drug.id}>
                  <label>
                    <span>{drug.name}</span>
                    <small>Held {inventory.carried}{favorite ? " / favorite" : ""}</small>
                    <input
                      aria-label={`${drug.name} gift amount`}
                      inputMode="numeric"
                      min={0}
                      value={amounts[drug.id] ?? "1"}
                      onChange={(event) => setAmounts((current) => ({ ...current, [drug.id]: event.target.value }))}
                    />
                  </label>
                  <TerminalButton
                    className="dialogue-option gift-choice"
                    tone="good"
                    disabled={amount <= 0 || amount > inventory.carried || disabled}
                    onClick={() => dispatch({ type: "giftHoboDrug", hoboId: selectedHobo.id, drugId: drug.id, amount })}
                  >
                    <span>Offer {drug.name}</span>
                    <small>{amount > 0 ? `${amount} for relationship` : "Choose an amount"}</small>
                  </TerminalButton>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="is-empty">You have nothing worth offering right now.</p>
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

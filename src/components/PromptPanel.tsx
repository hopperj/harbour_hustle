import { useMemo } from "react";
import { TerminalButton } from "./TerminalButton";
import type { GameCommand, GameConfig, GameState, PendingPrompt } from "../game/types";
import { useNpcDialogue } from "../hooks/useNpcDialogue";

interface PromptPanelProps {
  config: GameConfig;
  dispatch: (command: GameCommand) => void;
  llmAvailable: boolean;
  state: GameState;
}

function promptNpc(config: GameConfig, prompt: PendingPrompt | null): { id: string; name: string } | null {
  if (prompt?.type === "cops") {
    const cop = config.cops.find((item) => item.id === prompt.copId);
    return cop ? { id: cop.id, name: cop.name } : null;
  }

  if (prompt?.type === "dealer-offer") {
    const dealer = config.dealers.find((item) => item.id === prompt.dealerId);
    return dealer ? { id: dealer.id, name: dealer.name } : null;
  }

  return null;
}

export function PromptPanel({ config, state, dispatch, llmAvailable }: PromptPanelProps) {
  const prompt = state.pendingPrompt;
  const npc = promptNpc(config, prompt);
  const promptScene = useMemo(() => {
    if (!prompt || !npc) {
      return "";
    }

    if (prompt.type === "cops") {
      return [
        "A police encounter starts.",
        `${npc.name} and ${prompt.deputies} deputies are chasing the player.`,
        "The player must choose RUN or FIGHT.",
        `Existing mechanical prompt: ${prompt.text}`,
        "Say the opening police line directly to the player.",
      ].join("\n");
    }

    if (prompt.type === "dealer-offer") {
      return [
        "A potential buyer approaches you and says hello.",
        `${npc.name} is making a side offer before normal business continues.`,
        `Offer price: ${prompt.price}. Relationship gain if accepted: ${prompt.relationshipGain}.`,
        `Existing mechanical prompt: ${prompt.text}`,
        "Say the offer directly to the player.",
      ].join("\n");
    }

    return "";
  }, [npc, prompt]);
  const promptDialogue = useNpcDialogue({
    config,
    disabled: !prompt || !npc,
    fallback: prompt?.text ?? "",
    llmAvailable,
    npcId: npc?.id,
    npcName: npc?.name,
    refreshKey: prompt?.text ?? null,
    scene: promptScene,
  });

  if (!prompt) {
    return null;
  }

  const isCops = prompt.type === "cops";
  const canFight = Object.values(state.player.guns).some((item) => item.carried > 0);

  return (
    <section className="terminal-panel prompt-panel" aria-live="assertive" aria-label="Pending question">
      <h2>QUESTION</h2>
      <p>{promptDialogue.text}</p>
      <div className="prompt-actions">
        {isCops ? (
          <>
            <TerminalButton tone="warn" onClick={() => dispatch({ type: "answerPrompt", answer: "run" })}>
              RUN
            </TerminalButton>
            <TerminalButton
              tone="bad"
              disabled={!canFight}
              onClick={() => dispatch({ type: "answerPrompt", answer: "fight" })}
            >
              FIGHT
            </TerminalButton>
          </>
        ) : (
          <>
            <TerminalButton tone="good" onClick={() => dispatch({ type: "answerPrompt", answer: "yes" })}>
              YES
            </TerminalButton>
            <TerminalButton tone="warn" onClick={() => dispatch({ type: "answerPrompt", answer: "no" })}>
              NO
            </TerminalButton>
          </>
        )}
      </div>
      {isCops && <p className="panel-caption">No {config.names.gunPlural} means no fighting.</p>}
    </section>
  );
}

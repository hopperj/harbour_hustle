import { TerminalButton } from "./TerminalButton";
import type { GameCommand, GameConfig, GameState } from "../game/types";

interface PromptPanelProps {
  config: GameConfig;
  state: GameState;
  dispatch: (command: GameCommand) => void;
}

export function PromptPanel({ config, state, dispatch }: PromptPanelProps) {
  const prompt = state.pendingPrompt;

  if (!prompt) {
    return null;
  }

  const isCops = prompt.type === "cops";
  const canFight = Object.values(state.player.guns).some((item) => item.carried > 0);

  return (
    <section className="terminal-panel prompt-panel" aria-live="assertive" aria-label="Pending question">
      <h2>QUESTION</h2>
      <p>{prompt.text}</p>
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

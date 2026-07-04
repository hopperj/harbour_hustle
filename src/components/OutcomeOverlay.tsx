import { formatDate } from "../game/format";
import type { EventLogEntry, GameConfig, NpcMemoryKind, PendingPrompt } from "../game/types";
import type { OllamaAvailability } from "../game/llmDialogue";
import { ConversationThread, type NpcConversationTarget } from "./ConversationOverlay";
import { TerminalButton } from "./TerminalButton";

export interface OutcomeAction {
  detail: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  tone?: "default" | "good" | "warn" | "bad";
}

interface OutcomeOverlayProps {
  actions?: OutcomeAction[];
  canFight: boolean;
  config: GameConfig;
  conversationTarget?: NpcConversationTarget | null;
  entries: EventLogEntry[];
  id: string;
  npcDialogue?: string;
  npcName?: string;
  ollamaStatus: OllamaAvailability;
  onAnswer: (answer: "yes" | "no" | "run" | "fight") => void;
  onClose?: () => void;
  onRemember: (npcId: string, kind: NpcMemoryKind, text: string) => void;
  prompt: PendingPrompt | null;
  title: string;
  tone: "info" | "good" | "warn" | "bad";
}

export function OutcomeOverlay({
  actions = [],
  canFight,
  config,
  conversationTarget,
  entries,
  id,
  npcDialogue,
  npcName,
  ollamaStatus,
  onAnswer,
  onClose,
  onRemember,
  prompt,
  title,
  tone,
}: OutcomeOverlayProps) {
  const isCops = prompt?.type === "cops";

  return (
    <div className="outcome-overlay" role="presentation">
      <section
        key={id}
        aria-labelledby="outcome-title"
        aria-modal="true"
        className={`outcome-dialog outcome-dialog--${tone}`}
        role="dialog"
      >
        <div className="outcome-header">
          <div>
            <p className="panel-caption">{prompt ? "ENCOUNTER" : "ACTION REPORT"}</p>
            <h2 id="outcome-title">{title}</h2>
          </div>
          {onClose && (
            <TerminalButton className="outcome-close" onClick={onClose}>
              CLOSE
            </TerminalButton>
          )}
        </div>

        {entries.length > 0 ? (
          <ol className="outcome-log">
            {entries.map((entry) => (
              <li className={`outcome-entry outcome-entry--${entry.tone}`} key={entry.id}>
                <span>[{formatDate(entry.date)}]</span>
                <span>{entry.text}</span>
              </li>
            ))}
          </ol>
        ) : !prompt ? (
          <p className="is-empty">Nothing new happened.</p>
        ) : null}

        {conversationTarget ? (
          <div className="outcome-conversation">
            <ConversationThread
              config={config}
              ollamaStatus={ollamaStatus}
              onRemember={onRemember}
              target={conversationTarget}
            />
          </div>
        ) : npcDialogue && npcName && (
          <div className="outcome-npc-line">
            <div className="outcome-npc-header">
              <h3>{npcName.toUpperCase()}</h3>
            </div>
            <p>{npcDialogue}</p>
          </div>
        )}

        {prompt && (
          <div className="outcome-prompt">
            <h3>{isCops ? "CHOOSE FAST" : "REPLY"}</h3>
            <p>{prompt.text}</p>
            <div className="prompt-actions">
              {isCops ? (
                <>
                  <TerminalButton tone="warn" onClick={() => onAnswer("run")}>
                    RUN
                  </TerminalButton>
                  <TerminalButton tone="bad" disabled={!canFight} onClick={() => onAnswer("fight")}>
                    FIGHT
                  </TerminalButton>
                </>
              ) : (
                <>
                  <TerminalButton tone="good" onClick={() => onAnswer("yes")}>
                    YES
                  </TerminalButton>
                  <TerminalButton tone="warn" onClick={() => onAnswer("no")}>
                    NO
                  </TerminalButton>
                </>
              )}
            </div>
            {isCops && !canFight && <p className="panel-caption">No weapons means no fighting.</p>}
          </div>
        )}

        {actions.length > 0 && (
          <div className="outcome-followups">
            <h3>FOLLOW UP</h3>
            {prompt && <p>Handle the pending reply before pushing the conversation further.</p>}
            <div className="dialogue-options">
              {actions.map((action) => (
                <TerminalButton
                  className="dialogue-option"
                  disabled={action.disabled}
                  key={action.label}
                  onClick={action.onClick}
                  tone={action.tone}
                >
                  <span>{action.label}</span>
                  <small>{action.detail}</small>
                </TerminalButton>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

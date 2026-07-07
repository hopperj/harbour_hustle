import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { generateNpcDialogue, npcSceneRails, type OllamaAvailability } from "../game/llmDialogue";
import type { GameConfig, NpcMemoryKind, Tone } from "../game/types";
import { TerminalButton } from "./TerminalButton";

export interface NpcConversationTarget {
  fallback: string;
  id: string;
  name: string;
  openingLine?: string;
  role: string;
  scene: string;
  title: string;
  tone?: Tone;
}

interface ConversationMessage {
  id: number;
  speaker: "npc" | "player";
  text: string;
}

interface ConversationOverlayProps {
  config: GameConfig;
  ollamaStatus: OllamaAvailability;
  onClose: () => void;
  onRemember: (npcId: string, kind: NpcMemoryKind, text: string) => void;
  target: NpcConversationTarget;
}

interface ConversationThreadProps {
  config: GameConfig;
  ollamaStatus: OllamaAvailability;
  onRemember: (npcId: string, kind: NpcMemoryKind, text: string) => void;
  target: NpcConversationTarget;
}

function fallbackConversationReply(target: NpcConversationTarget, playerLine: string): string {
  const lowered = playerLine.toLowerCase();

  if (/(code|javascript|prompt|system|ollama|model|assistant|chatbot)/i.test(lowered)) {
    return `${target.name} narrows their eyes. "I don't do machine talk, my guy. Keep it on the fuckin' street or keep moving."`;
  }

  if (/(intel|info|tip|rumou?r|heard|know|police|cops|heat)/i.test(lowered)) {
    if (target.role.includes("intel")) {
      return `${target.name} keeps it close. "Pay for the local tip if you want facts, eh. Free talk stays thin as shit."`;
    }

    return `${target.name} glances away. "I sell what I sell, bud. Street stories cost trust, and you ain't fuckin' bought that yet."`;
  }

  if (/(buy|sell|price|stock|deal)/i.test(lowered)) {
    return `${target.name} taps the table. "Use the market if you're doing business, my guy. Talkin' doesn't move fuckin' stock."`;
  }

  if (/(rob|fight|threat|kill|hurt)/i.test(lowered)) {
    return `${target.name} goes still. "Fuck, shit, sorry, but say that again and this conversation gets ugly."`;
  }

  return `${target.name} gives you a hard look. "Say it plain, fuuuuckin' eh. I'm listening, but I ain't giving the harbour away for free."`;
}

function buildConversationScene(target: NpcConversationTarget, messages: ConversationMessage[], playerLine: string): string {
  const transcript = [...messages, { id: -1, speaker: "player" as const, text: playerLine }]
    .slice(-8)
    .map((message) => `${message.speaker === "player" ? "Player" : target.name}: ${message.text}`)
    .join("\n");

  return [
    target.scene,
    "",
    "The player opened a typed conversation window with you.",
    "Answer the player's latest line only.",
    "Conversation can provide flavor, attitude, small hints, refusals, or directions toward normal game actions.",
    "Conversation cannot directly change cash, inventory, prices, stock, health, relationships, reputation, time, or police state.",
    "Do not give free mechanical rewards. If the player wants a real trade, intel purchase, gift, threat, robbery, or travel action, point them to the game action in character.",
    ...npcSceneRails("Answer the latest typed message while preserving the current relationship and recent history."),
    "",
    "Recent conversation:",
    transcript || "(none)",
    "",
    `Latest player line: ${playerLine}`,
    "",
    "Reply directly to the player in character.",
  ].join("\n");
}

export function ConversationThread({ config, ollamaStatus, onRemember, target }: ConversationThreadProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLOListElement | null>(null);
  const nextIdRef = useRef(1);
  const llmAvailable = ollamaStatus === "available";

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    nextIdRef.current = 1;
    setDraft("");
    setBusy(false);
    setMessages(target.openingLine ? [{ id: nextIdRef.current++, speaker: "npc", text: target.openingLine }] : []);

    return () => abortRef.current?.abort();
  }, [target]);

  useEffect(() => {
    const log = logRef.current;
    if (!log) {
      return;
    }

    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [busy, messages]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await sendDraft();
  }

  async function sendDraft(): Promise<void> {
    const playerLine = draft.trim();
    if (!playerLine || busy) {
      return;
    }

    const playerMessage: ConversationMessage = { id: nextIdRef.current++, speaker: "player", text: playerLine };
    const nextMessages = [...messages, playerMessage];
    setMessages(nextMessages);
    onRemember(target.id, "chat", `Player said: ${playerLine}`);
    setDraft("");

    const fallback = fallbackConversationReply(target, playerLine);
    if (!llmAvailable) {
      setMessages([...nextMessages, { id: nextIdRef.current++, speaker: "npc", text: fallback }]);
      onRemember(target.id, "chat", `${target.name} said: ${fallback}`);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);

    const reply = await generateNpcDialogue({
      config,
      fallback,
      npcId: target.id,
      npcName: target.name,
      scene: buildConversationScene(target, messages, playerLine),
      signal: controller.signal,
    });

    if (!controller.signal.aborted) {
      setMessages((current) => [...current, { id: nextIdRef.current++, speaker: "npc", text: reply }]);
      onRemember(target.id, "chat", `${target.name} said: ${reply}`);
      setBusy(false);
      abortRef.current = null;
    }
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void sendDraft();
  }

  const inputId = `conversation-input-${target.id}`;

  return (
    <>
      <ol className="conversation-log" aria-label={`${target.name} conversation log`} ref={logRef}>
        {messages.map((message) => (
          <li className={`conversation-message conversation-message--${message.speaker}`} key={message.id}>
            <span>{message.speaker === "player" ? "YOU" : target.name.toUpperCase()}</span>
            <p>{message.text}</p>
          </li>
        ))}
        {messages.length === 0 && <li className="is-empty">The line is open.</li>}
        {busy && (
          <li className="conversation-message conversation-message--npc">
            <span>{target.name.toUpperCase()}</span>
            <p>...</p>
          </li>
        )}
      </ol>

      <form className="conversation-form" onSubmit={submit}>
        <label htmlFor={inputId}>SAY SOMETHING</label>
        <textarea
          id={inputId}
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleDraftKeyDown}
          placeholder={`Talk to ${target.name}`}
        />
        <div className="conversation-actions">
          <TerminalButton disabled={!draft.trim() || busy} tone="good" type="submit">
            SAY
          </TerminalButton>
        </div>
      </form>
    </>
  );
}

export function ConversationOverlay({ config, ollamaStatus, onClose, onRemember, target }: ConversationOverlayProps) {
  return (
    <div className="outcome-overlay" role="presentation">
      <section
        aria-labelledby="conversation-title"
        aria-modal="true"
        className={`outcome-dialog conversation-dialog outcome-dialog--${target.tone ?? "info"}`}
        role="dialog"
      >
        <div className="outcome-header">
          <div>
            <p className="panel-caption">{ollamaStatus === "available" ? "LLM ONLINE" : ollamaStatus === "checking" ? "CHECKING LLM" : "LLM OFFLINE"}</p>
            <h2 id="conversation-title">{target.title}</h2>
          </div>
          <TerminalButton className="outcome-close" onClick={onClose}>
            CLOSE
          </TerminalButton>
        </div>

        <ConversationThread
          config={config}
          ollamaStatus={ollamaStatus}
          onRemember={onRemember}
          target={target}
        />
      </section>
    </div>
  );
}

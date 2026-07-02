import { formatDate } from "../game/format";
import type { GameState } from "../game/types";

interface EventLogProps {
  state: GameState;
}

export function EventLog({ state }: EventLogProps) {
  return (
    <section className="terminal-panel event-log" aria-label="Event log">
      <h2>EVENT LOG</h2>
      <ol>
        {state.eventLog.map((entry) => (
          <li key={entry.id} className={`log-line log-line--${entry.tone}`}>
            <span>[{formatDate(entry.date)}]</span>
            <span>{entry.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

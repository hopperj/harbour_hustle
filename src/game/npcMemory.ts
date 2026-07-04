import type { GameState, NpcMemoryEntry } from "./types";

function memoryAgeLabel(state: GameState, entry: NpcMemoryEntry): string {
  const daysAgo = Math.max(0, state.player.turn - entry.turn);
  if (daysAgo === 0) {
    return "today";
  }
  if (daysAgo === 1) {
    return "1 day ago";
  }
  return `${daysAgo} days ago`;
}

export function formatNpcMemoryForPrompt(state: GameState, npcId: string | null | undefined): string {
  if (!npcId) {
    return "No prior direct history with this NPC.";
  }

  const entries = (state.npcMemory ?? []).filter((entry) => entry.npcId === npcId);
  if (entries.length === 0) {
    return "No prior direct history with this NPC.";
  }

  return entries
    .map((entry) => `- ${memoryAgeLabel(state, entry)} [${entry.kind}]: ${entry.text}`)
    .join("\n");
}

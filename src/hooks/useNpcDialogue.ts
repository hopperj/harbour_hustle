import { useEffect, useState } from "react";
import { generateNpcDialogue } from "../game/llmDialogue";
import type { GameConfig } from "../game/types";

type DialogueStatus = "fallback" | "loading" | "ready";

interface UseNpcDialogueParams {
  config: GameConfig;
  disabled?: boolean;
  fallback: string;
  llmAvailable?: boolean;
  npcId: string | null | undefined;
  npcName: string | null | undefined;
  refreshKey?: string | number | null;
  scene: string;
}

export interface NpcDialogueState {
  status: DialogueStatus;
  text: string;
}

export function useNpcDialogue({
  config,
  disabled = false,
  fallback,
  llmAvailable = true,
  npcId,
  npcName,
  refreshKey = null,
  scene,
}: UseNpcDialogueParams): NpcDialogueState {
  const [dialogue, setDialogue] = useState<NpcDialogueState>({ status: "fallback", text: fallback });

  useEffect(() => {
    if (disabled || !llmAvailable || !npcId || !npcName || !scene.trim() || !config.llmDialogue.enabled) {
      setDialogue({ status: "fallback", text: fallback });
      return;
    }

    const controller = new AbortController();
    setDialogue({ status: "loading", text: fallback });

    void generateNpcDialogue({
      config,
      fallback,
      npcId,
      npcName,
      scene,
      signal: controller.signal,
    }).then((text) => {
      if (!controller.signal.aborted) {
        setDialogue({ status: text === fallback ? "fallback" : "ready", text });
      }
    });

    return () => controller.abort();
  }, [
    config,
    disabled,
    fallback,
    llmAvailable,
    npcId,
    npcName,
    refreshKey,
    scene,
  ]);

  return dialogue;
}

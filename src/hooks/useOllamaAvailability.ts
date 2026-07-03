import { useEffect, useState } from "react";
import { checkOllamaAvailability, type OllamaAvailability } from "../game/llmDialogue";
import type { GameConfig } from "../game/types";

export function useOllamaAvailability(config: GameConfig): OllamaAvailability {
  const [status, setStatus] = useState<OllamaAvailability>(config.llmDialogue.enabled ? "checking" : "unavailable");

  useEffect(() => {
    if (!config.llmDialogue.enabled) {
      setStatus("unavailable");
      return;
    }

    const controller = new AbortController();
    setStatus("checking");

    void checkOllamaAvailability(config, controller.signal).then((available) => {
      if (!controller.signal.aborted) {
        setStatus(available ? "available" : "unavailable");
      }
    });

    return () => controller.abort();
  }, [config]);

  return status;
}

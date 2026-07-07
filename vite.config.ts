import { defineConfig } from "vite";
import type { Connect, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { DEFAULT_GAME_CONFIG } from "./src/game/config";
import { buildPrompt, buildSystemPrompt, sanitizeDialogue, trimEndpoint } from "./src/game/llmDialogue";

const LLM_API_PREFIX = "/api/llm";
const DEFAULT_OLLAMA_ENDPOINT = "http://127.0.0.1:11434";

const NPC_DOC_FILES: Record<string, string> = {
  "benchwise-eddie": "./docs/npcs/benchwise-eddie.md",
  "big-paulie": "./docs/npcs/shady-rich.md",
  "boardwalk-benny": "./docs/npcs/boardwalk-benny.md",
  "boardwalk-sal": "./docs/npcs/boardwalk-sal.md",
  "brooklyn-rose": "./docs/npcs/brooklyn-rose.md",
  "chebucto-cam": "./docs/npcs/chebucto-cam.md",
  "ferry-dock-frank": "./docs/npcs/ferry-dock-frank.md",
  "ferry-jo": "./docs/npcs/ferry-jo.md",
  "johnathan": "./docs/npcs/johnathan.md",
  "j-wood": "./docs/npcs/j-wood.md",
  "mama-dee": "./docs/npcs/mama-dee.md",
  "needle-nick": "./docs/npcs/needle-nick.md",
  "professor-x": "./docs/npcs/professor-x.md",
  "queens-vic": "./docs/npcs/queens-vic.md",
  "rail-yard-ray": "./docs/npcs/rail-yard-ray.md",
  "rico": "./docs/npcs/rico.md",
  "scratchy-lou": "./docs/npcs/scratchy-lou.md",
  "shanobi": "./docs/npcs/shanobi.md",
  "stoop-annie": "./docs/npcs/stoop-annie.md",
  "subway-sue": "./docs/npcs/subway-sue.md",
  "sweet-aidan": "./docs/npcs/sweet-aidan.md",
  "tin-can-marty": "./docs/npcs/tin-can-marty.md",
  "bob": "./docs/npcs/officer-bob.md",
  "hardass": "./docs/npcs/officer-hardass.md",
  "smith": "./docs/npcs/agent-smith.md",
};

interface DialogueRequest {
  fallback?: unknown;
  npcId?: unknown;
  npcName?: unknown;
  scene?: unknown;
}

interface OllamaGenerateResponse {
  error?: string;
  response?: string;
}

interface OllamaTagsResponse {
  models?: Array<{
    model?: string;
    name?: string;
  }>;
}

const npcDocCache = new Map<string, string>();

function llmServerConfig() {
  const llmConfig = DEFAULT_GAME_CONFIG.llmDialogue;
  return {
    endpoint: trimEndpoint(process.env.OLLAMA_ENDPOINT ?? DEFAULT_OLLAMA_ENDPOINT),
    healthCheckTimeoutMs: llmConfig.healthCheckTimeoutMs,
    maxTokens: llmConfig.maxTokens,
    model: process.env.OLLAMA_MODEL ?? llmConfig.model,
    temperature: llmConfig.temperature,
    timeoutMs: llmConfig.timeoutMs,
  };
}

function writeJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) {
    raw += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  }

  if (!raw.trim()) {
    return null;
  }

  return JSON.parse(raw);
}

async function npcDocumentForServer(npcId: string): Promise<string | null> {
  const filePath = NPC_DOC_FILES[npcId];
  if (!filePath) {
    return null;
  }

  const cached = npcDocCache.get(npcId);
  if (cached) {
    return cached;
  }

  const document = await readFile(fileURLToPath(new URL(filePath, import.meta.url)), "utf8");
  npcDocCache.set(npcId, document);
  return document;
}

async function checkServerOllama(): Promise<{ available: boolean; model: string }> {
  const config = llmServerConfig();
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), config.healthCheckTimeoutMs);

  try {
    const response = await fetch(`${config.endpoint}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[harbour-hustle llm] status unavailable model=${config.model} http=${response.status} duration=${Date.now() - startedAt}ms`);
      return { available: false, model: config.model };
    }

    const data = await response.json() as OllamaTagsResponse;
    const models = data.models ?? [];
    const available = models.some((model) => model.name === config.model || model.model === config.model);
    console.info(`[harbour-hustle llm] status available=${available} model=${config.model} duration=${Date.now() - startedAt}ms`);
    return { available, model: config.model };
  } catch (error) {
    console.warn(`[harbour-hustle llm] status unavailable model=${config.model} reason=${error instanceof Error ? error.name : "unknown"} duration=${Date.now() - startedAt}ms`);
    return { available: false, model: config.model };
  } finally {
    clearTimeout(timeout);
  }
}

async function generateServerDialogue(body: DialogueRequest): Promise<{ error?: string; text: string }> {
  const fallback = typeof body.fallback === "string" ? body.fallback : "";
  const npcId = typeof body.npcId === "string" ? body.npcId : "";
  const npcName = typeof body.npcName === "string" ? body.npcName : "";
  const scene = typeof body.scene === "string" ? body.scene : "";
  const config = llmServerConfig();
  const startedAt = Date.now();

  if (!npcId || !npcName || !scene.trim()) {
    console.warn(`[harbour-hustle llm] dialogue fallback reason=bad_request npc=${npcId || "unknown"}`);
    return { error: "bad_request", text: fallback };
  }

  const npcDocument = await npcDocumentForServer(npcId);
  if (!npcDocument) {
    console.warn(`[harbour-hustle llm] dialogue fallback reason=missing_npc_doc npc=${npcId}`);
    return { error: "missing_npc_doc", text: fallback };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.endpoint}/api/generate`, {
      body: JSON.stringify({
        model: config.model,
        options: {
          num_predict: config.maxTokens,
          temperature: config.temperature,
        },
        prompt: buildPrompt({ npcDocument, npcName, scene }),
        stream: false,
        system: buildSystemPrompt({ npcName }),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[harbour-hustle llm] dialogue fallback reason=http_${response.status} npc=${npcId} duration=${Date.now() - startedAt}ms`);
      return { error: "ollama_http_error", text: fallback };
    }

    const data = await response.json() as OllamaGenerateResponse;
    if (data.error || !data.response) {
      console.warn(`[harbour-hustle llm] dialogue fallback reason=empty_response npc=${npcId} duration=${Date.now() - startedAt}ms`);
      return { error: data.error ?? "empty_response", text: fallback };
    }

    const text = sanitizeDialogue(data.response, npcName, fallback);
    console.info(`[harbour-hustle llm] dialogue ready npc=${npcId} model=${config.model} duration=${Date.now() - startedAt}ms`);
    return { text };
  } catch (error) {
    console.warn(`[harbour-hustle llm] dialogue fallback reason=${error instanceof Error ? error.name : "unknown"} npc=${npcId} duration=${Date.now() - startedAt}ms`);
    return { error: "ollama_request_failed", text: fallback };
  } finally {
    clearTimeout(timeout);
  }
}

function llmProxyMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = new URL(req.url ?? "/", "http://harbour-hustle.local");
    if (!url.pathname.startsWith(`${LLM_API_PREFIX}/`)) {
      next();
      return;
    }

    void (async () => {
      try {
        if (req.method === "GET" && url.pathname === `${LLM_API_PREFIX}/status`) {
          writeJson(res, 200, await checkServerOllama());
          return;
        }

        if (req.method === "POST" && url.pathname === `${LLM_API_PREFIX}/dialogue`) {
          writeJson(res, 200, await generateServerDialogue(await readJson(req) as DialogueRequest));
          return;
        }

        writeJson(res, 404, { error: "not_found" });
      } catch (error) {
        console.warn(`[harbour-hustle llm] middleware error reason=${error instanceof Error ? error.message : "unknown"}`);
        writeJson(res, 500, { error: "llm_proxy_error" });
      }
    })();
  };
}

function harbourHustleLlmProxy(): Plugin {
  return {
    name: "harbour-hustle-llm-proxy",
    configureServer(server) {
      server.middlewares.use(llmProxyMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(llmProxyMiddleware());
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [harbourHustleLlmProxy(), react()],
});

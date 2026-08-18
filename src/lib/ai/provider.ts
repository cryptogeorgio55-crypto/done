import { z } from "zod";
import { config, resolveAiProvider } from "@/lib/config";
import { AppError } from "@/lib/errors";

export interface LlmResult {
  text: string;
  provider: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
}

/**
 * Model routing tiers. The rest of the app asks for a capability level, not a
 * model name — so DeepSeek (or any future provider) can map these however it
 * likes without touching call sites.
 *   fast      → cheap/quick: classification, extraction, summaries, routing
 *   primary   → customer-facing replies, marketing, follow-ups, content
 *   reasoning → I'M LAZY, multi-step DONE Runs, planning, cross-app decisions
 */
export type AiTier = "fast" | "primary" | "reasoning";

/** Run `fn` with an abort signal that fires after the configured timeout. */
async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function deepseekModel(tier: AiTier): string {
  const d = config.ai.deepseek;
  return tier === "reasoning" ? d.reasoningModel : tier === "fast" ? d.fastModel : d.primaryModel;
}

/**
 * DeepSeek — the production provider. OpenAI-compatible chat completions.
 * The reasoning model (deepseek-reasoner / R1) does not support JSON mode, so
 * we only request response_format for the chat model and rely on extractJson
 * for the reasoner (the system prompt already mandates a JSON-only reply).
 */
async function callDeepSeek(system: string, prompt: string, tier: AiTier): Promise<LlmResult> {
  const model = deepseekModel(tier);
  const supportsJsonMode = model !== config.ai.deepseek.reasoningModel;
  const res = await withTimeout((signal) =>
    fetch(`${config.ai.deepseek.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.ai.deepseek.apiKey}`,
      },
      body: JSON.stringify({
        model,
        ...(supportsJsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    })
  );
  if (!res.ok) {
    throw new AppError("ai_provider_error", `DeepSeek error (${res.status}).`, 502);
  }
  const json = await res.json();
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    provider: "deepseek",
    model,
    tokensIn: json.usage?.prompt_tokens,
    tokensOut: json.usage?.completion_tokens,
  };
}

async function callAnthropic(system: string, prompt: string): Promise<LlmResult> {
  const res = await withTimeout((signal) =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": config.ai.anthropic.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.ai.anthropic.model,
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    })
  );
  if (!res.ok) {
    throw new AppError("ai_provider_error", `Anthropic error (${res.status}).`, 502);
  }
  const json = await res.json();
  const text = (json.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  return {
    text,
    provider: "anthropic",
    model: config.ai.anthropic.model,
    tokensIn: json.usage?.input_tokens,
    tokensOut: json.usage?.output_tokens,
  };
}

async function callOpenAI(system: string, prompt: string): Promise<LlmResult> {
  const res = await withTimeout((signal) =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.ai.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.openai.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    })
  );
  if (!res.ok) {
    throw new AppError("ai_provider_error", `OpenAI error (${res.status}).`, 502);
  }
  const json = await res.json();
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    provider: "openai",
    model: config.ai.openai.model,
    tokensIn: json.usage?.prompt_tokens,
    tokensOut: json.usage?.completion_tokens,
  };
}

async function callOllama(system: string, prompt: string): Promise<LlmResult> {
  const res = await withTimeout((signal) =>
    fetch(`${config.ai.ollama.baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: config.ai.ollama.model,
        format: "json",
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    })
  );
  if (!res.ok) {
    throw new AppError("ai_provider_error", `Ollama error (${res.status}).`, 502);
  }
  const json = await res.json();
  return {
    text: json.message?.content ?? "",
    provider: "ollama",
    model: config.ai.ollama.model,
  };
}

function callProvider(provider: string, system: string, prompt: string, tier: AiTier): Promise<LlmResult> {
  switch (provider) {
    case "deepseek":
      return callDeepSeek(system, prompt, tier);
    case "anthropic":
      return callAnthropic(system, prompt);
    case "openai":
      return callOpenAI(system, prompt);
    case "ollama":
      return callOllama(system, prompt);
    default:
      throw new AppError("ai_unavailable", "No AI provider configured.", 503);
  }
}

/** Best-effort extraction of a JSON object from a model's text response. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new AppError("ai_invalid_output", "The AI returned an unreadable response.", 502);
  }
}

export interface GenerateJsonResult<T> {
  data: T;
  provider: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  offline: boolean;
}

// NOTE: we key the generic on the schema type and derive values via z.infer
// (the schema's OUTPUT type). This avoids TypeScript resolving generics to the
// INPUT type, which would make fields with .default() spuriously optional.

/**
 * Generate structured, schema-validated output.
 *
 * - If a real provider is configured, it calls the LLM (JSON-only), extracts,
 *   and validates against `schema`, retrying once on invalid output.
 * - If no provider is configured, it uses the deterministic `offline` factory
 *   so the product still works with zero budget. Offline results are flagged so
 *   the UI can label them honestly — never presented as real AI generation.
 */
export async function generateJSON<S extends z.ZodTypeAny>(opts: {
  system: string;
  prompt: string;
  schema: S;
  offline: () => z.infer<S>;
  /** Capability tier → model routing. Defaults to "primary". */
  tier?: AiTier;
}): Promise<GenerateJsonResult<z.infer<S>>> {
  const provider = resolveAiProvider();
  const tier: AiTier = opts.tier ?? "primary";

  if (provider === "offline") {
    const data = opts.schema.parse(opts.offline()) as z.infer<S>;
    return { data, provider: "offline", model: "offline-v1", offline: true };
  }

  const jsonSystem =
    opts.system +
    "\n\nRespond with ONLY a single valid JSON object that conforms to the requested structure. No markdown, no code fences, no commentary.";

  let lastErr: unknown;
  const attempts = Math.max(1, config.ai.maxRetries + 1);
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const nudge =
        attempt === 0
          ? opts.prompt
          : opts.prompt +
            "\n\nYour previous response was not valid JSON matching the schema. Return ONLY the corrected JSON object.";
      const result = await callProvider(provider, jsonSystem, nudge, tier);
      const parsed = extractJson(result.text);
      const data = opts.schema.parse(parsed);
      return {
        data,
        provider: result.provider,
        model: result.model,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        offline: false,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr instanceof AppError) throw lastErr;
  throw new AppError("ai_invalid_output", "The AI response could not be validated.", 502);
}

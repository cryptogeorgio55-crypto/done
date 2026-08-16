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

const TIMEOUT_MS = 45_000;

async function withTimeout<T>(p: Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await p;
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropic(system: string, prompt: string): Promise<LlmResult> {
  const res = await withTimeout(
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
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
  const res = await withTimeout(
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
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
  const res = await withTimeout(
    fetch(`${config.ai.ollama.baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
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

function callProvider(provider: string, system: string, prompt: string): Promise<LlmResult> {
  switch (provider) {
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
}): Promise<GenerateJsonResult<z.infer<S>>> {
  const provider = resolveAiProvider();

  if (provider === "offline") {
    const data = opts.schema.parse(opts.offline()) as z.infer<S>;
    return { data, provider: "offline", model: "offline-v1", offline: true };
  }

  const jsonSystem =
    opts.system +
    "\n\nRespond with ONLY a single valid JSON object that conforms to the requested structure. No markdown, no code fences, no commentary.";

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const nudge =
        attempt === 0
          ? opts.prompt
          : opts.prompt +
            "\n\nYour previous response was not valid JSON matching the schema. Return ONLY the corrected JSON object.";
      const result = await callProvider(provider, jsonSystem, nudge);
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

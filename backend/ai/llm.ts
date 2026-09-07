/**
 * Provider-agnostic LLM adapter. Set ONE of these in `.env` and the app upgrades
 * AI explanations + the NEXUS assistant from templated to model-authored:
 *
 *   GROQ_API_KEY=...        # free tier — https://console.groq.com  (recommended)
 *   GEMINI_API_KEY=...      # free tier — https://aistudio.google.com/apikey
 *   ANTHROPIC_API_KEY=...   # paid
 *
 * With no key the app is fully functional on the deterministic rule-based fallback.
 */

export type LLMProvider = "groq" | "gemini" | "anthropic" | "none";

export function llmProvider(): LLMProvider {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "none";
}

/** Label shown in the UI ("mode") for whichever engine produced the text. */
export function llmModeLabel(): string {
  switch (llmProvider()) {
    case "groq":
      return "groq";
    case "gemini":
      return "gemini";
    case "anthropic":
      return "claude";
    default:
      return "rule-based";
  }
}

export function hasLLM() {
  return llmProvider() !== "none";
}

function extractJSON(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Ask the configured provider for a JSON object. Returns null on any failure so
 * callers transparently fall back to their deterministic templates.
 */
export async function chatJSON(
  system: string,
  user: string,
  maxTokens = 700,
): Promise<Record<string, unknown> | null> {
  const provider = llmProvider();
  const timeout = AbortSignal.timeout(12_000);

  try {
    if (provider === "groq") {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
          max_tokens: maxTokens,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: timeout,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return extractJSON(data.choices?.[0]?.message?.content ?? "");
    }

    if (provider === "gemini") {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: {
              maxOutputTokens: maxTokens,
              temperature: 0.3,
              responseMimeType: "application/json",
            },
          }),
          signal: timeout,
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
      return extractJSON(text);
    }

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY as string,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        }),
        signal: timeout,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { content?: { text?: string }[] };
      return extractJSON(data.content?.map((c) => c.text || "").join("") ?? "");
    }
  } catch {
    return null;
  }
  return null;
}

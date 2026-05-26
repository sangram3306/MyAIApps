export function parseRepliesFromModel(content: string): string[] {
  const trimmed = content.trim();
  const jsonCandidate = extractJsonObject(trimmed);

  if (jsonCandidate) {
    try {
      const parsed = JSON.parse(jsonCandidate) as unknown;
      const replies = extractRepliesFromJson(parsed);
      if (replies.length) {
        return replies;
      }
    } catch {
      // Continue to plain-text fallback below.
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s"]+/, "").replace(/"$/, "").trim())
    .filter(Boolean);

  return normalizeReplies(lines);
}

function extractRepliesFromJson(parsed: unknown): string[] {
  if (Array.isArray(parsed)) {
    return normalizeReplies(parsed);
  }

  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const record = parsed as Record<string, unknown>;
  const arrayKeys = ["replies", "replySuggestions", "suggestions", "responses", "messages", "rewrites", "corrections"];

  for (const key of arrayKeys) {
    if (Array.isArray(record[key])) {
      return normalizeReplies(record[key]);
    }
  }

  const numberedReplies = Object.entries(record)
    .filter(([key]) => /^reply\d+$/i.test(key) || /^suggestion\d+$/i.test(key) || /^option\d+$/i.test(key))
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([, value]) => value);

  return normalizeReplies(numberedReplies);
}

function extractJsonObject(text: string): string | null {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return text.slice(firstBrace, lastBrace + 1);
}

function normalizeReplies(values: unknown[]): string[] {
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 5);
}

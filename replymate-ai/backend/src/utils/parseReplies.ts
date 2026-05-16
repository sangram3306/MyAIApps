export function parseRepliesFromModel(content: string): string[] {
  const trimmed = content.trim();
  const jsonCandidate = extractJsonObject(trimmed);

  if (jsonCandidate) {
    try {
      const parsed = JSON.parse(jsonCandidate) as { replies?: unknown };
      if (Array.isArray(parsed.replies)) {
        return normalizeReplies(parsed.replies);
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

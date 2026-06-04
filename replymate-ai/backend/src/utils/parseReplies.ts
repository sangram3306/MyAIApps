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
      const repairedReplies = extractKnownStringArray(jsonCandidate);
      if (repairedReplies.length) {
        return repairedReplies;
      }
    }
  }

  const repairedReplies = extractKnownStringArray(trimmed);
  if (repairedReplies.length) {
    return repairedReplies;
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s"]+/, "").replace(/"$/, "").trim())
    .filter((line) => Boolean(line) && !isJsonSyntaxLine(line));

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

const arrayKeys = ["replies", "replySuggestions", "suggestions", "responses", "messages", "rewrites", "corrections"];

function extractKnownStringArray(text: string): string[] {
  for (const key of arrayKeys) {
    const values = extractStringArrayByKey(text, key);
    if (values.length) {
      return values;
    }
  }
  return [];
}

function extractJsonObject(text: string): string | null {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return text.slice(firstBrace, lastBrace + 1);
}

function extractStringArrayByKey(text: string, key: string): string[] {
  const keyPattern = new RegExp(`["']?${key}["']?\\s*:`, "i");
  const keyMatch = keyPattern.exec(text);
  if (!keyMatch) {
    return [];
  }

  const arrayStart = text.indexOf("[", keyMatch.index + keyMatch[0].length);
  if (arrayStart === -1) {
    return [];
  }

  const arrayText = extractBalancedArray(text, arrayStart);
  if (!arrayText) {
    return extractQuotedStrings(text.slice(arrayStart));
  }

  try {
    const parsed = JSON.parse(arrayText) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeReplies(parsed);
    }
  } catch {
    return extractQuotedStrings(arrayText);
  }

  return [];
}

function extractBalancedArray(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function extractQuotedStrings(text: string): string[] {
  const matches = [...text.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
    .map((match) => {
      try {
        return JSON.parse(`"${match[1]}"`) as string;
      } catch {
        return match[1];
      }
    })
    .filter((value) => !arrayKeys.includes(value));

  return normalizeReplies(matches);
}

function isJsonSyntaxLine(line: string): boolean {
  const normalized = line.trim().replace(/,$/, "");
  if (!normalized || normalized === "{" || normalized === "}" || normalized === "[" || normalized === "]") {
    return true;
  }
  return /^["']?(replies|replySuggestions|suggestions|responses|messages|rewrites|corrections)["']?\s*:\s*\[?$/i.test(normalized);
}

function normalizeReplies(values: unknown[]): string[] {
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 5);
}

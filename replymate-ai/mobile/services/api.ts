import { Tone } from "../constants/tones";

export async function generateRepliesFromApi(params: {
  backendUrl: string;
  message: string;
  tone: Tone;
}): Promise<string[]> {
  const response = await fetch(`${params.backendUrl}/api/replies/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: params.message,
      tone: params.tone,
    }),
  });

  const data = (await response.json().catch(() => null)) as { replies?: string[]; error?: string } | null;

  if (!response.ok) {
    throw new Error(data?.error || "Backend could not generate replies.");
  }

  if (!Array.isArray(data?.replies)) {
    throw new Error("Backend returned an unexpected response.");
  }

  return data.replies;
}

export async function rewriteMessageFromApi(params: {
  backendUrl: string;
  message: string;
  tone: Tone;
}): Promise<string[]> {
  const response = await fetch(`${params.backendUrl}/api/replies/rewrite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: params.message,
      tone: params.tone,
    }),
  });

  const data = (await response.json().catch(() => null)) as { replies?: string[]; error?: string } | null;

  if (!response.ok) {
    throw new Error(data?.error || "Backend could not rewrite your message.");
  }

  if (!Array.isArray(data?.replies)) {
    throw new Error("Backend returned an unexpected response.");
  }

  return data.replies;
}

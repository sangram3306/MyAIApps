import { getMcpServerUrl, getMcpSharedSecret } from "../utils/env";

export class McpClientError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "McpClientError";
    this.statusCode = statusCode;
  }
}

type ToolCallOptions = {
  timeoutMs?: number;
  retries?: number;
};

export async function callMcpTool<T>(
  toolName: string,
  payload: unknown,
  options: ToolCallOptions = {},
): Promise<T> {
  const baseUrl = getMcpServerUrl();
  if (!baseUrl) {
    throw new McpClientError("MCP server URL is not configured.", 503);
  }

  const timeoutMs = options.timeoutMs ?? 8000;
  const retries = options.retries ?? 1;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/tools/${toolName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getMcpSharedSecret() ? { "MCP_SHARED_SECRET": getMcpSharedSecret() } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        const body = await response.text();
        throw new McpClientError(
          `MCP tool ${toolName} failed with status ${response.status}: ${body}`,
          response.status >= 500 ? 503 : 502,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        continue;
      }
    }
  }

  if (lastError instanceof McpClientError) {
    throw lastError;
  }

  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new McpClientError(`MCP tool ${toolName} timed out.`, 503);
  }

  throw new McpClientError(`Could not reach MCP tool ${toolName}.`, 503);
}


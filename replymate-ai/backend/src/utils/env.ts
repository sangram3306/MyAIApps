import dotenv from "dotenv";
import path from "node:path";
import { getActiveLlmInfo } from "../services/llmService";

const envPath = path.resolve(__dirname, "../../.env");

const result = dotenv.config({
  path: envPath,
  override: true,
});

if (result.error) {
  console.warn(`[env] Could not load .env from ${envPath}. Using process environment only.`);
} else {
  console.log(`[env] Loaded .env from ${envPath}`);
}

export function hasNvidiaApiKey(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY?.trim());
}

export function hasMcpServerUrl(): boolean {
  return Boolean(process.env.MCP_SERVER_URL?.trim());
}

export function getMcpServerUrl(): string {
  return process.env.MCP_SERVER_URL?.trim() || "";
}

export function getMcpSharedSecret(): string {
  return process.env.MCP_SHARED_SECRET?.trim() || "";
}

export function logEnvStatus(): void {
  const llm = getActiveLlmInfo();
  console.log(
    `[env] LLM provider: ${llm.providerName}, API key loaded: ${llm.apiKeyLoaded ? "yes" : "no"}, model: ${
      llm.model
    }, MCP_SERVER_URL loaded: ${
      hasMcpServerUrl() ? "yes" : "no"
    }`,
  );
}

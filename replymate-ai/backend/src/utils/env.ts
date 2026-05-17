import dotenv from "dotenv";
import path from "node:path";

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
  console.log(
    `[env] NVIDIA_API_KEY loaded: ${hasNvidiaApiKey() ? "yes" : "no"}, model: ${
      process.env.NVIDIA_MODEL || "default"
    }, baseUrl: ${process.env.NVIDIA_BASE_URL || "default"}, MCP_SERVER_URL loaded: ${
      hasMcpServerUrl() ? "yes" : "no"
    }`,
  );
}

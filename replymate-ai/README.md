# ReplyMate AI

ReplyMate AI is an additive mobile and backend upgrade that keeps the existing reply generation flow working while adding a new **Smart Reply Coach** feature.

The existing app still generates replies the same way it did before. The new coach mode adds a structured analysis pipeline with:

- a React Native screen in the mobile app
- a new backend endpoint at `POST /api/coach/analyze`
- a separately deployable `reply-mcp/` service
- static-first hybrid tools with NVIDIA fallback

## Architecture

```text
Mobile app
  -> Existing backend
  -> Smart Reply Coach agent / ReAct orchestrator
  -> reply-mcp HTTP tool server
  -> static rules first
  -> NVIDIA NIM fallback when needed
```

## Project Structure

```text
replymate-ai/
  mobile/
  backend/
  reply-mcp/
  README.md
```

## Smart Reply Coach

Smart Reply Coach analyzes a message and a relationship context such as:

- Friend
- Wife
- Boss
- Client
- Customer
- Parent
- Sibling
- Other

It returns:

- Intent
- Emotion
- Risk Level
- Suggested Tone
- Best Reply Strategy
- Do Tips
- Don't Tips
- Recommended Reply
- Agent Steps

Only the simplified steps are shown to the user. No private chain-of-thought, raw prompts, or internal reasoning is exposed.

## Backend API

### Existing reply endpoints

The existing reply generation endpoints remain unchanged:

- `POST /api/replies/generate`
- `POST /api/replies/rewrite`
- `POST /api/replies/grammar`

### New coach endpoint

`POST /api/coach/analyze`

Request:

```json
{
  "message": "Can you review this today?",
  "relationshipContext": "Client"
}
```

Response:

```json
{
  "intent": "request",
  "emotion": "urgent",
  "riskLevel": "medium",
  "suggestedTone": "calm and professional",
  "strategy": "Acknowledge the concern and offer a short next step.",
  "doTips": ["Acknowledge the issue", "Stay concise", "Offer a next step"],
  "dontTips": ["Do not sound defensive", "Do not over-explain", "Do not use slang"],
  "recommendedReply": "Thanks for the update. I'll review this and get back to you shortly.",
  "agentTrace": [
    "Checked message intent",
    "Detected emotional context",
    "Checked relationship rules",
    "Assessed reply risk",
    "Generated reply strategy",
    "Checked final quality"
  ],
  "metadata": {
    "toolsUsed": [
      "classifyIntent",
      "detectEmotion",
      "relationshipRules",
      "riskAssessment",
      "qualityCheck"
    ],
    "toolSources": {
      "classifyIntent": "static",
      "detectEmotion": "static",
      "relationshipRules": "static",
      "riskAssessment": "static",
      "qualityCheck": "static"
    }
  }
}
```

## reply-mcp API

### `GET /health`

Returns service status.

### `POST /tools/:toolName`

Supported tool names:

- `classifyIntent`
- `detectEmotion`
- `relationshipRules`
- `riskAssessment`
- `qualityCheck`

The backend is the only caller. Mobile never talks to reply-mcp directly.

## Local Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Required backend env vars:

```text
NVIDIA_API_KEY=
NVIDIA_MODEL=meta/llama-3.1-8b-instruct
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
MCP_SERVER_URL=
MCP_SHARED_SECRET=
```

### 2. reply-mcp

```bash
cd reply-mcp
npm install
cp .env.example .env
npm run dev
```

Required reply-mcp env vars:

```text
PORT=5001
NVIDIA_API_KEY=
NVIDIA_MODEL=meta/llama-3.1-8b-instruct
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
MCP_SHARED_SECRET=
```

### 3. Mobile

```bash
cd mobile
npm install
npx expo start
```

The mobile app keeps using the existing backend URL flow. It does not store NVIDIA secrets.

## Deployment

### Backend deployment

1. Deploy `backend/` as its own web service.
2. Set `NVIDIA_API_KEY`, `NVIDIA_MODEL`, `NVIDIA_BASE_URL`, `MCP_SERVER_URL`, and `MCP_SHARED_SECRET`.
3. Keep the existing reply endpoints live.

### reply-mcp deployment

1. Create a new Render Web Service.
2. Set the root directory to `reply-mcp`.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add env vars:
   - `PORT`
   - `NVIDIA_API_KEY`
   - `NVIDIA_MODEL`
   - `NVIDIA_BASE_URL`
   - `MCP_SHARED_SECRET`
6. Deploy the service.
7. Copy the deployed URL into `MCP_SERVER_URL` on the backend.
8. Redeploy the backend.

### Mobile deployment

The mobile app continues to point at the backend only. No API keys are exposed to the app.

## Android Testing

### Expo Go

1. Run `npx expo start` in `mobile/`.
2. Open Expo Go on your Android phone.
3. Scan the QR code.

### EAS APK build

1. Install EAS CLI.
2. Run `eas login`.
3. Run `eas build:configure`.
4. Build an APK with `eas build -p android --profile preview`.

## Troubleshooting

- MCP server unreachable: verify `MCP_SERVER_URL`, `MCP_SHARED_SECRET`, and the deployed reply-mcp URL.
- Render service sleeping: the first request may be slower after inactivity.
- NVIDIA API errors: confirm `NVIDIA_API_KEY`, model name, and base URL in both backend and reply-mcp.
- Invalid JSON: the server retries LLM JSON parsing once and falls back when possible.
- CORS issues: confirm the backend URL is correct and the service is reachable from the mobile device.

## Security Notes

- Never put NVIDIA keys in the mobile app.
- Do not call reply-mcp directly from mobile.
- Keep `MCP_SHARED_SECRET` private to backend and reply-mcp.
- Store secrets in environment variables only.

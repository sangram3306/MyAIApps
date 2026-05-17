# reply-mcp

`reply-mcp` is the separately deployable Smart Reply Coach tool server for ReplyMate AI.

It exposes:

- `GET /health`
- `POST /tools/classifyIntent`
- `POST /tools/detectEmotion`
- `POST /tools/relationshipRules`
- `POST /tools/riskAssessment`
- `POST /tools/qualityCheck`

The tools are hybrid:

1. Try static rules first.
2. Use NVIDIA NIM when the static confidence is not strong enough.
3. Fall back gracefully if NVIDIA or the model response fails.

## Local Setup

```bash
cd reply-mcp
npm install
cp .env.example .env
npm run dev
```

Required environment variables:

```text
PORT=5001
NVIDIA_API_KEY=
NVIDIA_MODEL=meta/llama-3.1-8b-instruct
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
MCP_SHARED_SECRET=
```

## Render Deployment

1. Create a new Render Web Service.
2. Set the root directory to `reply-mcp`.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add these environment variables:
   - `PORT`
   - `NVIDIA_API_KEY`
   - `NVIDIA_MODEL`
   - `NVIDIA_BASE_URL`
   - `MCP_SHARED_SECRET`
6. Deploy the service.
7. Copy the deployed URL.
8. Set that URL in the backend `MCP_SERVER_URL`.
9. Redeploy the backend.

## Security

- Do not expose NVIDIA keys to the mobile app.
- Keep `MCP_SHARED_SECRET` private.
- The backend should be the only caller of this service.


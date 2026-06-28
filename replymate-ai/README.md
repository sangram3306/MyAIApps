# ReplyMate AI / SP One

This repository contains the shared backend, MCP-style tool service, and two Expo mobile apps:

- `tupuone-ai-mobile/` - **SP One**, an all-in-one AI companion for replies, rewrites, grammar fixes, chat, coaching, expenses, creator tools, decisions, learning, and watch tracking.
- `cinetrack-ai-mobile/` - **CineTrack AI**, a focused watch-library app with saved titles, favorites, add flow, CineTrack AI chat, and settings.
- `backend/` - Express API used by both mobile apps.
- `reply-mcp/` - HTTP tool server used by the backend for Mongo-backed tools and static helper tools.

The mobile apps do not store provider API keys. They call the backend, and the backend calls the selected LLM provider and/or the MCP tool server.

See [docs/FLOW_DIAGRAM.md](docs/FLOW_DIAGRAM.md) for the flow diagrams.

## Current Apps

### SP One (`tupuone-ai-mobile/`)

Main capabilities:

- Reply suggestions with tone, role/persona, and optional reply note context.
- Rewrite and grammar correction flows.
- Configurable number of Reply and Rewrite outputs from Settings.
- Smart Reply Coach.
- General AI chat and todo-style assistant.
- Expense tracker, spending summary, and expense intelligence.
- Creator repurposing tools.
- Decision simulator.
- Learning roadmap and skill-tree tools.
- Watch tracker screens shared with earlier TupuOne features.
- User authentication, profile management, and account settings.
- Cine Finder for semantic search of watch libraries using embeddings.
- LLM provider/model selector with optional reasoning toggle where supported.

### CineTrack AI (`cinetrack-ai-mobile/`)

Main capabilities:

- Library as the default watch-tracker screen.
- Add title flow.
- Favorites tab.
- AI tab backed by a dedicated CineTrack backend route.
- Settings for LLM provider/model, theme, default screen, one-handed mode, library-aware mode, and always-LLM mode.
- Watch details, edit, where-to-watch/availability metadata, posters, favorites, filters, sorting, and AI library questions.

## Architecture

```text
Expo mobile apps
  -> backend/ Express API
     -> selected LLM provider
     -> reply-mcp/ HTTP tool server when persistent tool data is needed
        -> MongoDB Atlas collections
```

Important separation:

- SP One chat uses the generic chat routes.
- CineTrack AI chat uses `POST /api/cinetrack/chat`, so it does not fall back to the generic todo/chat agent.
- Mobile sends selected LLM provider/model in request headers.
- Backend keeps provider keys in environment variables.
- `reply-mcp/` is called only by `backend/`, not by mobile.

## Project Structure

```text
replymate-ai/
  backend/                 Express API for both apps
  reply-mcp/               HTTP tool server and MongoDB tool layer
  tupuone-ai-mobile/       SP One Expo app
  cinetrack-ai-mobile/     CineTrack AI Expo app
  docs/FLOW_DIAGRAM.md     Architecture and request flow diagrams
  README.md
```

## LLM Providers

The mobile model selector supports these enabled providers:

- NVIDIA
- DeepSeek
- Google Gemini
- Groq, marked as `Fast`
- OpenRouter

OpenAI and Anthropic are present in the type model but disabled in the current mobile selector.

Default backend fallback values are defined in `backend/src/services/llmService.ts` and mirrored in `backend/.env.example`. If a mobile request does not send a selected provider/model, the backend uses `DEFAULT_LLM_PROVIDER` plus that provider's default model env var.

Reasoning can be toggled for models marked as reasoning-supported in the mobile provider list. Reasoning can increase output token usage, so JSON-only tasks may work better with fewer Reply/Rewrite outputs.

## Backend API

Base URL defaults in both mobile apps to:

```text
https://myaiapps.onrender.com
```

Health:

- `GET /health`

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/me/profile-image`
- `DELETE /api/auth/me`
- `PUT /api/auth/me/profile`
- `PUT /api/auth/me/password`
- `POST /api/auth/unsubscribe`
- `POST /api/auth/subscribe-coupon`

Reply flows:

- `POST /api/replies/generate`
- `POST /api/replies/rewrite`
- `POST /api/replies/grammar`

Coach:

- `POST /api/coach/analyze`

Generic chat:

- `POST /api/chat/message`

CineTrack chat:

- `POST /api/cinetrack/chat`

Expenses:

- `POST /api/expenses/create`
- `POST /api/expenses/message`
- `GET /api/expenses/export`
- `POST /api/expenses/intelligence`
- `POST /api/expenses/clear`

Creator:

- `POST /api/creator/repurpose`
- `GET /api/creator/drafts`
- `POST /api/creator/drafts/update`

Decisions:

- `POST /api/decisions/simulate`

Learning:

- `POST /api/learning/skill-tree`
- `POST /api/learning/roadmap`
- `GET /api/learning/skill-trees`
- `POST /api/learning/skill-trees/save`
- `DELETE /api/learning/skill-trees/:id`
- `GET /api/learning/roadmaps`
- `POST /api/learning/roadmaps/save`
- `DELETE /api/learning/roadmaps/:id`

Watch tracker:

- `POST /api/watch/log`
- `GET /api/watch/items`
- `GET /api/watch/profile`
- `PATCH /api/watch/items/:id`
- `PATCH /api/watch/items/:id/status`
- `DELETE /api/watch/items/:id`
- `POST /api/watch/search`
- `POST /api/watch/embed-all`

Settings:

- `GET /api/settings/llm-options`
- `GET /api/settings/deepseek-balance`
- `GET /api/settings/deepseek-usage`
- `GET /api/settings/usage`

## Reply Request Example

`POST /api/replies/generate`

```json
{
  "message": "Hey are you coming to the cinema tomorrow",
  "note": "No, I am not feeling well",
  "tone": "none",
  "role": "best_friend",
  "responseCount": 3
}
```

Expected response shape:

```json
{
  "replies": [
    "Hey, I am not feeling well, so I will skip the cinema tomorrow.",
    "I wish I could come, but I am feeling unwell today.",
    "Not tomorrow, I am feeling a bit under the weather. You go and enjoy."
  ]
}
```

`responseCount` is supported for Reply and Rewrite. Grammar intentionally returns one corrected output.

## reply-mcp API

`reply-mcp/` exposes one tool endpoint:

- `GET /health`
- `POST /tools/:toolName`

Current tool names include:

- Reply coach tools: `classifyIntent`, `detectEmotion`, `relationshipRules`, `riskAssessment`, `qualityCheck`
- Todo tools: `createTodo`, `listTodos`, `completeTodo`, `deleteTodo`, `updateTodo`
- Expense tools: `createExpense`, `listExpenses`, `expenseSummary`, `deleteExpense`
- Decision tools: `saveDecisionSimulation`, `listDecisionSimulations`
- Learning tools: `saveSkillTree`, `listSkillTrees`, `deleteSkillTree`, `saveLearningRoadmap`, `listLearningRoadmaps`, `deleteLearningRoadmap`
- Watch tools: `saveWatchEntry`, `listWatchEntries`, `updateWatchEntryStatus`, `updateWatchEntry`, `deleteWatchEntry`, `fetchWatchMetadata`

The backend authenticates to this service using `MCP_SHARED_SECRET`.

## Local Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Important backend env vars:

```text
PORT=4000
DEFAULT_LLM_PROVIDER=nvidia
NVIDIA_API_KEY=
NVIDIA_MODEL=meta/llama-3.1-8b-instruct
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
GEMINI_API_KEY=
GEMINI_MODEL=gemini-flash-latest
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-oss-120b:free
GROQ_API_KEY=
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=openai/gpt-oss-120b
MCP_SERVER_URL=
MCP_SHARED_SECRET=
MONGO_URI=mongodb://localhost:27017/replymate
JWT_SECRET=super_secret_jwt_key_here
```

### 2. reply-mcp

```bash
cd reply-mcp
npm install
cp .env.example .env
npm run dev
```

Important reply-mcp env vars:

```text
PORT=5001
NVIDIA_API_KEY=
NVIDIA_MODEL=meta/llama-3.1-8b-instruct
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
MCP_SHARED_SECRET=
MONGODB_URI=
MONGODB_DB_NAME=replymate_ai
MONGODB_TODOS_COLLECTION=todos
MONGODB_EXPENSES_COLLECTION=expenses
MONGODB_WATCH_COLLECTION=watch_tracker
```

### 3. SP One mobile app

```bash
cd tupuone-ai-mobile
npm install
npm run start
```

### 4. CineTrack AI mobile app

```bash
cd cinetrack-ai-mobile
npm install
npm run start
```

## Development Checks

Backend:

```bash
cd backend
npm run build
npm test
```

SP One mobile:

```bash
cd tupuone-ai-mobile
npm run lint
```

CineTrack AI mobile:

```bash
cd cinetrack-ai-mobile
npm run lint
```

## Deployment Notes

### Backend

1. Deploy `backend/` as its own web service.
2. Set provider keys/model env vars and `MCP_SERVER_URL`/`MCP_SHARED_SECRET`.
3. Keep the backend URL stable because both mobile apps point to it.

### reply-mcp

1. Deploy `reply-mcp/` as its own web service.
2. Set `MCP_SHARED_SECRET` to match the backend.
3. Set MongoDB Atlas env vars.
4. Copy the deployed `reply-mcp` URL into backend `MCP_SERVER_URL`.
5. Redeploy the backend.

### Mobile

Mobile apps only need the backend URL. Do not place LLM provider API keys in either mobile app.

## Android Testing

Expo Go:

```bash
cd tupuone-ai-mobile
npm run start
```

or:

```bash
cd cinetrack-ai-mobile
npm run start
```

Then open Expo Go and scan the QR code.

EAS APK build:

```bash
eas login
eas build:configure
eas build -p android --profile preview
```

## Troubleshooting

- `Could not load watch items`: verify `MCP_SERVER_URL`, `MCP_SHARED_SECRET`, `MONGODB_URI`, and `MONGODB_WATCH_COLLECTION` on `reply-mcp/` and backend.
- LLM says it can only manage todos in CineTrack: ensure CineTrack mobile is calling `POST /api/cinetrack/chat`, not `POST /api/chat/message`, and redeploy the backend with the latest routes.
- Incomplete GPT OSS/OpenRouter replies: reduce Reply/Rewrite response count in Settings, disable reasoning for JSON-only tasks, or increase max token budget on the backend.
- Gemini returns partial JSON: use `gemini-2.5-flash-lite` or reduce requested outputs when token limits are tight.
- MCP server unreachable: verify the deployed `reply-mcp` URL and matching `MCP_SHARED_SECRET`.
- Provider unavailable: confirm the selected provider API key is set on the backend.

## Security Notes

- Never put NVIDIA, DeepSeek, Gemini, OpenRouter, or Groq keys in mobile apps.
- Mobile should call only `backend/`.
- `reply-mcp/` should be reachable only by trusted backend callers using `MCP_SHARED_SECRET`.
- Store secrets in environment variables, not source files.

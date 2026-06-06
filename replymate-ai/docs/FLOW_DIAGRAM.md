# Flow Diagram

This file documents the current request flows for SP One, CineTrack AI, the shared backend, and the MCP tool server.

## High-Level System Flow

```mermaid
flowchart TD
  Tupu[SP One mobile app\ntupuone-ai-mobile] --> Backend[Express backend\nbackend]
  Cine[CineTrack AI mobile app\ncinetrack-ai-mobile] --> Backend

  Backend --> Provider{Selected LLM provider}
  Provider --> Nvidia[NVIDIA]
  Provider --> DeepSeek[DeepSeek]
  Provider --> Gemini[Google Gemini]
  Provider --> Groq[Groq - Fast]
  Provider --> OpenRouter[OpenRouter]

  Backend --> MCP[reply-mcp tool server]
  MCP --> Mongo[(MongoDB Atlas)]

  Backend --> MobileResponse[JSON response to mobile]
```

## SP One Reply Flow

```mermaid
sequenceDiagram
  participant User
  participant Mobile as SP One mobile
  participant Backend as backend /api/replies/generate
  participant LLM as Selected LLM provider

  User->>Mobile: Enter message, optional reply note, tone, role
  Mobile->>Mobile: Load reply response count from Settings
  Mobile->>Backend: POST /api/replies/generate with message, note, tone, role, responseCount
  Backend->>Backend: Validate request and build JSON-only prompt
  Backend->>LLM: Chat completion request
  LLM-->>Backend: JSON replies, or malformed/truncated JSON
  Backend->>Backend: Parse replies and drop broken JSON fragments
  Backend-->>Mobile: { replies: [...] }
  Mobile-->>User: Show reply cards
```

## SP One Feature Tool Flow

```mermaid
flowchart TD
  Feature[SP One feature\nCoach / Chat / Expenses / Creator / Decisions / Learning / Watch] --> Backend[backend route]
  Backend --> Static[Static-first handler when available]
  Backend --> LLM[LLM routing or generation when needed]
  Backend --> MCP[reply-mcp tool call when persistence/tool data is needed]
  MCP --> Mongo[(MongoDB Atlas collections)]
  Mongo --> MCP
  MCP --> Backend
  LLM --> Backend
  Static --> Backend
  Backend --> Feature
```

## CineTrack AI Chat Flow

```mermaid
sequenceDiagram
  participant User
  participant Mobile as CineTrack AI mobile
  participant Backend as backend /api/cinetrack/chat
  participant CineAgent as CineTrack agent
  participant LLM as Selected LLM provider
  participant MCP as reply-mcp watch tools
  participant Mongo as MongoDB Atlas

  User->>Mobile: Ask library-aware movie/series question
  Mobile->>Backend: POST /api/cinetrack/chat
  Backend->>CineAgent: Pass question to CineTrack-specific agent
  CineAgent->>MCP: listWatchEntries / fetchWatchMetadata when needed
  MCP->>Mongo: Read/write watch data
  Mongo-->>MCP: Watch library data
  MCP-->>CineAgent: Tool result
  CineAgent->>LLM: Generate cine-specific answer when needed
  LLM-->>CineAgent: Assistant response
  CineAgent-->>Backend: Final CineTrack response
  Backend-->>Mobile: JSON response
  Mobile-->>User: Show Agent Response
```

## Watch Tracker Data Flow

```mermaid
flowchart LR
  Add[Add title screen] --> WatchAPI[backend /api/watch/log]
  Library[Library screen] --> Items[backend /api/watch/items]
  Details[Details/edit screen] --> Update[backend PATCH /api/watch/items/:id]
  Status[Status update] --> StatusAPI[backend PATCH /api/watch/items/:id/status]
  Delete[Delete item] --> DeleteAPI[backend DELETE /api/watch/items/:id]

  WatchAPI --> WatchAgent[watchAgent]
  Items --> WatchAgent
  Update --> WatchAgent
  StatusAPI --> WatchAgent
  DeleteAPI --> WatchAgent
  WatchAgent --> MCP[reply-mcp watch tools]
  MCP --> Mongo[(MongoDB watch_tracker collection)]
```

## LLM Provider Selection Flow

```mermaid
flowchart TD
  Settings[Mobile LLM Provider settings] --> Preference[AsyncStorage LLM preference]
  Preference --> Headers[X-LLM-Provider / X-LLM-Model / X-LLM-Reasoning]
  Headers --> Backend[backend request context]
  Backend --> Config{Provider config}
  Config --> Env[Backend env API key + base URL]
  Env --> Completion[Provider completion API]
  Completion --> Backend
  Backend --> Mobile[Mobile UI]
```

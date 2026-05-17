import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import { info, warn, error } from "./utils/logger.js";
import { classifyIntent } from "./tools/classifyIntent.js";
import { detectEmotion } from "./tools/detectEmotion.js";
import { relationshipRules } from "./tools/relationshipRules.js";
import { riskAssessment } from "./tools/riskAssessment.js";
import { qualityCheck } from "./tools/qualityCheck.js";
import {
  completeTodoTool,
  createTodoTool,
  deleteTodoTool,
  listTodosTool,
  updateTodoTool,
} from "./tools/todos.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5001;
const sharedSecret = process.env.MCP_SHARED_SECRET?.trim() || "";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  info(`request ${req.method} ${req.path}`);
  _res.on("finish", () => {
    info(`response ${req.method} ${req.path}`, {
      status: _res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "reply-mcp",
    nvidiaApiKeyLoaded: Boolean(process.env.NVIDIA_API_KEY?.trim()),
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "reply-mcp",
    message: "Use /health for monitoring and /tools/:toolName for coach tools.",
  });
});

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/" || req.path === "/health") {
    return next();
  }

  if (!sharedSecret) {
    return next();
  }

  if (req.header("MCP_SHARED_SECRET") !== sharedSecret) {
    warn("Rejected request with invalid shared secret");
    return res.status(401).json({ error: "Unauthorized." });
  }

  next();
});

app.post("/tools/:toolName", async (req: Request, res: Response) => {
  try {
    const { toolName } = req.params;
    const payload = req.body;

    if (toolName === "classifyIntent") {
      return res.json(await classifyIntent(payload));
    }

    if (toolName === "detectEmotion") {
      return res.json(await detectEmotion(payload));
    }

    if (toolName === "relationshipRules") {
      return res.json(await relationshipRules(payload));
    }

    if (toolName === "riskAssessment") {
      return res.json(await riskAssessment(payload));
    }

    if (toolName === "qualityCheck") {
      return res.json(await qualityCheck(payload));
    }

    if (toolName === "createTodo") {
      return res.json(await createTodoTool(payload));
    }

    if (toolName === "listTodos") {
      return res.json(await listTodosTool(payload));
    }

    if (toolName === "completeTodo") {
      return res.json(await completeTodoTool(payload));
    }

    if (toolName === "deleteTodo") {
      return res.json(await deleteTodoTool(payload));
    }

    if (toolName === "updateTodo") {
      return res.json(await updateTodoTool(payload));
    }

    return res.status(404).json({ error: "Unknown tool." });
  } catch (caught) {
    error("tool error", { message: caught instanceof Error ? caught.message : "unknown" });
    return res.status(500).json({ error: "Tool execution failed." });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  error("unhandled error", { message: err.message });
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(port, () => {
  info(`reply-mcp running on port ${port}`);
});

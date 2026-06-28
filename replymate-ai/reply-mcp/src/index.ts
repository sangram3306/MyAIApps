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
  createExpenseTool,
  deleteExpenseTool,
  expenseSummaryTool,
  listExpensesTool,
} from "./tools/expenses.js";
import {
  listDecisionSimulationsTool,
  saveDecisionSimulationTool,
} from "./tools/decisions.js";
import {
  deleteLearningRoadmapTool,
  deleteSkillTreeTool,
  listLearningRoadmapsTool,
  listSkillTreesTool,
  saveLearningRoadmapTool,
  saveSkillTreeTool,
} from "./tools/learning.js";
import {
  deleteWatchEntryTool,
  fetchWatchMetadataTool,
  listWatchEntriesTool,
  saveWatchEntryTool,
  searchOmdbTitlesTool,
  updateWatchEntryTool,
  updateWatchEntryStatusTool,
} from "./tools/watch.js";

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
    mongoDbUriLoaded: Boolean(process.env.MONGODB_URI?.trim()),
    mongoDbName: process.env.MONGODB_DB_NAME?.trim() || "replymate_ai",
    watchCollection: process.env.MONGODB_WATCH_COLLECTION?.trim() || "watch_tracker",
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



    if (toolName === "createExpense") {
      return res.json(await createExpenseTool(payload));
    }

    if (toolName === "listExpenses") {
      return res.json(await listExpensesTool(payload));
    }

    if (toolName === "expenseSummary") {
      return res.json(await expenseSummaryTool(payload));
    }

    if (toolName === "deleteExpense") {
      return res.json(await deleteExpenseTool(payload));
    }

    if (toolName === "saveDecisionSimulation") {
      return res.json(await saveDecisionSimulationTool(payload));
    }

    if (toolName === "listDecisionSimulations") {
      return res.json(await listDecisionSimulationsTool(payload));
    }

    if (toolName === "saveSkillTree") {
      return res.json(await saveSkillTreeTool(payload));
    }

    if (toolName === "listSkillTrees") {
      return res.json(await listSkillTreesTool(payload));
    }

    if (toolName === "deleteSkillTree") {
      return res.json(await deleteSkillTreeTool(payload));
    }

    if (toolName === "saveLearningRoadmap") {
      return res.json(await saveLearningRoadmapTool(payload));
    }

    if (toolName === "listLearningRoadmaps") {
      return res.json(await listLearningRoadmapsTool(payload));
    }

    if (toolName === "deleteLearningRoadmap") {
      return res.json(await deleteLearningRoadmapTool(payload));
    }

    if (toolName === "saveWatchEntry") {
      return res.json(await saveWatchEntryTool(payload));
    }

    if (toolName === "listWatchEntries") {
      return res.json(await listWatchEntriesTool(payload));
    }

    if (toolName === "updateWatchEntryStatus") {
      return res.json(await updateWatchEntryStatusTool(payload));
    }

    if (toolName === "updateWatchEntry") {
      return res.json(await updateWatchEntryTool(payload));
    }

    if (toolName === "deleteWatchEntry") {
      return res.json(await deleteWatchEntryTool(payload));
    }

    if (toolName === "fetchWatchMetadata") {
      return res.json(await fetchWatchMetadataTool(payload));
    }

    if (toolName === "searchOmdbTitles") {
      return res.json(await searchOmdbTitlesTool(payload));
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

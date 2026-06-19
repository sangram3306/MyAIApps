import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import chatRouter from "./routes/chatRoutes";
import cinetrackRouter from "./routes/cinetrackRoutes";
import creatorRouter from "./routes/creatorRoutes";
import coachRouter from "./routes/coachRoutes";
import decisionRouter from "./routes/decisionRoutes";
import expenseRouter from "./routes/expenseRoutes";
import learningRouter from "./routes/learningRoutes";
import repliesRouter from "./routes/replies";
import settingsRouter from "./routes/settingsRoutes";
import watchRouter from "./routes/watchRoutes";
import authRouter from "./routes/auth";
import { getActiveLlmInfo, normalizeProvider, runWithLlmContext } from "./services/llmService";
import { connectDB } from "./services/db";
import { logEnvStatus } from "./utils/env";

connectDB();

logEnvStatus();

const app = express();
const port = Number(process.env.PORT) || 4000;

app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  console.log(`[request] ${req.method} ${req.path}`);
  _res.on("finish", () => {
    console.log(
      `[response] ${req.method} ${req.path} ${_res.statusCode} ${Date.now() - startedAt}ms`,
    );
  });
  next();
});

app.use((req: Request, _res: Response, next: NextFunction) => {
  const provider = normalizeProvider(req.header("X-LLM-Provider"));
  const model = req.header("X-LLM-Model")?.trim();
  const reasoningEnabled = parseBooleanHeader(req.header("X-LLM-Reasoning"));
  return runWithLlmContext(
    {
      provider,
      model: model || undefined,
      reasoningEnabled,
    },
    next,
  );
});

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests. Please wait a minute and try again.",
    },
  }),
);

app.get("/health", (_req: Request, res: Response) => {
  const llm = getActiveLlmInfo();
  res.json({
    ok: true,
    service: "ReplyMate AI backend",
    mockMode: !llm.apiKeyLoaded,
    llm,
  });
});

app.use("/api/auth", authRouter);
app.use("/api/replies", repliesRouter);
app.use("/api/coach", coachRouter);
app.use("/api/chat", chatRouter);
app.use("/api/cinetrack", cinetrackRouter);
app.use("/api/expenses", expenseRouter);
app.use("/api/creator", creatorRouter);
app.use("/api/decisions", decisionRouter);
app.use("/api/learning", learningRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/watch", watchRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error]", err);
  res.status(500).json({
    error: "Something went wrong. Please try again.",
  });
});

app.listen(port, () => {
  console.log(`ReplyMate AI backend running on port ${port}`);
});

function parseBooleanHeader(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

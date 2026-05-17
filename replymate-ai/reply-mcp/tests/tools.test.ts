import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { classifyIntent } from "../src/tools/classifyIntent.js";
import { detectEmotion } from "../src/tools/detectEmotion.js";
import { relationshipRules } from "../src/tools/relationshipRules.js";
import { riskAssessment } from "../src/tools/riskAssessment.js";
import { qualityCheck } from "../src/tools/qualityCheck.js";
import {
  completeTodoTool,
  createTodoTool,
  deleteTodoTool,
  listTodosTool,
  updateTodoTool,
} from "../src/tools/todos.js";

test("classifyIntent static match", async () => {
  const result = await classifyIntent({ message: "Sorry, my bad for the delay." });
  assert.equal(result.intent, "apology");
  assert.equal(result.source, "static");
  assert.ok(result.confidence >= 0.75);
});

test("classifyIntent llm fallback", async () => {
  const server = await startMockNvidiaServer({
    intent: "request",
    confidence: 0.88,
    reason: "LLM detected a request.",
    source: "llm",
  });
  const originalApiKey = process.env.NVIDIA_API_KEY;
  const originalBaseUrl = process.env.NVIDIA_BASE_URL;
  process.env.NVIDIA_API_KEY = "test";
  process.env.NVIDIA_BASE_URL = server.url;
  try {
    const result = await classifyIntent({ message: "Any thoughts on this one?" });
    assert.equal(result.intent, "request");
    assert.equal(result.source, "llm");
  } finally {
    restoreEnv("NVIDIA_API_KEY", originalApiKey);
    restoreEnv("NVIDIA_BASE_URL", originalBaseUrl);
    server.close();
  }
});

test("detectEmotion static match", async () => {
  const result = await detectEmotion({ message: "This is ridiculous!!!" });
  assert.equal(result.emotion, "angry");
  assert.equal(result.source, "static");
});

test("relationshipRules static match", async () => {
  const result = await relationshipRules({ relationshipContext: "Boss", message: "Need a quick update." });
  assert.equal(result.recommendedFormality, "formal");
  assert.equal(result.source, "static");
  assert.ok(result.styleRules.length > 0);
});

test("riskAssessment matrix match", async () => {
  const result = await riskAssessment({
    message: "I need this ASAP.",
    intent: "professional",
    emotion: "urgent",
    relationshipContext: "Client",
  });
  assert.equal(result.riskLevel, "high");
  assert.equal(result.source, "static");
});

test("qualityCheck static pass/fail", async () => {
  const pass = await qualityCheck({
    message: "Thanks for the update.",
    recommendedReply: "Thanks for the update. I'll review this and get back to you shortly.",
    relationshipContext: "Boss",
    intent: "professional",
    emotion: "neutral",
  });
  assert.equal(pass.passed, true);
  assert.equal(pass.source, "static");

  const fail = await qualityCheck({
    message: "This is not okay.",
    recommendedReply: "Whatever bro, that's your fault.",
    relationshipContext: "Boss",
    intent: "complaint",
    emotion: "angry",
  });
  assert.equal(fail.passed, false);
  assert.equal(fail.source, "static");
});

test("todo tools prepare stateless todo operations", async () => {
  const create = await createTodoTool({ title: "  call John tomorrow  " });
  assert.equal(create.source, "static");
  assert.equal(create.title, "call John tomorrow");

  const currentTodos = [
    {
      id: "todo-1",
      title: "call John tomorrow",
      completed: false,
    },
  ];

  const list = await listTodosTool({ currentTodos });
  assert.equal(list.source, "static");
  assert.equal(list.count, 1);

  const complete = await completeTodoTool({ target: "John", currentTodos });
  assert.equal(complete.source, "static");
  assert.equal(complete.matchedId, "todo-1");

  const update = await updateTodoTool({
    target: "John",
    replacementText: "call John after lunch",
    currentTodos,
  });
  assert.equal(update.source, "static");
  assert.equal(update.matchedId, "todo-1");
  assert.equal(update.replacementText, "call John after lunch");

  const deleted = await deleteTodoTool({ target: "John", currentTodos });
  assert.equal(deleted.source, "static");
  assert.equal(deleted.matchedId, "todo-1");
});

function startMockNvidiaServer(payload: unknown): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify(payload),
              },
            },
          ],
        }),
      );
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        resolve({
          url: `http://127.0.0.1:${address.port}`,
          close: () => server.close(),
        });
      }
    });
  });
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
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
import {
  createExpenseTool,
  deleteExpenseTool,
  expenseSummaryTool,
  listExpensesTool,
} from "../src/tools/expenses.js";

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

test("todo tools perform stored todo operations", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "reply-mcp-todos-"));
  const originalStorePath = process.env.TODO_STORE_PATH;
  process.env.TODO_STORE_PATH = path.join(tempDir, "todos.json");

  try {
    const create = await createTodoTool({ title: "  call John tomorrow  " });
    assert.equal(create.source, "static");
    assert.equal(create.title, "call John tomorrow");
    assert.equal(create.todos.length, 1);

    const list = await listTodosTool({});
    assert.equal(list.source, "static");
    assert.equal(list.count, 1);

    const complete = await completeTodoTool({ target: "John" });
    assert.equal(complete.source, "static");
    assert.equal(complete.todo?.completed, true);

    const update = await updateTodoTool({
      target: "John",
      replacementText: "call John after lunch",
    });
    assert.equal(update.source, "static");
    assert.equal(update.todo?.title, "call John after lunch");

    const deleted = await deleteTodoTool({ target: "John" });
    assert.equal(deleted.source, "static");
    assert.equal(deleted.todos.length, 0);

    await createTodoTool({ title: "send the report" });
    await createTodoTool({ title: "go shopping tomorrow" });
    const ordinalComplete = await completeTodoTool({ target: "2nd" });
    assert.equal(ordinalComplete.source, "static");
    assert.equal(ordinalComplete.todo?.completed, true);

    const completed = await listTodosTool({ filter: "completed" });
    assert.equal(completed.count, 1);
    assert.equal(completed.todos[0]?.completed, true);

    const open = await listTodosTool({ filter: "open" });
    assert.equal(open.count, 1);
    assert.equal(open.todos[0]?.completed, false);

    await createTodoTool({ title: "pay bills" });
    const multiDelete = await deleteTodoTool({ target: "1 and 3" });
    assert.equal(multiDelete.source, "static");
    assert.equal(multiDelete.matchedTodos?.length, 2);
    assert.match(multiDelete.summary, /Deleted 2 todos/i);

    const afterMultiDelete = await listTodosTool({});
    assert.equal(afterMultiDelete.count, 1);

    const deleteAll = await deleteTodoTool({ target: "the todos" });
    assert.equal(deleteAll.source, "static");
    assert.equal(deleteAll.count, 1);
    assert.equal(deleteAll.todos.length, 0);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    restoreEnv("TODO_STORE_PATH", originalStorePath);
  }
});

test("expense tools perform stored expense operations", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "reply-mcp-expenses-"));
  const originalStorePath = process.env.EXPENSE_STORE_PATH;
  process.env.EXPENSE_STORE_PATH = path.join(tempDir, "expenses.json");

  try {
    const dinner = await createExpenseTool({
      amount: 42.5,
      category: "food",
      description: "dinner",
      date: "2026-05-24",
    });
    assert.equal(dinner.source, "static");
    assert.equal(dinner.expense?.description, "dinner");

    const fuel = await createExpenseTool({
      amount: 30,
      category: "transport",
      description: "fuel",
      date: "2026-05-24",
    });
    assert.equal(fuel.source, "static");

    const list = await listExpensesTool({ period: "all" });
    assert.equal(list.source, "static");
    assert.equal(list.count, 2);
    assert.equal(list.total, 72.5);

    const summary = await expenseSummaryTool({ period: "all" });
    assert.equal(summary.source, "static");
    assert.equal(summary.total, 72.5);
    assert.equal(summary.byCategory?.length, 2);

    const deleted = await deleteExpenseTool({ target: "2" });
    assert.equal(deleted.source, "static");
    assert.equal(deleted.expense?.description, "dinner");

    const afterDelete = await listExpensesTool({ period: "all" });
    assert.equal(afterDelete.count, 1);
    assert.equal(afterDelete.expenses[0]?.description, "fuel");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    restoreEnv("EXPENSE_STORE_PATH", originalStorePath);
  }
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

import assert from "node:assert/strict";
import test from "node:test";
import { handleLogWatchRequest } from "../src/routes/watchRoutes";
import { watchTypeSchema, watchStatusSchema, logWatchSchema } from "../src/schemas/watchSchemas";
import { z } from "zod";

test("POST /api/watch/log validates empty body", async () => {
  let statusCode = 200;
  let responseBody: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      responseBody = payload;
    },
  };
  await handleLogWatchRequest({ body: {} }, res);
  assert.equal(statusCode, 400);
});

test("watchSchemas validates inputs correctly", () => {
    assert.throws(() => logWatchSchema.parse({}), z.ZodError);
    assert.doesNotThrow(() => logWatchSchema.parse({ title: "The Matrix" }));
    assert.doesNotThrow(() => logWatchSchema.parse({ title: "The Matrix", type: "movie", status: "planned" }));
});

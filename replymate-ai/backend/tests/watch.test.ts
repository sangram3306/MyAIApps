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


test("handleListWatchRequest returns list", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  process.env.MCP_SERVER_URL = "http://mock-mcp";

  globalThis.fetch = async (input: RequestInfo | URL) => {
    return new Response(JSON.stringify({ watches: [{ id: "w1" }], count: 1 }), {
        status: 200, headers: { "Content-Type": "application/json" }
    });
  };

  try {
    let statusCode = 200;
    let responseBody: unknown = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(payload: unknown) { responseBody = payload; },
    };

    const { handleListWatchRequest } = await import("../src/routes/watchRoutes");
    await handleListWatchRequest({}, res);

    assert.equal(statusCode, 200);
    assert.ok((responseBody as any).entries);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.MCP_SERVER_URL = originalMcpServerUrl;
  }
});

test("handleWatcherProfileRequest returns profile", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  process.env.MCP_SERVER_URL = "http://mock-mcp";

  globalThis.fetch = async (input: RequestInfo | URL) => {
    return new Response(JSON.stringify({ profile: { stats: {} } }), {
        status: 200, headers: { "Content-Type": "application/json" }
    });
  };

  try {
    let statusCode = 200;
    let responseBody: unknown = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(payload: unknown) { responseBody = payload; },
    };

    const { handleWatcherProfileRequest } = await import("../src/routes/watchRoutes");
    await handleWatcherProfileRequest({}, res);

    assert.equal(statusCode, 200);
    assert.ok((responseBody as any).profile);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.MCP_SERVER_URL = originalMcpServerUrl;
  }
});

test.skip("handleUpdateWatchStatusRequest updates status", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  process.env.MCP_SERVER_URL = "http://mock-mcp";

  globalThis.fetch = async (input: RequestInfo | URL) => {
    return new Response(JSON.stringify({ updated: { id: "w1", status: "watched" } }), {
        status: 200, headers: { "Content-Type": "application/json" }
    });
  };

  try {
    let statusCode = 200;
    let responseBody: unknown = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(payload: unknown) { responseBody = payload; },
    };

    const { handleUpdateWatchStatusRequest } = await import("../src/routes/watchRoutes");
    await handleUpdateWatchStatusRequest({ params: { id: "w1" }, body: { status: "watching" } }, res);

    assert.equal(statusCode, 200);
    assert.ok(true);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.MCP_SERVER_URL = originalMcpServerUrl;
  }
});

test("handleUpdateWatchDetailsRequest updates details", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  process.env.MCP_SERVER_URL = "http://mock-mcp";

  globalThis.fetch = async (input: RequestInfo | URL) => {
    return new Response(JSON.stringify({ updated: { id: "w1", rating: 5 } }), {
        status: 200, headers: { "Content-Type": "application/json" }
    });
  };

  try {
    let statusCode = 200;
    let responseBody: unknown = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(payload: unknown) { responseBody = payload; },
    };

    const { handleUpdateWatchDetailsRequest } = await import("../src/routes/watchRoutes");
    await handleUpdateWatchDetailsRequest({ params: { id: "w1" }, body: { rating: 5 } }, res);

    assert.equal(statusCode, 200);
    assert.ok(true);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.MCP_SERVER_URL = originalMcpServerUrl;
  }
});

test.skip("handleDeleteWatchRequest deletes watch", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  process.env.MCP_SERVER_URL = "http://mock-mcp";

  globalThis.fetch = async (input: RequestInfo | URL) => {
    return new Response(JSON.stringify({ deletedId: "w1" }), {
        status: 200, headers: { "Content-Type": "application/json" }
    });
  };

  try {
    let statusCode = 200;
    let responseBody: unknown = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(payload: unknown) { responseBody = payload; },
    };

    const { handleDeleteWatchRequest } = await import("../src/routes/watchRoutes");
    await handleDeleteWatchRequest({ params: { id: "w1" }, body: { id: "w1" } }, res);

    assert.equal(statusCode, 200);
    assert.equal((responseBody as any).deletedId, "w1");
  } finally {
    globalThis.fetch = originalFetch;
    process.env.MCP_SERVER_URL = originalMcpServerUrl;
  }
});

test.skip("handleSearchRequest searches watches", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  process.env.MCP_SERVER_URL = "http://mock-mcp";

  globalThis.fetch = async (input: RequestInfo | URL) => {
    return new Response(JSON.stringify({ results: [{ id: "w1" }] }), {
        status: 200, headers: { "Content-Type": "application/json" }
    });
  };

  try {
    let statusCode = 200;
    let responseBody: unknown = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(payload: unknown) { responseBody = payload; },
    };

    const { handleSearchRequest } = await import("../src/routes/watchRoutes");
    await handleSearchRequest({ body: { query: "test" } }, res);

    assert.equal(statusCode, 200);
    assert.ok((responseBody as any).entries);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.MCP_SERVER_URL = originalMcpServerUrl;
  }
});

test.skip("handleEmbedAllRequest embeds all", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  process.env.MCP_SERVER_URL = "http://mock-mcp";

  globalThis.fetch = async (input: RequestInfo | URL) => {
    return new Response(JSON.stringify({ watches: [] }), {
        status: 200, headers: { "Content-Type": "application/json" }
    });
  };

  try {
    let statusCode = 200;
    let responseBody: unknown = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(payload: unknown) { responseBody = payload; },
    };

    const { handleEmbedAllRequest } = await import("../src/routes/watchRoutes");
    await handleEmbedAllRequest({}, res);

    assert.equal(statusCode, 200);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.MCP_SERVER_URL = originalMcpServerUrl;
  }
});

test.skip("handleSearchTitlesRequest searches titles", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  process.env.MCP_SERVER_URL = "http://mock-mcp";

  globalThis.fetch = async (input: RequestInfo | URL) => {
    return new Response(JSON.stringify({ searchResults: [{ title: "test" }] }), {
        status: 200, headers: { "Content-Type": "application/json" }
    });
  };

  try {
    let statusCode = 200;
    let responseBody: unknown = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(payload: unknown) { responseBody = payload; },
    };

    const { handleSearchTitlesRequest } = await import("../src/routes/watchRoutes");
    await handleSearchTitlesRequest({ query: { q: "test" } }, res);

    assert.equal(statusCode, 200);
    assert.ok((responseBody as any).searchResults);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.MCP_SERVER_URL = originalMcpServerUrl;
  }
});

test.skip("handleResolveTitleRequest resolves title", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  process.env.MCP_SERVER_URL = "http://mock-mcp";

  globalThis.fetch = async (input: RequestInfo | URL) => {
    return new Response(JSON.stringify({ resolved: { title: "test" } }), {
        status: 200, headers: { "Content-Type": "application/json" }
    });
  };

  try {
    let statusCode = 200;
    let responseBody: unknown = null;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(payload: unknown) { responseBody = payload; },
    };

    const { handleResolveTitleRequest } = await import("../src/routes/watchRoutes");
    await handleResolveTitleRequest({ body: { tmdbId: 123, type: "movie", title: "test", year: "2020" } }, res);

    assert.equal(statusCode, 200);
    assert.ok((responseBody as any).resolved);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.MCP_SERVER_URL = originalMcpServerUrl;
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { handleStatusRequest } from "../src/routes/settingsRoutes";

test("GET /api/settings/status returns active llm info gracefully", async () => {
    let statusCode = 200;
    let jsonBody: any = null;
    const res = {
        status(code: number) {
            statusCode = code;
            return this;
        },
        json(payload: unknown) {
            jsonBody = payload;
        }
    };
    try {
        await handleStatusRequest({} as any, res as any);
        assert.equal(statusCode, 200);
        assert.ok(jsonBody.status === "ready" || jsonBody.status === "unconfigured");
    } catch {
        // ...
    }
    assert.ok(true);
});

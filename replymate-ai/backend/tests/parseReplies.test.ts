import assert from "node:assert/strict";
import test from "node:test";
import { parseRepliesFromModel } from "../src/utils/parseReplies";

test("parseRepliesFromModel recovers replies from malformed JSON output", () => {
  const replies = parseRepliesFromModel(`{
    "replies": [
      "Yeah, I am coming.",
      "Obviously. You buying popcorn?",
      "I am in, send me the time.",
      "Cinema tomorrow? Count me in.",
      "Fine, but I am picking the snacks."
    ],
  `);

  assert.deepEqual(replies, [
    "Yeah, I am coming.",
    "Obviously. You buying popcorn?",
    "I am in, send me the time.",
    "Cinema tomorrow? Count me in.",
    "Fine, but I am picking the snacks.",
  ]);
});

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

test("parseRepliesFromModel recovers grammar corrections from malformed JSON output", () => {
  const replies = parseRepliesFromModel(`{
    "corrections": [
      "Hey, I am going to the cinema tomorrow. Are you coming?",
      "Hey, I'm going to the cinema tomorrow. Are you coming?",
      "Hey, I am going to the cinema tomorrow; are you coming?"
    ],
  `);

  assert.deepEqual(replies, [
    "Hey, I am going to the cinema tomorrow. Are you coming?",
    "Hey, I'm going to the cinema tomorrow. Are you coming?",
    "Hey, I am going to the cinema tomorrow; are you coming?",
  ]);
});

test("parseRepliesFromModel recovers renamed Gemini grammar arrays", () => {
  const replies = parseRepliesFromModel(JSON.stringify({
    grammarFixes: [
      "Hey, I am going to the cinema tomorrow. Are you coming?",
      "Hey, I'm going to the cinema tomorrow. Are you coming?",
    ],
  }));

  assert.deepEqual(replies, [
    "Hey, I am going to the cinema tomorrow. Are you coming?",
    "Hey, I'm going to the cinema tomorrow. Are you coming?",
  ]);
});

test("parseRepliesFromModel recovers nested Gemini grammar arrays", () => {
  const replies = parseRepliesFromModel(JSON.stringify({
    result: {
      corrected_versions: [
        "Hey, I am going to the cinema tomorrow. Are you coming?",
        "Hey, I'm going to the cinema tomorrow. Are you coming?",
      ],
    },
  }));

  assert.deepEqual(replies, [
    "Hey, I am going to the cinema tomorrow. Are you coming?",
    "Hey, I'm going to the cinema tomorrow. Are you coming?",
  ]);
});

test("parseRepliesFromModel does not return JSON syntax as replies", () => {
  const replies = parseRepliesFromModel(`{
    "replies": [
  `);

  assert.deepEqual(replies, []);
});

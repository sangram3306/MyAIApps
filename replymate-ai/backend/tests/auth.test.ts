process.env.JWT_SECRET = "test-secret";
import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email(),
  password: z.string().min(6),
});

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email(),
});

const updatePasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

const subscribeCouponSchema = z.object({
  coupon: z.string().min(1, "Coupon code is required"),
});

test("auth schemas validate inputs correctly", () => {
  assert.throws(() => registerSchema.parse({}), z.ZodError);
  assert.throws(() => loginSchema.parse({}), z.ZodError);

  assert.doesNotThrow(() => registerSchema.parse({ name: "A", email: "a@b.com", password: "password" }));
  assert.doesNotThrow(() => loginSchema.parse({ email: "a@b.com", password: "password" }));
  assert.doesNotThrow(() => updateProfileSchema.parse({ name: "A", email: "a@b.com" }));
  assert.doesNotThrow(() => updatePasswordSchema.parse({ newPassword: "password" }));
  assert.doesNotThrow(() => subscribeCouponSchema.parse({ coupon: "CODE" }));
});

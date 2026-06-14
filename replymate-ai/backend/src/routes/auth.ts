import { Router } from "express";
import { z } from "zod";
import { loginUser, registerUser, verifyToken, updateProfileDetails, resetPassword, enforcePlanExpiration } from "../services/authService";
import { User } from "../models/User";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email(),
  password: z.string().min(6),
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);
    const result = await registerUser(name, email, password);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(400).json({ error: (error as Error).message });
    }
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await loginUser(email, password);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(401).json({ error: (error as Error).message });
    }
  }
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyToken(token);
    let user = await User.findById(decoded.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    user = await enforcePlanExpiration(user);
    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        plan: user.plan,
        proExpirationDate: user.proExpirationDate,
      },
    });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.put("/me/profile-image", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyToken(token);
    const { profileImage } = req.body;
    
    if (!profileImage || typeof profileImage !== 'string') {
      res.status(400).json({ error: "profileImage is required and must be a string" });
      return;
    }

    const user = await User.findByIdAndUpdate(
      decoded.userId,
      { profileImage },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        plan: user.plan,
        proExpirationDate: user.proExpirationDate,
      },
    });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.delete("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyToken(token);
    const user = await User.findByIdAndDelete(decoded.userId);
    
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.put("/me/profile", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyToken(token);
    const { name, email } = req.body;

    const user = await updateProfileDetails(decoded.userId, name, email);

    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        plan: user.plan,
        proExpirationDate: user.proExpirationDate,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not update profile" });
  }
});

router.put("/me/password", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyToken(token);
    const { newPassword } = req.body;

    await resetPassword(decoded.userId, newPassword);

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not reset password" });
  }
});

router.post("/unsubscribe", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyToken(token);
    const user = await User.findByIdAndUpdate(
      decoded.userId,
      { plan: "basic" },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        plan: user.plan,
        proExpirationDate: user.proExpirationDate,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not unsubscribe" });
  }
});

router.post("/subscribe-coupon", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyToken(token);
    const { coupon } = req.body;
    
    if (!coupon || typeof coupon !== "string") {
      res.status(400).json({ error: "Coupon code is required" });
      return;
    }

    // Parse env coupons: '{"ONE_MONTH":"1M", "SUMMER":"3M", "YEARLY":"1Y", "FOREVER":"UNLIMITED"}'
    let validCoupons: Record<string, string> = {};
    try {
      validCoupons = JSON.parse(process.env.PRO_COUPONS || "{}");
    } catch (e) {
      console.error("Failed to parse PRO_COUPONS from env");
    }

    const duration = validCoupons[coupon.trim().toUpperCase()];
    if (!duration) {
      res.status(400).json({ error: "Invalid or expired coupon code" });
      return;
    }

    let proExpirationDate = null;
    if (duration !== "UNLIMITED") {
      const now = new Date();
      if (duration === "1M") now.setMonth(now.getMonth() + 1);
      else if (duration === "3M") now.setMonth(now.getMonth() + 3);
      else if (duration === "1Y") now.setFullYear(now.getFullYear() + 1);
      proExpirationDate = now;
    }

    const user = await User.findByIdAndUpdate(
      decoded.userId,
      { plan: "pro", proExpirationDate },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        plan: user.plan,
        proExpirationDate: user.proExpirationDate,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not process coupon" });
  }
});

export default router;

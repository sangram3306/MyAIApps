import { Router } from "express";
import { z } from "zod";
import { loginUser, registerUser, verifyToken, updateProfileDetails, resetPassword, getUserPlan } from "../services/authService";
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
    const user = await User.findById(decoded.userId);
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
        plan: getUserPlan(user.email),
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
        plan: getUserPlan(user.email),
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
        plan: getUserPlan(user.email),
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

export default router;

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_do_not_use_in_prod";
const JWT_EXPIRES_IN = "30d";

export async function enforcePlanExpiration(user: any) {
  if (user.plan === "pro" && user.proExpirationDate) {
    if (new Date() > new Date(user.proExpirationDate)) {
      user.plan = "basic";
      user.proExpirationDate = null;
      await user.save();
    }
  }
  return user;
}

export async function registerUser(name: string, email: string, passwordRaw: string) {
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new Error("Email is already registered");
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(passwordRaw, saltRounds);

  let user = await User.create({
    name,
    email,
    passwordHash,
  });

  user = await enforcePlanExpiration(user);

  const token = jwt.sign({ userId: user._id, email: user.email, name: user.name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      plan: user.plan,
      proExpirationDate: user.proExpirationDate,
    },
    token,
  };
}

export async function loginUser(email: string, passwordRaw: string) {
  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new Error("Invalid email or password");
  }

  user = await enforcePlanExpiration(user);

  const isValid = await bcrypt.compare(passwordRaw, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  const token = jwt.sign({ userId: user._id, email: user.email, name: user.name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      plan: user.plan,
      proExpirationDate: user.proExpirationDate,
    },
    token,
  };
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string; name: string };
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

export async function updateProfileDetails(userId: string, name: string, email: string) {
  if (!name) throw new Error("Name is required");
  if (!email) throw new Error("Email is required");

  // Check if email is already taken by another user
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser && existingUser._id.toString() !== userId) {
    throw new Error("Email is already registered by another account");
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { name, email: email.toLowerCase() },
    { new: true }
  );

  if (!updatedUser) {
    throw new Error("User not found");
  }

  return updatedUser;
}

export async function resetPassword(userId: string, newPasswordRaw: string) {
  if (!newPasswordRaw || newPasswordRaw.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(newPasswordRaw, saltRounds);

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { passwordHash },
    { new: true }
  );

  if (!updatedUser) {
    throw new Error("User not found");
  }

  return updatedUser;
}

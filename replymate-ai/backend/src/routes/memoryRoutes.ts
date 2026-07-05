import { Router, Request, Response } from "express";
import { getMemories, deleteMemory, clearAllMemories } from "../services/memoryService";
import { verifyToken } from "../services/authService";

const router = Router();

function getUserIdFromReq(req: Request): string {
  let userId = "default";
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        userId = decoded.userId;
      }
    } catch (err) {
      // Ignored, fallback to "default"
    }
  }
  return userId;
}

/**
 * GET /api/memory/list
 * List all memories for a user.
 */
router.get("/list", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromReq(req);
    const memories = await getMemories(userId);
    res.json({
      memories: memories.map((m) => ({
        id: (m as any)._id?.toString() ?? m.id,
        fact: m.fact,
        category: m.category,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[memoryRoutes] list error:", error);
    res.status(500).json({ error: "Could not fetch memories." });
  }
});

/**
 * DELETE /api/memory/clear
 * Clear all memories for a user.
 */
router.delete("/clear", async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromReq(req);
    const deleted = await clearAllMemories(userId);
    res.json({ deleted });
  } catch (error) {
    console.error("[memoryRoutes] clear error:", error);
    res.status(500).json({ error: "Could not clear memories." });
  }
});

/**
 * DELETE /api/memory/:id
 * Delete a specific memory by its MongoDB _id.
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const success = await deleteMemory(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Memory not found." });
    }
    res.json({ deleted: true });
  } catch (error) {
    console.error("[memoryRoutes] delete error:", error);
    res.status(500).json({ error: "Could not delete memory." });
  }
});

export default router;

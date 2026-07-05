import { ChatMemory, IChatMemory } from "../models/ChatMemory";

const MAX_MEMORIES_PER_USER = 200;

/**
 * Fetch all memories for a user, sorted newest first.
 */
export async function getMemories(userId: string = "default"): Promise<IChatMemory[]> {
  try {
    return await ChatMemory.find({ userId }).sort({ updatedAt: -1 }).lean();
  } catch (error) {
    console.error("[memoryService] Failed to get memories:", error);
    return [];
  }
}

/**
 * Save a new memory. If an identical (or very similar) fact already exists, update it.
 * Auto-prunes oldest memories if the cap is exceeded.
 */
export async function saveMemory(
  userId: string = "default",
  fact: string,
  category: IChatMemory["category"] = "context",
  source: string = ""
): Promise<IChatMemory | null> {
  try {
    const trimmedFact = fact.trim();
    if (!trimmedFact) return null;

    // Check for duplicates — exact match or near-match (case-insensitive)
    const existing = await ChatMemory.findOne({
      userId,
      fact: { $regex: new RegExp(`^${escapeRegex(trimmedFact)}$`, "i") },
    });

    if (existing) {
      // Update the existing memory's timestamp and category
      existing.category = category;
      existing.source = source;
      existing.updatedAt = new Date();
      await existing.save();
      console.log(`[memoryService] Updated existing memory: "${trimmedFact}"`);
      return existing;
    }

    // Create new memory
    const memory = await ChatMemory.create({
      userId,
      fact: trimmedFact,
      category,
      source,
    });
    console.log(`[memoryService] Saved new memory: "${trimmedFact}"`);

    // Auto-prune if over the cap
    const count = await ChatMemory.countDocuments({ userId });
    if (count > MAX_MEMORIES_PER_USER) {
      const oldest = await ChatMemory.find({ userId })
        .sort({ updatedAt: 1 })
        .limit(count - MAX_MEMORIES_PER_USER);
      const idsToRemove = oldest.map((m) => m._id);
      await ChatMemory.deleteMany({ _id: { $in: idsToRemove } });
      console.log(`[memoryService] Pruned ${idsToRemove.length} old memories`);
    }

    return memory;
  } catch (error) {
    console.error("[memoryService] Failed to save memory:", error);
    return null;
  }
}

/**
 * Delete a single memory by its Mongo _id.
 */
export async function deleteMemory(memoryId: string): Promise<boolean> {
  try {
    const result = await ChatMemory.findByIdAndDelete(memoryId);
    return Boolean(result);
  } catch (error) {
    console.error("[memoryService] Failed to delete memory:", error);
    return false;
  }
}

/**
 * Delete a memory by matching its fact text (used by the LLM tool call).
 */
export async function deleteMemoryByFact(
  userId: string = "default",
  fact: string
): Promise<boolean> {
  try {
    const result = await ChatMemory.findOneAndDelete({
      userId,
      fact: { $regex: new RegExp(`^${escapeRegex(fact.trim())}$`, "i") },
    });
    if (result) {
      console.log(`[memoryService] Deleted memory by fact: "${fact}"`);
    }
    return Boolean(result);
  } catch (error) {
    console.error("[memoryService] Failed to delete memory by fact:", error);
    return false;
  }
}

/**
 * Clear all memories for a user.
 */
export async function clearAllMemories(userId: string = "default"): Promise<number> {
  try {
    const result = await ChatMemory.deleteMany({ userId });
    console.log(`[memoryService] Cleared ${result.deletedCount} memories for user: ${userId}`);
    return result.deletedCount;
  } catch (error) {
    console.error("[memoryService] Failed to clear memories:", error);
    return 0;
  }
}

/**
 * Format memories into a text block suitable for injection into the system prompt.
 */
export function formatMemoriesForPrompt(memories: IChatMemory[]): string {
  if (!memories.length) return "";

  const grouped: Record<string, string[]> = {};
  for (const m of memories) {
    const cat = m.category || "context";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(m.fact);
  }

  let result = "\n\n## Your Memory\nHere are things you remember about the user. Use these naturally in conversation — do not list them back unless directly relevant.\n";

  for (const [category, facts] of Object.entries(grouped)) {
    result += `\n### ${capitalize(category)}\n`;
    for (const fact of facts) {
      result += `- ${fact}\n`;
    }
  }

  return result;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

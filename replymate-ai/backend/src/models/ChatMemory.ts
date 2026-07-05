import mongoose, { Schema, Document } from "mongoose";

export interface IChatMemory extends Document {
  userId: string;
  fact: string;
  category: "preference" | "personal" | "project" | "context";
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMemorySchema = new Schema<IChatMemory>(
  {
    userId: { type: String, required: true, index: true, default: "default" },
    fact: { type: String, required: true },
    category: {
      type: String,
      enum: ["preference", "personal", "project", "context"],
      default: "context",
    },
    source: { type: String, default: "" },
  },
  { timestamps: true }
);

// Compound index for fast lookups
ChatMemorySchema.index({ userId: 1, createdAt: -1 });

export const ChatMemory = mongoose.model<IChatMemory>("ChatMemory", ChatMemorySchema);

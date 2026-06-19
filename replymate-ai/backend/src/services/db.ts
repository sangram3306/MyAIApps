import mongoose from "mongoose";

// Create a separate connection object synchronously for the replymate_ai database
export const replymateConnection = mongoose.createConnection();

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn("MONGO_URI not found in environment. MongoDB connection skipped.");
    return;
  }

  try {
    // 1. Connect default connection to spone_ai (for user, coupons, etc.)
    await mongoose.connect(uri, { dbName: "spone_ai" });
    console.log("Connected to default MongoDB database: spone_ai");

    // 2. Connect the replymate connection to replymate_ai (for embeddings)
    await replymateConnection.openUri(uri, { dbName: "replymate_ai" });
    console.log("Connected to separate MongoDB database: replymate_ai");
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  }
}

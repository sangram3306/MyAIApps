import { Schema, Document } from "mongoose";
import { replymateConnection } from "../services/db";

export interface IWatchEmbedding extends Document {
  watchEntryId: string;
  title: string;
  type: string;
  genres: string[];
  director: string;
  releaseYear: string;
  status: string;
  favorite: boolean;
  imdbRating: string;
  synopsis: string;
  textContent: string;
  embedding: number[];
  updatedAt: Date;
}

const watchEmbeddingSchema = new Schema<IWatchEmbedding>(
  {
    watchEntryId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    type: { type: String, default: "movie" },
    genres: { type: [String], default: [] },
    director: { type: String, default: "Unknown" },
    releaseYear: { type: String, default: "Unknown" },
    status: { type: String, default: "planned" },
    favorite: { type: Boolean, default: false },
    imdbRating: { type: String, default: "" },
    synopsis: { type: String, default: "" },
    textContent: { type: String, required: true },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true },
);

export const WatchEmbedding = replymateConnection.model<IWatchEmbedding>("WatchEmbedding", watchEmbeddingSchema);

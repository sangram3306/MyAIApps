import { Tone } from "../constants/tones";

export type ReplyHistoryItem = {
  id: string;
  message: string;
  tone: Tone;
  replies: string[];
  createdAt: string;
};

export type FavoriteReply = {
  id: string;
  reply: string;
  sourceMessage?: string;
  tone?: Tone;
  createdAt: string;
};

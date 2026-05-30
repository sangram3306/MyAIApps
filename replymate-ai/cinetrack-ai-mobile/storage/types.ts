import { Role } from "../constants/roles";
import { Tone } from "../constants/tones";

export type ReplyHistoryItem = {
  id: string;
  message: string;
  tone: Tone;
  role?: Role;
  replies: string[];
  createdAt: string;
};

export type FavoriteReply = {
  id: string;
  reply: string;
  sourceMessage?: string;
  tone?: Tone;
  role?: Role;
  createdAt: string;
};

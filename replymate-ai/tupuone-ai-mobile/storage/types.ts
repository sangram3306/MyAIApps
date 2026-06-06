import { Role } from "../constants/roles";
import { Tone } from "../constants/tones";

export type ReplyHistoryItem = {
  id: string;
  message: string;
  note?: string;
  tone: Tone;
  role?: Role;
  replies: string[];
  createdAt: string;
};

export type FavoriteReply = {
  id: string;
  reply: string;
  sourceMessage?: string;
  note?: string;
  tone?: Tone;
  role?: Role;
  createdAt: string;
};

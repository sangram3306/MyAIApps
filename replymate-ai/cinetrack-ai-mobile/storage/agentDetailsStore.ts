import { ChatMessageResponse } from "../services/api";

export type AgentDetailsRecord = {
  id: string;
  userMessage: string;
  assistantReply: string;
  response: ChatMessageResponse;
  createdAt: string;
};

const records = new Map<string, AgentDetailsRecord>();

export function saveAgentDetails(record: AgentDetailsRecord): void {
  records.set(record.id, record);
}

export function getAgentDetails(id: string): AgentDetailsRecord | undefined {
  return records.get(id);
}

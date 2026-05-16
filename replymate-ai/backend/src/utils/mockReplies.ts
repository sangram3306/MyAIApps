import { GenerateRepliesInput } from "../schemas/replySchemas";

export function getMockReplies({ tone, message, role }: GenerateRepliesInput): string[] {
  const preview = message.length > 60 ? `${message.slice(0, 57)}...` : message;
  const rolePrefix = role && role !== "none" ? `[${role}] ` : "";

  return [
    `${rolePrefix}Thanks for sharing this. I understand: "${preview}"`,
    `${rolePrefix}I appreciate your message. Let me think about it and get back to you soon.`,
    `${rolePrefix}That makes sense. I will respond properly in a bit.`,
    tone === "funny"
      ? `${rolePrefix}Haha, fair point. Give me a minute to come up with my best reply.`
      : `${rolePrefix}Got it. Thanks for letting me know.`,
    tone === "short_sweet" ? `${rolePrefix}Sure, noted.` : `${rolePrefix}Thanks, I will keep this in mind.`,
  ];
}

export function getMockRewrites({ tone, message, role }: GenerateRepliesInput): string[] {
  const cleanMessage = message.trim();
  const rolePrefix = role && role !== "none" ? `[${role}] ` : "";

  return [
    `${rolePrefix}${cleanMessage}`,
    tone === "professional"
      ? `${rolePrefix}Thank you for your message. ${cleanMessage}`
      : `${rolePrefix}Hey, ${cleanMessage}`,
    tone === "short_sweet" ? `${rolePrefix}${cleanMessage.slice(0, 90)}` : `${rolePrefix}Just wanted to say: ${cleanMessage}`,
    tone === "casual" ? `${rolePrefix}Hey, ${cleanMessage}` : `${rolePrefix}I wanted to share that ${cleanMessage}`,
    tone === "polite" ? `${rolePrefix}Please note, ${cleanMessage}` : `${rolePrefix}Here is what I mean: ${cleanMessage}`,
  ];
}

export function getMockGrammarFixes({ message }: GenerateRepliesInput): string[] {
  const cleanMessage = message.trim();

  return [
    cleanMessage,
    `${cleanMessage}.`,
    `I cannot come today.`,
    `I am unable to come today.`,
    `Sorry, I cannot make it today.`,
  ];
}

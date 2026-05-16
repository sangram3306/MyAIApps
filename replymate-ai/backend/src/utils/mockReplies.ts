import { GenerateRepliesInput } from "../schemas/replySchemas";

export function getMockReplies({ tone, message }: GenerateRepliesInput): string[] {
  const preview = message.length > 60 ? `${message.slice(0, 57)}...` : message;

  return [
    `Thanks for sharing this. I understand: "${preview}"`,
    "I appreciate your message. Let me think about it and get back to you soon.",
    "That makes sense. I will respond properly in a bit.",
    tone === "funny"
      ? "Haha, fair point. Give me a minute to come up with my best reply."
      : "Got it. Thanks for letting me know.",
    tone === "short" ? "Sure, noted." : "Thanks, I will keep this in mind.",
  ];
}

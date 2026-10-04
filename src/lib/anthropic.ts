import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export const CLAUDE_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
export function anthropic() {
  client ??= new Anthropic({ apiKey: env.anthropicKey() });
  return client;
}

import type { z } from "zod";
import { withRetries, type ModelProvider } from "./provider.ts";

/**
 * One JSON object from the model, validated by a zod schema, with one corrective retry.
 * Shared by the ticket summariser and the creator card so both explain the same way.
 */
export async function completeJson<T extends z.ZodType>(provider: ModelProvider, instructions: string, user: string, schema: T, what = "reply"): Promise<z.infer<T>> {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? user : `${user}\n\nYour previous reply was not valid: ${lastError}. Reply with the JSON object only.`;
    const text = await withRetries(() => provider.complete(instructions, prompt));
    const valid = schema.safeParse(parseJsonObject(text));
    if (valid.success) return valid.data;
    lastError = valid.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ") || "not JSON";
    if (text.trim() === "") lastError = "empty reply";
  }
  throw new Error(`The ${what} was not valid JSON after two attempts: ${lastError}`);
}

export function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

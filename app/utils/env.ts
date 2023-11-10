import type { AppLoadContext } from "@remix-run/cloudflare";
import { z } from "zod";

const envSchema = z.object({
  ENVIRONMENT: z.union([z.literal("development"), z.literal("production")]),
});

export function getEnv(context: AppLoadContext) {
  console.log("getEnv ~ context:", context);
  console.log("getEnv ~ context.env:", context.env);
  const env = envSchema.parse(context.env);

  return env;
}

export type Env = ReturnType<typeof getEnv>;

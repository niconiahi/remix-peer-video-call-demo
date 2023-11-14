import { z } from "zod";
import {
  answerEventSchema,
  candidateEventSchema,
  offerEventSchema,
} from "~/utils/event";

export const historyEventSchema = z.object({
  type: z.literal("history"),
  sender: z.string(),
});
export const pongEventSchema = z.object({
  type: z.literal("pong"),
  sender: z.literal("server"),
  value: z.string(),
});
export const eventsEventSchema = z.object({
  type: z.literal("events"),
  sender: z.string(),
});
export type PongEvent = z.infer<typeof pongEventSchema>;
export type HistoryEvent = z.infer<typeof historyEventSchema>;
export const eventSchema = z.discriminatedUnion("type", [
  offerEventSchema,
  answerEventSchema,
  candidateEventSchema,
  historyEventSchema,
  eventsEventSchema,
  pongEventSchema,
]);

export interface Env {
  BROADCASTER: DurableObjectNamespace;
}

type State = {
  connections: WebSocket[];
};

function generateHash() {
  return (Math.random() + 1).toString(36).substring(7);
}

export class Broadcaster {
  public state: State;
  private env: Env;

  constructor(state: State, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    if (request.method !== "POST") {
      return new Response("method not allowed =>", { status: 405 });
    }
    const event = pongEventSchema.parse({
      sender: "server",
      type: "pong",
      value: generateHash(),
    } as PongEvent);
    return new Response(JSON.stringify(event));
  }
}

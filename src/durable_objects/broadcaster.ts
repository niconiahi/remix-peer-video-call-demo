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
type Event = z.infer<typeof eventSchema>;
type State = {
  connections: WebSocket[];
};

function generateHash() {
  return (Math.random() + 1).toString(36).substring(7);
}

export class Broadcaster {
  public state: State;

  constructor(state: State) {
    this.state = state;
  }

  async fetch(request: Request) {
    if (request.method === "GET") {
      const event = pongEventSchema.parse({
        sender: "server",
        type: "pong",
        value: generateHash(),
      } as PongEvent);

      return new Response(JSON.stringify(event));
    }
    if (request.method === "POST") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }

      const [client, server] = Object.values(new WebSocketPair());
      await this.handleConnection(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("method not allowed =>", { status: 405 });
  }

  handleConnection(server: WebSocket) {
    // @ts-expect-error given that I need to add "DOM" as a "lib" in "tsconfig.json"
    // to be able to work on the client, this conflicts with "esnext" value required
    // by Cloudflare. That's why omit this case
    // https://developers.cloudflare.com/workers/examples/websockets/
    server.accept();
    this.state.connections.push(server);
    server.addEventListener("message", ({ data }) => {
      console.log("server data =>", data);
      const result = eventSchema.safeParse(JSON.parse(data));
      if (!result.success) {
        console.log("error =>", result.error.toString());
        return;
      }
      const event = result.data;
      this.broadcast(event);
    });
  }

  broadcast(event: Event) {
    console.log("this event is being broadcasted by the server =>", event);
    for (const connection of this.state.connections) {
      connection.send(JSON.stringify(event));
    }
  }
}

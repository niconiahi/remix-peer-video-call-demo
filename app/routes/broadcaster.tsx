import type { LoaderArgs } from "@remix-run/cloudflare";
import { z } from "zod";
import {
  offerEventSchema,
  answerEventSchema,
  candidateEventSchema,
} from "~/utils/event";

export const historyEventSchema = z.object({
  type: z.literal("history"),
  sender: z.string(),
});
export const eventsEventSchema = z.object({
  type: z.literal("events"),
  sender: z.string(),
});
export type HistoryEvent = z.infer<typeof historyEventSchema>;
export const eventSchema = z.discriminatedUnion("type", [
  offerEventSchema,
  answerEventSchema,
  candidateEventSchema,
  historyEventSchema,
  eventsEventSchema,
]);

export function loader({ request }: LoaderArgs) {
  const upgradeHeader = request.headers.get("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  const [client, server] = Object.values(new WebSocketPair());
  // @ts-expect-error given that I need to add "DOM" as a "lib" in "tsconfig.json"
  // to be able to work on the client, this conflicts with "esnext" value required
  // by Cloudflare. That's why omit this case
  // https://developers.cloudflare.com/workers/examples/websockets/
  server.accept();
  server.addEventListener("message", ({ data }) => {
    console.log("server data =>", data);
    const result = eventSchema.safeParse(JSON.parse(data));
    if (!result.success) {
      console.log("error =>", result.error.toString());
      return;
    }
    const event = result.data;

    console.log(`${event.sender} sent the event => ${event.type}`);
    server.send(JSON.stringify(event));
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

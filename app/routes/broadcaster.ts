import type { LoaderArgs } from "@remix-run/cloudflare";
import { z } from "zod";

export interface Env {
  BROADCASTER: DurableObjectNamespace;
}

const searchParamsSchema = z
  .string()
  .min(1, `a "host" search param is required`);

export async function loader({ request, context }: LoaderArgs) {
  const env = context.env as unknown as Env;
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const result = searchParamsSchema.safeParse(searchParams.get("host"));
  if (!result.success) {
    return new Response(result.error.toString(), {
      status: 400,
    });
  }
  const host = result.data;
  const id = env.BROADCASTER.idFromName(host);
  const stub = env.BROADCASTER.get(id);
  const response = await stub.fetch(request.url);
  const event = await response.text();

  return new Response(event);
}

// export function loader({ request }: LoaderArgs) {
//   const upgradeHeader = request.headers.get("Upgrade");
//   if (!upgradeHeader || upgradeHeader !== "websocket") {
//     return new Response("Expected Upgrade: websocket", { status: 426 });
//   }

//   const [client, server] = Object.values(new WebSocketPair());
//   // @ts-expect-error given that I need to add "DOM" as a "lib" in "tsconfig.json"
//   // to be able to work on the client, this conflicts with "esnext" value required
//   // by Cloudflare. That's why omit this case
//   // https://developers.cloudflare.com/workers/examples/websockets/
//   server.accept();
//   server.addEventListener("message", ({ data }) => {
//     console.log("server data =>", data);
//     const result = eventSchema.safeParse(JSON.parse(data));
//     if (!result.success) {
//       console.log("error =>", result.error.toString());
//       return;
//     }
//     const event = result.data;

//     console.log(`${event.sender} sent the event => ${event.type}`);
//     server.send(JSON.stringify(event));
//   });
//   setInterval(() => {
//     const event = pongEventSchema.parse({
//       sender: "server",
//       type: "pong",
//       value: generateHash(),
//     } as PongEvent);
//     server.send(JSON.stringify(event));
//   }, 3000);

//   return new Response(null, {
//     status: 101,
//     webSocket: client,
//   });
// }

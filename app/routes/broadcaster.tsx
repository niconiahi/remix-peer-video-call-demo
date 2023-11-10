import type { LoaderArgs } from "@remix-run/cloudflare";

export function loader({ request }: LoaderArgs) {
  console.log("broadcaster recieved a request =>");
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
    console.log(`server just recieved a "message" from the client =>`);
    console.log("data =>", data);
    if (data === "client-ping") {
      server.send("server-pong");
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

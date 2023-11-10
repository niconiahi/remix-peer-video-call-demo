import { useEffect } from "react";
import { getOrigin, toWebsocket } from "~/utils/origin";

export default function Index() {
  useEffect(() => {
    async function setupWebsocket() {
      const webSocket = new WebSocket(
        toWebsocket(`${getOrigin({ ENVIRONMENT: "development" })}/broadcaster`),
      );

      webSocket.addEventListener("message", ({ data }) => {
        console.log(`client just recieved a "message" from the server =>`);
        console.log("data =>", data);
        if (data === "server-pong") {
          console.log("client is ponging =>");
        }
      });
      webSocket.addEventListener("open", () => {
        console.log("connection established =>");
        webSocket.send("client-ping");
      });
    }

    setupWebsocket();
  }, []);

  return (
    <main className="max-w-3xl mx-auto space-y-2 h-screen">
      <h1>live player</h1>
    </main>
  );
}

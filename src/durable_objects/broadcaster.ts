import type { Event } from "~/utils/signaling"
import { eventSchema } from "~/utils/signaling"

interface State {
  connections: WebSocket[]
}

export class Broadcaster {
  public state: State

  constructor(state: State) {
    this.state = state
  }

  async fetch(request: Request) {
    const upgradeHeader = request.headers.get("Upgrade")
    if (!upgradeHeader || upgradeHeader !== "websocket")
      return new Response("Expected Upgrade: websocket", { status: 426 })

    const [client, server] = Object.values(new WebSocketPair())
    this.handleConnection(server)

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  handleConnection(server: WebSocket) {
    // @ts-expect-error given that I need to add "DOM" as a "lib" in "tsconfig.json"
    // to be able to work on the client, this conflicts with "esnext" value required
    // by Cloudflare. That's why omit this case
    // https://developers.cloudflare.com/workers/examples/websockets/
    server.accept()
    if (this.state.connections)
      this.state.connections.push(server)
		 else
      this.state.connections = [server]

    server.addEventListener("message", ({ data }) => {
      console.log("server data =>", data)
      const result = eventSchema.safeParse(JSON.parse(data))
      if (!result.success) {
        console.log("error =>", result.error.toString())
        return
      }
      const event = result.data
      this.broadcast(event)
    })
  }

  broadcast(event: Event) {
    console.log("this event is being broadcasted by the server =>", event)
    for (const connection of this.state.connections)
      connection.send(JSON.stringify(event))
  }
}

import { Broadcaster } from "./durable_objects/broadcaster"

export interface Env {
  BROADCASTER: DurableObjectNamespace
}

export default {
  // async fetch(request: Request, env: Env) {
  async fetch() {
    return new Response("success")
  },
}

export { Broadcaster }

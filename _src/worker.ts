export interface Env {
  BROADCASTER: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env) {
    let url = new URL(request.url);
    let name = url.searchParams.get("name");
    if (!name) {
      return new Response(
        "Select a Durable Object to contact by using" +
          " the `name` URL query string parameter, for example, ?name=A",
      );
    }

    let id = env.BROADCASTER.idFromName(name);
    let obj = env.BROADCASTER.get(id);
    let resp = await obj.fetch(request.url);
    let count = await resp.text();

    return new Response(`Durable Object '${name}' count: ${count}`);
  },
};

export class Broadcaster {
  state: DurableObjectState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
  }

  // Handle HTTP requests from clients.
  async fetch(request: Request) {
    // Apply requested action.
    let url = new URL(request.url);

    // Durable Object storage is automatically cached in-memory, so reading the
    // same key every request is fast.
    // You could also store the value in a class member if you prefer.
    let value: number = (await this.state.storage.get("value")) || 0;

    switch (url.pathname) {
      case "/increment":
        ++value;
        break;
      case "/decrement":
        --value;
        break;
      case "/":
        // Serves the current value.
        break;
      default:
        return new Response("Not found", { status: 404 });
    }

    // You do not have to worry about a concurrent request having modified the value in storage.
    // "input gates" will automatically protect against unwanted concurrency.
    // Read-modify-write is safe.
    await this.state.storage.put("value", value);

    return new Response(value.toString());
  }
}

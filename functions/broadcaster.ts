import { z } from "zod";

export interface Env {
  BROADCASTER: DurableObjectNamespace;
}

const searchParamsSchema = z
  .string()
  .min(1, `a "host" search param is required`);

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
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
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const result = searchParamsSchema.safeParse(searchParams.get("host"));
  if (!result.success) {
    return new Response(result.error.toString(), {
      status: 400,
    });
  }
  const host = result.data;
  return new Response(`broadcaster in being reached => the host is => ${host}`);
  // const id = env.BROADCASTER.idFromName(host);
  // return new Response(`broadcaster in being reached => its id is => ${id}`);
};

import type { LoaderArgs } from "@remix-run/cloudflare"
import { z } from "zod"

export interface Env {
  BROADCASTER: DurableObjectNamespace
}

const searchParamsSchema = z
  .string()
  .min(1, `a "host" search param is required`)

export async function loader({ request, context }: LoaderArgs) {
  const env = context.env as unknown as Env
  const url = new URL(request.url)
  const searchParams = url.searchParams
  const result = searchParamsSchema.safeParse(searchParams.get("host"))
  if (!result.success) {
    return new Response(result.error.toString(), {
      status: 400,
    })
  }
  const host = result.data
  const id = env.BROADCASTER.idFromName(host)
  const stub = env.BROADCASTER.get(id)
  const response = await stub.fetch(request)

  return response
}

import type { ActionArgs } from "@remix-run/cloudflare"
import { json, redirect } from "@remix-run/cloudflare"
import { Form } from "@remix-run/react"
import { z } from "zod"

const usernameSchema = z.string().min(1)

export async function action({ request }: ActionArgs) {
  const formData = await request.formData()

  switch (formData.get("_action")) {
    case "username": {
      const result = usernameSchema.safeParse(formData.get("username"))
      if (!result.success) {
        throw json({ error: result.error.toString(), status: 404 })
      }

      const url = new URL(request.url)
      url.pathname = "/peer-player"
      const username = result.data
      url.searchParams.set("username", username)
      const host = url.searchParams.get("host")
      if (!host) {
        url.searchParams.set("host", username)
      }

      console.log("action ~ url:", url)
      return redirect(url.toString())
    }

    default: {
      throw new Error("Unknown action")
    }
  }
}

export default () => {
  return (
    <main className="max-w-3xl mx-auto space-y-2 flex items-center justify-center h-screen">
      <Form
        className="bg-red-200 border-2 border-red-900 space-y-1 p-1"
        method="POST"
      >
        <p className="flex flex-col space-y-1">
          <label htmlFor="caller" className="text-red-900">
            Username
          </label>
          <input
            required
            type="text"
            name="username"
            id="username"
            className="border-2 border-red-900"
          />
        </p>
        <button
          className="p-4 w-full bg-red-200 border-2 border-red-900 text-red-900 hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-100 disabled:text-red-300 disabled:border-red-300"
          type="submit"
          name="_action"
          value="username"
        >
          Use this username
        </button>
      </Form>
    </main>
  )
}

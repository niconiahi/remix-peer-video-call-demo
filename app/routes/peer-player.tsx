import { useEffect } from "react"

import { json, redirect } from "@remix-run/cloudflare"
import type {
  HeadersFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare"
import { useLoaderData } from "@remix-run/react"
import { z } from "zod"
import { useMachine } from "@xstate/react"
import clsx from "clsx"
import { ClientOnly } from "remix-utils/client-only"
import {
  signalingMachine as _signalingMachine,
  eventSchema as signalingEvent,
} from "~/utils/signaling"
import { getEnv } from "~/utils/env"
import {
  peerConnectionMachine as _peerConnectionMachine,
  answerEventSchema,
  offerEventSchema,
  eventSchema as rtcEventSchema,
} from "~/utils/peer-connection"
import { getOrigin, toWebsocket } from "~/utils/origin"

export const headers: HeadersFunction = () => ({
  title: "Peer to peer chat app",
})

export const meta: MetaFunction = () => {
  return [
    {
      name: "description",
      content: "A chat app using WebRTC",
    },
  ]
}

export function loader({ request, context }: LoaderFunctionArgs) {
  console.log("before")
  const env = getEnv(context)
  console.log("after")
  const url = new URL(request.url)
  const host = url.searchParams.get("host")
  const username = url.searchParams.get("username")

  if (!host || !username)
    throw redirect("/login")

  return json({ host, username, environment: env.ENVIRONMENT })
}

export default () => {
  return (
    <ClientOnly>
      {() => <Player />}
    </ClientOnly>
  )
}

function Player() {
  const { host, username, environment } = useLoaderData<typeof loader>()
  console.log("before connection")
  const peerConnectionMachine = useMachine(_peerConnectionMachine, {
    input: {
      host,
      username,
    },
  })
  console.log("peerConnectionMachine", peerConnectionMachine)
  const signalingMachine = useMachine(_signalingMachine, {
    input: {
      webSocket: new WebSocket(
        toWebsocket(
          `${getOrigin({ ENVIRONMENT: environment })}/broadcaster?host=${host}`,
        ),
      ),
    },
  })
  console.log("signalingMachine", signalingMachine)
  const { events } = peerConnectionMachine[0].context
  const _answerEvent = answerEventSchema.safeParse(
    events.find((event) => {
      return event.type === "answer"
    }),
  )
  const answerEvent = _answerEvent.success ? _answerEvent.data : undefined
  const _offerEvent = offerEventSchema.safeParse(
    events.find((event) => {
      return event.type === "offer"
    }),
  )
  const offerEvent = _offerEvent.success ? _offerEvent.data : undefined

  useEffect(() => {
    const [state, send] = peerConnectionMachine
    console.log("state", state)
    console.log("state.value", state.value)
    console.log("state.context", state.context)
    console.log("state.can", state.can({ type: "CREATE_OFFER" }))
    if (state.can({ type: "CREATE_OFFER" })) {
      console.log("creating offer")
      console.log("creating offer")
      send({ type: "CREATE_OFFER" })
    }
    if (state.can({ type: "CREATE_ANSWER" })) {
      console.log("creating answer")
      send({ type: "CREATE_ANSWER" })
    }
    if (state.can({ type: "ADD_ANSWER" })) {
      console.log("adding answer")
      send({ type: "ADD_ANSWER" })
    }
  }, [peerConnectionMachine])

  useEffect(() => {
    const { webSocket } = signalingMachine[0].context
    async function setupWebsocket(username: string, host: string) {
      webSocket.addEventListener("open", () => {
        console.log("connection established =>")
        if (username !== host) {
          console.log("sending \"get\" event =>")
          signalingMachine[1]({
            type: "GET_EVENTS",
            username,
          })
        }
      })
      webSocket.addEventListener("message", ({ data }) => {
        const event = signalingEvent.parse(JSON.parse(data))
        if (event.sender === username)
          return

        console.log(`receiving "${event.type}" event =>`)
        if (event.type === "get") {
          signalingMachine[1]({
            type: "SEND_EVENTS",
            username,
            events: peerConnectionMachine[0].context.events,
          })
        }
        else {
          const { events: _peerEvents } = event
          const peerEvents = z.array(rtcEventSchema).parse(_peerEvents)
          peerConnectionMachine[1]({ type: "SET_EVENTS", events: peerEvents })
        }
      })
    }

    setupWebsocket(username, host)
  }, [peerConnectionMachine, signalingMachine])

  return (
    <main className="max-w-3xl mx-auto space-y-2 py-2">
      <section className="grid grid-cols-6 gap-2">
        <div className="col-span-4 border-2 border-gray-900 relative">
          <video className="w-full" id="local-video" autoPlay playsInline />
          <span className="absolute bottom-2 right-2 text-gray-100 bg-gray-900 rounded-md p-1">
            {username}
          </span>
        </div>
        <video
          className="col-span-2 border-2 border-gray-900"
          id="remote-video"
          autoPlay
          playsInline
        />
      </section>
      <section className="grid grid-cols-2 gap-2">
        <p className="flex flex-col">
          <label
            className="text-blue-900 border-2 border-blue-900 w-fit border-b-0 p-1"
            htmlFor="offer"
          >
            Offer
          </label>
          <textarea
            id="offer"
            className="h-[300px] p-1 border-2 border-blue-900 bg-blue-200"
            readOnly
            disabled
            defaultValue={offerEvent?.sessionDescription ?? ""}
          />
        </p>
        <p className="flex flex-col">
          <label
            className="text-green-900 border-2 border-green-900 w-fit border-b-0 p-1"
            htmlFor="answer"
          >
            Answer
          </label>
          <textarea
            id="answer"
            className="h-[300px] p-1 border-2 border-green-900 bg-green-200"
            disabled
            readOnly
            defaultValue={answerEvent?.sessionDescription ?? ""}
          />
        </p>
      </section>
      <section className="grid grid-cols-1 space-y-2">
        <ol className="space-y-2">
          {events.map((event, index) => {
            function getColors(type: Event["type"]) {
              if (type === "offer")
                return "bg-pink-200 text-pink-900 border-pink-900"
              if (type === "answer")
                return "bg-orange-200 text-orange-900 border-orange-900"
              if (type === "candidate")
                return "bg-yellow-200 text-yellow-900 border-yellow-900"
            }

            function getHoverColors(type: Event["type"]) {
              if (type === "offer")
                return "hover:bg-pink-400"
              if (type === "answer")
                return "hover:bg-orange-400"
              if (type === "candidate")
                return "hover:bg-yellow-400"
            }

            return (
              <li
                key={`event_${event.sender}_${index}`}
                className={clsx([
                  "flex items-center p-1 w-full border-2 space-x-2",
                  getColors(event.type),
                ])}
              >
                <span className="font-bold">{index}</span>
                <span className="flex-1">
                  {event.type}
                  {" "}
                  {`event =>`}
                  {" "}
                  sent by
                  {" "}
                  {event.sender}
                </span>
                <button
                  className={clsx(
                    "p-0.5 border-2 rounded-md",
                    getHoverColors(event.type),
                    getColors(event.type),
                  )}
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(event))
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                </button>
              </li>
            )
          })}
        </ol>
      </section>
    </main>
  )
}

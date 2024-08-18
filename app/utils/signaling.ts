import { createMachine } from "xstate"
import { z } from "zod"

import type { Event as PeerConnectionEvent } from "~/utils/peer-connection"
import { eventSchema as peerConnectionEventSchema } from "~/utils/peer-connection"

export const getEventSchema = z.object({
  type: z.literal("get"),
  sender: z.string(),
})
export type GetEvent = z.infer<typeof getEventSchema>
export const sendEventSchema = z.object({
  type: z.literal("send"),
  sender: z.string(),
  events: z.array(peerConnectionEventSchema),
})
export type SendEvent = z.infer<typeof sendEventSchema>
export const eventSchema = z.discriminatedUnion("type", [
  getEventSchema,
  sendEventSchema,
])
export type Event = z.infer<typeof eventSchema>

export const signalingMachine = createMachine({
  types: {} as {
    input: {
      webSocket: WebSocket
    }
    context: {
      webSocket: WebSocket
    }
    events:
      | { type: "SEND_EVENTS", events: PeerConnectionEvent[], username: string }
      | { type: "GET_EVENTS", username: string }
  },
  context: ({ input }) => ({
    webSocket: input.webSocket,
    peerConnection: input.webSocket,
  }),
  id: "signaling",
  on: {
    SEND_EVENTS: {
      actions: [
        ({ context, event: { events, username } }) => {
          const { webSocket } = context
          const event = sendEventSchema.parse({
            type: "send",
            sender: username,
            events,
          } as SendEvent)
          console.log(`sending "${event.type}" event =>`)
          webSocket.send(JSON.stringify(event))
        },
      ],
    },
    GET_EVENTS: {
      actions: [
        ({ context, event: { username } }) => {
          const { webSocket } = context
          const event = sendEventSchema.parse({
            type: "get",
            sender: username,
          } as GetEvent)
          console.log(`sending "${event.type}" event =>`)
          webSocket.send(JSON.stringify(event))
        },
      ],
    },
  },
})

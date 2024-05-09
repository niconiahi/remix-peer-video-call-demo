import { and, assign, createMachine, raise } from "xstate";

import { z } from "zod";

export const offerEventSchema = z.object({
  type: z.literal("offer"),
  sender: z.string(),
  sessionDescription: z.string(),
});
export type OfferEvent = z.infer<typeof offerEventSchema>;

export const answerEventSchema = z.object({
  type: z.literal("answer"),
  sender: z.string(),
  sessionDescription: z.string(),
});
export type AnswerEvent = z.infer<typeof answerEventSchema>;

export const candidateEventSchema = z.object({
  type: z.literal("candidate"),
  sender: z.string(),
  candidate: z.string(),
});
export type CandidateEvent = z.infer<typeof candidateEventSchema>;

export const gatheredEventSchema = z.object({
  type: z.literal("gathered"),
  sender: z.string(),
});
export type GatheredEvent = z.infer<typeof gatheredEventSchema>;

export const eventSchema = z.discriminatedUnion("type", [
  offerEventSchema,
  answerEventSchema,
  candidateEventSchema,
  gatheredEventSchema,
]);
export type Event = z.infer<typeof eventSchema>;

export const peerConnectionMachine = createMachine(
  {
    types: {} as {
      input: {
        host: string;
        username: string;
      };
      context: {
        host: string;
        username: string;
        events: Event[];
        connection: RTCPeerConnection | null;
      };
      guards: {
        type:
          | "isHost"
          | "isGuest"
          | "hasConnection"
          | "hasOffer"
          | "hasAnswer"
          | "hasHostGathered"
          | "hasGuestGathered";
      };
      events:
        | { type: "SET_OFFER_EVENT"; offerEvent: OfferEvent }
        | { type: "SET_CANDIDATE_EVENT"; candidateEvent: CandidateEvent }
        | { type: "SET_GATHERED_EVENT"; gatheredEvent: GatheredEvent }
        | { type: "SET_ANSWER_EVENT"; answerEvent: AnswerEvent }
        | { type: "SET_EVENTS"; events: Event[] }
        | { type: "CREATE_ANSWER" }
        | { type: "ADD_ANSWER" }
        | { type: "ANSWER_ADDED" }
        | { type: "CREATE_OFFER" };
    },
    context: ({ input }) => ({
      events: [],
      connection: new RTCPeerConnection(iceServers),
      host: input.host,
      username: input.username,
    }),
    id: "peer-connection",
    initial: "disconnected",
    on: {
      SET_EVENTS: {
        actions: [assign(({ event }) => ({ events: event.events }))],
      },
    },
    states: {
      disconnected: {
        on: {
          CREATE_OFFER: {
            target: "#peer-connection.connecting.offering",
            guard: and(["isHost", "hasConnection"]),
          },
          CREATE_ANSWER: {
            target: "#peer-connection.connecting.answering",
            guard: and([
              "isGuest",
              "hasConnection",
              "hasOffer",
              "hasHostGathered",
            ]),
          },
        },
      },
      connecting: {
        initial: "offering",
        states: {
          offering: {
            initial: "creating",
            states: {
              creating: {
                on: {
                  SET_OFFER_EVENT: {
                    actions: [
                      assign(({ event, context }) => {
                        return {
                          events: [...context.events, event.offerEvent],
                        };
                      }),
                    ],
                    target: "gathering",
                  },
                },
              },
              gathering: {
                on: {
                  SET_CANDIDATE_EVENT: {
                    actions: [
                      assign(({ event, context }) => {
                        return {
                          events: [...context.events, event.candidateEvent],
                        };
                      }),
                    ],
                    target: "gathering",
                  },
                  SET_GATHERED_EVENT: {
                    actions: [
                      assign(({ event, context }) => {
                        return {
                          events: [...context.events, event.gatheredEvent],
                        };
                      }),
                    ],
                    target: "gathered",
                  },
                },
              },
              gathered: {
                on: {
                  ADD_ANSWER: {
                    target: "#peer-connection.connecting.peering",
                    guard: and([
                      "isHost",
                      "hasConnection",
                      "hasOffer",
                      "hasAnswer",
                      "hasGuestGathered",
                    ]),
                  },
                },
              },
            },
          },
          answering: {
            initial: "creating",
            states: {
              creating: {
                on: {
                  SET_ANSWER_EVENT: {
                    actions: [
                      assign(({ event, context }) => {
                        return {
                          events: [...context.events, event.answerEvent],
                        };
                      }),
                    ],
                    target: "gathering",
                  },
                },
              },
              gathering: {
                on: {
                  SET_CANDIDATE_EVENT: {
                    actions: [
                      assign(({ event, context }) => {
                        return {
                          events: [...context.events, event.candidateEvent],
                        };
                      }),
                    ],
                    target: "gathering",
                  },
                  SET_GATHERED_EVENT: {
                    actions: [
                      assign(({ event, context }) => {
                        return {
                          events: [...context.events, event.gatheredEvent],
                        };
                      }),
                    ],
                    target: "gathered",
                  },
                },
              },
              gathered: {},
            },
          },
          peering: {
            exit: raise({ type: "ANSWER_ADDED" }),
            on: {
              ANSWER_ADDED: {
                target: "#peer-connection.connected",
              },
            },
            entry: ({ context }) => {
              const { connection: _connection, events, username } = context;
              const connection = z
                .instanceof(RTCPeerConnection)
                .parse(_connection);
              const candidateEvents = z.array(candidateEventSchema).parse(
                events.filter((event) => {
                  return event.type === "candidate";
                }),
              );
              const answerEvent = answerEventSchema.parse(
                events.find((event) => {
                  return event.type === "answer";
                }),
              );
              const offerEvent = offerEventSchema.parse(
                events.find((event) => {
                  return event.type === "offer";
                }),
              );

              connection.setLocalDescription(
                JSON.parse(offerEvent.sessionDescription),
              );
              connection.setRemoteDescription(
                JSON.parse(answerEvent.sessionDescription),
              );
              candidateEvents
                .filter(({ sender }) => sender !== username)
                .forEach(({ candidate, sender }) => {
                  connection.addIceCandidate(JSON.parse(candidate));
                  console.log(
                    `${username} added an ice candidate from ${sender} =>`,
                  );
                });
            },
          },
        },
      },
      connected: {
        type: "final",
      },
    },
  },
  {
    guards: {
      isHost: ({ context }) => {
        console.log("context:", context);
        return context.username === context.host;
      },
      isGuest: ({ context }) => {
        return context.username !== context.host;
      },
      hasConnection: ({ context }) => {
        const result = z
          .instanceof(RTCPeerConnection)
          .safeParse(context.connection);
        return result.success;
      },
      hasAnswer: ({ context }) => {
        const result = answerEventSchema.safeParse(
          context.events.find((event) => {
            return event.type === "answer";
          }),
        );
        return result.success;
      },
      hasOffer: ({ context }) => {
        const result = offerEventSchema.safeParse(
          context.events.find((event) => {
            return event.type === "offer";
          }),
        );
        return result.success;
      },
      hasHostGathered: ({ context }) => {
        const result = gatheredEventSchema.safeParse(
          context.events
            .filter((event) => {
              return event.sender === context.host;
            })
            .find((event) => {
              return event.type === "gathered";
            }),
        );
        return result.success;
      },
      hasGuestGathered: ({ context }) => {
        const result = gatheredEventSchema.safeParse(
          context.events
            .filter((event) => {
              return event.sender !== context.host;
            })
            .find((event) => {
              return event.type === "gathered";
            }),
        );
        return result.success;
      },
    },
  },
);

const iceServers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

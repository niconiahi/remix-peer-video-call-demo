import type { ActorRef } from "xstate";
import { createMachine, fromPromise, sendTo } from "xstate";

export const peerConnectionMachine = createMachine(
  {
    types: {} as {
      input: {
        time: string;
      };
      guards: {
        type: "sentimentGood";
      };
      context: {
        // @ts-expect-error missing type
        someActorRef: ActorRef;
        time: string;
      };
      events:
        | { type: "INCREMENT"; message: string }
        | { type: "SUBMIT" }
        | { type: "FEEDBACK" };
      delays: "short";
      actions:
        | {
            type: "track";
            params: {
              response: string;
            };
          }
        | { type: "increment"; params: { value: number } };
    },
    context: ({ input, spawn }) => ({
      someActorRef: spawn(
        fromPromise(() => {
          return new Promise((resolve) => resolve(12));
        }),
      ),
      time: input.time,
    }),
    initial: "idle",
    states: {
      idle: {
        on: {
          INCREMENT: {
            actions: [{ type: "track", params: { response: "good" } }],
          },
          FEEDBACK: [
            {
              guard: "sentimentGood",
              target: "inactive",
            },
            {
              guard: ({ context }) => {
                return context.time === "some-time";
              },
              target: "active",
            },
            { target: "form" },
          ],
        },
        exit: [{ type: "increment", params: { value: 10 } }],
        always: {
          guard: ({ event }) => {
            return event.type === "SUBMIT";
          },
          actions: [
            ({ event }) => {
              console.log(event.type);
            },
            sendTo(({ context }) => context.someActorRef, {
              type: "someEvent",
            }),
          ],
        },
        after: {
          short: { target: "active" },
        },
      },
      active: {
        entry: [{ type: "track", params: { response: "bad" } }],
      },
      inactive: {
        entry: [{ type: "track", params: { response: "bad" } }],
      },
    },
  },
  {
    actions: {
      track: ({ context, event }, params) => {},
      increment: ({ context, event }, params) => {},
    },
    delays: {
      short: 1000,
    },
    guards: {
      sentimentGood: ({ event }) => {
        return event.type === "FEEDBACK";
      },
    },
  },
);

/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  json,
  type ActionArgs,
  type HeadersFunction,
  type LoaderArgs,
  type V2_MetaFunction,
  redirect,
} from "@remix-run/cloudflare";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";
import { z } from "zod";

export const headers: HeadersFunction = () => ({
  title: "Peer to peer chat app",
});

export const meta: V2_MetaFunction = () => {
  return [
    {
      name: "description",
      content: "A chat app using WebRTC",
    },
  ];
};

const iceServers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

type Event =
  | {
      type: "offer";
      sender: string;
      sessionDescription: string;
    }
  | {
      type: "answer";
      sender: string;
      sessionDescription: string;
    }
  | {
      type: "candidate";
      sender: string;
      candidate: string;
    };

const EventSchema = z.array(
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("offer"),
      sender: z.string(),
      sessionDescription: z.string(),
    }),
    z.object({
      type: z.literal("answer"),
      sender: z.string(),
      sessionDescription: z.string(),
    }),
    z.object({
      type: z.literal("candidate"),
      sender: z.string(),
      candidate: z.string(),
    }),
  ]),
);

const OfferEventSchema = z.object({
  type: z.literal("offer"),
  sender: z.string(),
  sessionDescription: z.string(),
});
type OfferEvent = z.infer<typeof OfferEventSchema>;

const AnswerEventSchema = z.object({
  type: z.literal("answer"),
  sender: z.string(),
  sessionDescription: z.string(),
});
type AnswerEvent = z.infer<typeof AnswerEventSchema>;

const CandidateEventSchema = z.object({
  type: z.literal("candidate"),
  sender: z.string(),
  candidate: z.string(),
});
type CandidateEvent = z.infer<typeof CandidateEventSchema>;

export async function action({ request }: ActionArgs) {
  const formData = await request.formData();

  switch (formData.get("_action")) {
    case "offer": {
      const eventEntry = formData.get("event");

      if (!eventEntry) {
        throw new Error(
          '"event" param is required when executing the "offer" action',
        );
      }

      const event = OfferEventSchema.safeParse(
        JSON.parse(eventEntry.toString()),
      );

      if (!event.success) {
        throw new Error(event.error.message);
      }

      const url = new URL(request.url);
      url.searchParams.append("event", eventEntry.toString());

      return redirect(url.toString());
    }
    case "answer": {
      const eventEntry = formData.get("event");

      if (!eventEntry) {
        throw new Error(
          '"event" param is required when executing the "answer" action',
        );
      }

      const event = AnswerEventSchema.safeParse(
        JSON.parse(eventEntry.toString()),
      );

      if (!event.success) {
        throw new Error(event.error.message);
      }

      const url = new URL(request.url);
      url.searchParams.append("event", eventEntry.toString());

      return redirect(url.toString());
    }
    case "candidate": {
      const eventEntry = formData.get("event");

      if (!eventEntry) {
        throw new Error(
          '"event" param is required when executing the "offer" action',
        );
      }

      const event = CandidateEventSchema.safeParse(
        JSON.parse(eventEntry.toString()),
      );

      if (!event.success) {
        throw new Error(event.error.message);
      }

      const url = new URL(request.url);
      url.searchParams.append("event", eventEntry.toString());

      return redirect(url.toString());
    }
    case "event": {
      const eventEntry = formData.get("event");

      if (!eventEntry) {
        throw new Error(
          '"event" param is required when executing the "event" action',
        );
      }
      const event = EventSchema.safeParse(JSON.parse(eventEntry.toString()));

      if (!event.success) {
        throw new Error(event.error.message);
      }

      const url = new URL(request.url);
      url.searchParams.append("event", eventEntry.toString());

      return redirect(url.toString());
    }
    default: {
      throw new Error("Unknown action");
    }
  }
}

export async function loader({ request }: LoaderArgs) {
  const url = new URL(request.url);
  const events = EventSchema.safeParse(
    url.searchParams
      .getAll("event")
      .map((entry) => JSON.parse(entry.toString())),
  );

  if (!events.success) {
    throw new Error(events.error.message);
  }

  const answerEvent = events.data.find((event) => {
    return event.type === "answer";
  });
  const answer = AnswerEventSchema.safeParse(answerEvent);

  const offerEvent = events.data.find((event) => {
    return event.type === "offer";
  });
  const offer = OfferEventSchema.safeParse(offerEvent);

  const candidateEvents = events.data.filter(
    (event) => event.type === "candidate",
  );
  const candidates = z.array(CandidateEventSchema).safeParse(candidateEvents);

  return json({
    events: events.data,
    offer: offer.success ? offer.data : undefined,
    answer: answer.success ? answer.data : undefined,
    caller: url.searchParams.get("caller") ?? "",
    candidates: candidates.success
      ? candidates.data.map((candidate) => candidate)
      : [],
  });
}

export default () => {
  const [remoteEvents, setRemoteEvents] = useState<Event[]>([]);
  const [username, setUsername] = useState("");
  const usernameRef = useRef<HTMLInputElement>(null);
  const eventRef = useRef<HTMLTextAreaElement>(null);
  const [peerConnection, setPeerConnection] = useState<
    RTCPeerConnection | undefined
  >(undefined);
  const [mediaStream, setMediaStream] = useState<MediaStream | undefined>(
    undefined,
  );
  const { candidates, offer, events } = useLoaderData<typeof loader>();

  useSetup({ setMediaStream, setPeerConnection, username });

  // useAddAnswer
  // useEffect(() => {}, [remoteEvents, peerConnection]);

  if (username.length === 0) {
    return (
      <main className="max-w-3xl mx-auto space-y-2 flex items-center justify-center h-screen">
        <Form className="bg-red-200 border-2 border-red-900 space-y-1 p-1">
          <p className="flex flex-col space-y-1">
            <label htmlFor="caller" className="text-red-900">
              Username
            </label>
            <input
              type="text"
              id="caller"
              ref={usernameRef}
              className="border-2 border-red-900"
            />
          </p>
          <Button
            className="w-full bg-red-200 border-2 border-red-900 text-red-900 hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-100 disabled:text-red-300 disabled:border-red-300"
            onClick={() => {
              const input = usernameRef.current;

              if (!input) return;

              setUsername(input.value);
            }}
          >
            Use this username
          </Button>
        </Form>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto space-y-2 py-2">
      <section className="grid grid-cols-5 gap-2">
        <video
          className="col-span-3 border-2 border-gray-900"
          id="local-video"
          autoPlay
          playsInline
        />
        <video
          className="col-span-2 border-2 border-gray-900"
          id="remote-video"
          autoPlay
          playsInline
        />
      </section>
      <section className="grid grid-cols-10 gap-2">
        <OfferButton
          offer={offer}
          peerConnection={peerConnection}
          username={username}
        />
        <AnswerButton
          candidates={candidates}
          offer={offer}
          username={username}
          peerConnection={peerConnection}
        />
        <AddAnswerButton
          peerConnection={peerConnection}
          username={username}
          offer={offer}
          remoteEvents={remoteEvents}
        />
      </section>
      <section className="grid grid-cols-2 gap-1">
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
            defaultValue={offer?.sessionDescription ?? ""}
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
            // defaultValue={answer?.sessionDescription ?? ""}
          />
        </p>
      </section>
      <section className="grid grid-cols-1 space-y-2">
        {/* <Form className="grid grid-cols-8 gap-1 bg-teal-200 border-2 p-1 border-teal-900 text-teal-900"> */}
        <p className="flex col-span-6 items-center space-x-1">
          <label className="text-teal-900 " htmlFor="event">
            Event
          </label>
          <textarea
            id="event"
            // name="event"
            placeholder="Paste copied event here"
            className="h-[44px] flex-1 p-1 border-2 border-teal-900 bg-teal-200 placeholder:text-teal-900"
            ref={eventRef}
          />
        </p>
        <Button
          // type="submit"
          // name="_action"
          // value="event"
          onClick={() => {
            const textarea = eventRef.current;

            if (!textarea) return;

            const remoteEvent = JSON.parse(textarea.value) as Event;

            setRemoteEvents((prevRemoteEvents) => [
              ...prevRemoteEvents,
              remoteEvent,
            ]);

            textarea.value = "";
          }}
          className={clsx([
            "h-[44px] col-span-2",
            "border-teal-900 bg-teal-200 text-teal-900 hover:bg-teal-400",
          ])}
        >
          Add event
        </Button>
        {/* </Form> */}
        <ol className="space-y-2">
          {[...events, ...remoteEvents].map((event, index) => {
            return (
              <Event
                index={index + 1}
                event={event}
                key={`event_${event.type}_${event.sender}_${index}`}
              />
            );
          })}
        </ol>
      </section>
    </main>
  );
};

function useSetup({
  username,
  setMediaStream,
  setPeerConnection,
}: {
  username: string;
  setMediaStream: React.Dispatch<React.SetStateAction<MediaStream | undefined>>;
  setPeerConnection: React.Dispatch<
    React.SetStateAction<RTCPeerConnection | undefined>
  >;
}) {
  const fetcher = useFetcher();

  useEffect(() => {
    if (typeof window === "undefined" || username.length === 0) return;

    async function setup() {
      // 1. creates peer connection
      const peerConnection = new RTCPeerConnection(iceServers);

      // 2. sets up media and its video
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { min: 640, ideal: 1920, max: 1920 },
          height: { min: 480, ideal: 1080, max: 1080 },
        },
        audio: false,
      });

      const localVideo = document.querySelector("#local-video");

      if (localVideo) {
        (localVideo as HTMLVideoElement).srcObject = mediaStream;
      }

      // 3. adds its media tracks to the peer connection
      mediaStream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, mediaStream));

      // 4. saves the candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          fetcher.submit(
            {
              _action: "candidate",
              event: JSON.stringify({
                type: "candidate",
                sender: username,
                candidate: JSON.stringify(event.candidate),
              } as Event),
            },
            {
              method: "post",
            },
          );
        } else {
          console.log("all local candidates have been added =>");
        }
      };

      // 5. expects receiving tracks from the peer
      peerConnection.ontrack = (event) => {
        const remoteVideo = document.querySelector("#remote-video");
        if (!remoteVideo) return;
        const video = remoteVideo as HTMLVideoElement;
        const mediaStream = event.streams[0];
        if (video.srcObject !== mediaStream) {
          video.srcObject = mediaStream;
        }
      };

      setMediaStream(mediaStream);
      setPeerConnection(peerConnection);
    }

    setup();
  }, [username]);
}

function AddAnswerButton({
  offer,
  username,
  remoteEvents,
  peerConnection,
}: {
  offer: OfferEvent | undefined;
  username: string;
  remoteEvents: Event[];
  peerConnection: RTCPeerConnection | undefined;
}) {
  const candidateEvents = remoteEvents.filter((event) => {
    return event.type === "candidate";
  });
  const _candidates = z.array(CandidateEventSchema).safeParse(candidateEvents);
  const candidates = _candidates.success
    ? _candidates.data.map((candidate) => candidate)
    : [];

  const answerEvent = remoteEvents.find((event) => {
    return event.type === "answer";
  });
  const _answer = AnswerEventSchema.safeParse(answerEvent);
  const answer = _answer.success ? _answer.data : undefined;

  return (
    <Button
      className="w-full bg-green-200 border-2 border-green-900 text-green-900 hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-green-100 disabled:text-green-300 disabled:border-green-300 col-span-2"
      // disabled={offer === undefined || username === offer?.sender}
      disabled={
        offer === undefined ||
        answer === undefined ||
        answer.sender === username ||
        peerConnection === undefined ||
        candidates.length < 2
      }
      onClick={async () => {
        invariant(offer, '"offer" is required to create an answer');
        invariant(answer, '"offer" is required to create an answer');
        invariant(
          peerConnection,
          '"peerConnection" is required to create an answer',
        );

        await peerConnection.setLocalDescription(
          JSON.parse(offer.sessionDescription),
        );
        await peerConnection.setRemoteDescription(
          JSON.parse(answer.sessionDescription),
        );

        candidates
          .filter(({ sender }) => sender !== username)
          .forEach(({ candidate, sender }) => {
            console.log(`${username} added an ice candidate from ${sender} =>`);
            peerConnection.addIceCandidate(JSON.parse(candidate));
          });
      }}
    >
      Add answer
    </Button>
  );
}

function AnswerButton({
  offer,
  username,
  candidates,
  peerConnection,
}: {
  offer: OfferEvent | undefined;
  username: string;
  candidates: CandidateEvent[];
  peerConnection?: RTCPeerConnection;
}) {
  const fetcher = useFetcher();

  return (
    <Button
      className="w-full bg-green-200 border-2 border-green-900 text-green-900 hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-green-100 disabled:text-green-300 disabled:border-green-300 col-span-4"
      disabled={offer === undefined || username === offer?.sender}
      onClick={async () => {
        invariant(offer, '"offer" is required to create an answer');
        invariant(
          peerConnection,
          '"peerConnection" is required to create an answer',
        );

        // 1. gets the offer value from the received event
        const { sessionDescription } = offer;

        // 2. sets remote description using the offer
        peerConnection.setRemoteDescription(JSON.parse(sessionDescription));

        // 3. creates the answer using the offer
        const answer = await peerConnection.createAnswer();

        // 4. sets local description using the answer
        peerConnection.setLocalDescription(answer);

        candidates
          .filter(({ sender }) => sender !== username)
          .forEach(({ candidate, sender }) => {
            console.log(`${username} added an ice candidate from ${sender} =>`);
            peerConnection.addIceCandidate(JSON.parse(candidate));
          });

        // 5. sends the answer as the "answer" event
        fetcher.submit(
          {
            _action: "answer",
            event: JSON.stringify({
              type: "answer",
              sender: username,
              sessionDescription: JSON.stringify(answer),
            } as Event),
          },
          {
            method: "post",
          },
        );
      }}
    >
      Create answer
    </Button>
  );
}

function OfferButton({
  offer,
  username,
  peerConnection,
}: {
  offer: OfferEvent | undefined;
  username: string;
  peerConnection?: RTCPeerConnection;
}) {
  const fetcher = useFetcher();

  return (
    <fetcher.Form name="_action">
      <button
        disabled={offer !== undefined}
        className="p-4 bg-blue-100 w-full border-2 text-blue-900 border-blue-900 hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-100 disabled:text-blue-300 disabled:border-blue-300 col-span-4"
        type="submit"
        onClick={async () => {
          invariant(
            peerConnection,
            '"peerConnection" is required to create an offer',
          );

          // 1. creates offer `.createOffer()`
          const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });

          // 2. sets setLocalDescription
          peerConnection.setLocalDescription(offer);

          // 3. sends the offer as the "offer" event
          fetcher.submit(
            {
              _action: "offer",
              event: JSON.stringify({
                type: "offer",
                sender: username,
                sessionDescription: JSON.stringify(offer),
              } as Event),
            },
            {
              method: "post",
            },
          );
        }}
      >
        Create offer
      </button>
    </fetcher.Form>
  );
}

function Event({
  event,
  index,
  ...liProps
}: {
  event: Event;
  index: number;
} & React.LiHTMLAttributes<HTMLLIElement>) {
  function getColors(type: Event["type"]) {
    if (type === "offer") return "bg-pink-200 text-pink-900 border-pink-900";
    if (type === "answer")
      return "bg-orange-200 text-orange-900 border-orange-900";
    if (type === "candidate")
      return "bg-yellow-200 text-yellow-900 border-yellow-900";
  }

  function getHoverColors(type: Event["type"]) {
    if (type === "offer") return "hover:bg-pink-400";
    if (type === "answer") return "hover:bg-orange-400";
    if (type === "candidate") return "hover:bg-yellow-400";
  }

  return (
    <li
      {...liProps}
      className={clsx([
        "flex items-center p-1 w-full border-2 space-x-1",
        getColors(event.type),
        liProps.className,
      ])}
    >
      <span className="font-bold">{index}</span>
      <span className="flex-1">
        {event.type} {`event =>`} sent by {event.sender}
      </span>
      <CopyButton
        text={JSON.stringify(event)}
        className={clsx(getColors(event.type), getHoverColors(event.type))}
      />
    </li>
  );
}

function Button({
  children,
  ...buttonProps
}: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...buttonProps}
      className={clsx([
        "p-2 bg-gray-900 text-gray-100 disabled:bg-gray-600 disabled:cursor-not-allowed border-2 border-gray-900",
        buttonProps.className,
      ])}
    >
      {children}
    </button>
  );
}

function CopyButton({
  text,
  ...buttonProps
}: { text: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(["p-0.5 border-2 rounded-md", buttonProps.className])}
      onClick={() => {
        navigator.clipboard.writeText(text);
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
  );
}

// caller
function _callerSetup() {
  // 1. creates peer connection
  // 2. sets up media and its video
  // 3. adds its media tracks to the peer connection
}

function _createOffer() {
  // 1. creates offer `.createOffer()`
  // 2. sets setLocalDescription
  // 3. sends the offer as the "offer" event
}

function _addAnswer() {
  // 1. gets the offer value from the received event
  // 2. sets remote description using the offer
}

// callee
function _createAnswer() {
  // 1. creates peer connection
  // 2. gets the offer value from the received event
  // 3. sets remote description using the offer
  // 4. sets up media and its video
  // 5. adds its media tracks to the peer connection
  // 6. creates the answer using the offer
  // 7. sets local description using the answer
  // 8. sends the answer as the "answer" event
}

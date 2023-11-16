import { useEffect, useRef, useState } from "react";
import { getOrigin, toWebsocket } from "~/utils/origin";

import { json, redirect } from "@remix-run/cloudflare";
import type {
  HeadersFunction,
  V2_MetaFunction,
  LoaderArgs,
  ActionArgs,
} from "@remix-run/cloudflare";
import { Form, useLoaderData } from "@remix-run/react";
import clsx from "clsx";
import type {
  // AnswerEvent,
  CandidateEvent,
  OfferEvent,
  Event,
  AnswerEvent,
} from "~/utils/event";
import {
  answerEventSchema,
  candidateEventSchema,
  // candidateEventSchema,
  offerEventSchema,
  eventSchema as rtcEventSchema,
} from "~/utils/event";
import { z } from "zod";
import type {
  EventsEvent,
  GuestEvent,
} from "@/src/durable_objects/broadcaster";
import {
  eventSchema,
  eventsEventSchema,
  guestEventSchema,
} from "@/src/durable_objects/broadcaster";
import { getEnv } from "~/utils/env";

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

const usernameSchema = z.string().min(1);

export async function action({ request }: ActionArgs) {
  const formData = await request.formData();

  switch (formData.get("_action")) {
    case "username": {
      const result = usernameSchema.safeParse(formData.get("username"));
      if (!result.success) {
        throw json({ error: result.error.toString(), status: 404 });
      }
      const url = new URL(request.url);
      const username = result.data;
      url.searchParams.set("username", username);
      const host = url.searchParams.get("host");
      if (!host) {
        url.searchParams.set("host", username);
      }
      return redirect(url.toString());
    }

    default: {
      throw new Error("Unknown action");
    }
  }
}

export function loader({ request, context }: LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const host = url.searchParams.get("host");
  const username = url.searchParams.get("username");
  return json({ host, username, environment: env.ENVIRONMENT });
}

export default () => {
  const { host, username, environment } = useLoaderData<typeof loader>();
  const [events, setEvents] = useState<Event[]>([]);
  const [webSocket, setWebSocket] = useState<WebSocket | undefined>(undefined);
  const eventsRef = useRef<Event[]>([]);
  const shouldRunAnswerEffectRef = useRef(true);
  const shouldRunSendEventsRef = useRef(true);
  const [peerConnection, setPeerConnection] = useState<
    RTCPeerConnection | undefined
  >(undefined);
  // const _candidateEvents = z.array(candidateEventSchema).safeParse(
  //   events.filter((event) => {
  //     return event.type === "candidate";
  //   }),
  // );
  // const candidateEvents = _candidateEvents.success ? _candidateEvents.data : [];
  const _answerEvent = answerEventSchema.safeParse(
    events.find((event) => {
      return event.type === "answer";
    }),
  );
  const answerEvent = _answerEvent.success ? _answerEvent.data : undefined;
  const _offerEvent = offerEventSchema.safeParse(
    events.find((event) => {
      return event.type === "offer";
    }),
  );
  const offerEvent = _offerEvent.success ? _offerEvent.data : undefined;

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // host and guest create peer connection
  useEffect(() => {
    if (!username || !host) return;

    async function setupPeerConnection(username: string) {
      const peerConnection = await createPeerConnection(username, setEvents);
      setPeerConnection(peerConnection);
    }

    setupPeerConnection(username);
  }, [username, host]);

  // guest creates answer
  useEffect(() => {
    if (
      !username ||
      !host ||
      !peerConnection ||
      !offerEvent ||
      !webSocket ||
      host === username ||
      peerConnection.iceGatheringState === "complete" ||
      !shouldRunAnswerEffectRef.current
    )
      return;

    async function createAnswer(
      offer: OfferEvent,
      peerConnection: RTCPeerConnection,
    ) {
      // 6. gets the offer value from the received event
      const { sessionDescription } = offer;

      // 7. sets remote description using the offer
      await peerConnection.setRemoteDescription(JSON.parse(sessionDescription));

      // 8. creates the answer using the offer
      const answer = await peerConnection.createAnswer();
      // 9. sets local description using the answer
      await peerConnection.setLocalDescription(answer);

      // 11. saves the answer as the "answer" event
      const answerEvent = {
        type: "answer",
        sender: username,
        sessionDescription: JSON.stringify(answer),
      } as AnswerEvent;
      setEvents((prevEvents) => [...prevEvents, answerEvent]);
    }

    shouldRunAnswerEffectRef.current = false;
    createAnswer(offerEvent, peerConnection);
  }, [offerEvent]);

  // guest sends all events once ice candidates gathered
  useEffect(() => {
    if (
      !username ||
      !host ||
      !peerConnection ||
      !webSocket ||
      host === username ||
      !shouldRunSendEventsRef.current ||
      peerConnection.iceGatheringState !== "complete"
    )
      return;

    async function sendEvents(events: Event[], webSocket: WebSocket) {
      console.log(`guest is sending events`);
      const guestEvents = events.filter((event) => event.sender === host);
      console.log("guestEvents =>", guestEvents);
      const event = eventsEventSchema.parse({
        type: "events",
        sender: username,
        events: guestEvents,
      } as EventsEvent);
      console.log("events event =>", event);
      webSocket.send(JSON.stringify(event));
    }

    console.log(
      'peerConnection.iceGatheringState === "complete" =>',
      peerConnection.iceGatheringState === "complete",
    );
    console.log("peerConnection =>", peerConnection);
    if (peerConnection.iceGatheringState === "complete") {
      shouldRunSendEventsRef.current = false;
      sendEvents(events, webSocket);
    }
  }, [username, host, peerConnection, events, webSocket]);

  // guest adds ice candidates
  useEffect(() => {
    if (
      !username ||
      !host ||
      !peerConnection ||
      host === username ||
      peerConnection.currentRemoteDescription === null
    )
      return;

    const _iceCandidatesEvents = events.filter(
      (event) => event.sender === host && event.type === "candidate",
    );
    const iceCandidatesEvents = z
      .array(candidateEventSchema)
      .parse(_iceCandidatesEvents);

    async function addIceCandidates(
      peerConnection: RTCPeerConnection,
      events: CandidateEvent[],
    ) {
      console.log("adding peer candidates =>");
      for (const event of events) {
        // 10. add peer candidates
        const { candidate } = event;
        peerConnection.addIceCandidate(JSON.parse(candidate));
      }
    }

    addIceCandidates(peerConnection, iceCandidatesEvents);
  }, [username, host, peerConnection, events]);

  // host creates offer
  useEffect(() => {
    if (
      !username ||
      !host ||
      !peerConnection ||
      host !== username ||
      peerConnection.iceGatheringState === "complete"
    )
      return;

    async function createOffer(peerConnection: RTCPeerConnection) {
      // 6. creates offer `.createOffer()`
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      // 7. sets setLocalDescription
      await peerConnection.setLocalDescription(offer);
      setEvents((prevEvents) => [
        ...prevEvents,
        {
          type: "offer",
          sender: username,
          sessionDescription: JSON.stringify(offer),
        } as OfferEvent,
      ]);
    }

    createOffer(peerConnection);
  }, [username, host, peerConnection]);

  useEffect(() => {
    if (!username || !host || !peerConnection) return;

    async function setupWebsocket(
      username: string,
      host: string,
      peerConnection: RTCPeerConnection,
    ) {
      const webSocket = new WebSocket(
        toWebsocket(
          `${getOrigin({ ENVIRONMENT: environment })}/broadcaster?host=${host}`,
        ),
      );
      setWebSocket(webSocket);
      webSocket.addEventListener("open", () => {
        console.log("connection established =>");
        if (username !== host) {
          console.log('sending "guest" event =>');
          const event = guestEventSchema.parse({
            type: "guest",
            sender: username,
          } as GuestEvent);
          webSocket.send(JSON.stringify(event));
        }
      });
      webSocket.addEventListener("message", ({ data }) => {
        const event = eventSchema.parse(JSON.parse(data));
        if (event.sender === username) {
          return;
        }
        console.log(`receiving "${event.type}" event =>`);
        if (event.type === "guest") {
          const events = eventsRef.current;
          const event = eventsEventSchema.parse({
            type: "events",
            sender: username,
            events,
          } as EventsEvent);
          console.log(`sending "${event.type}" event =>`);
          webSocket.send(JSON.stringify(event));
        } else if (event.type === "events") {
          const { events: _peerEvents } = event;
          const peerEvents = z
            .array(rtcEventSchema)
            .parse(_peerEvents.filter((event) => event.type !== "guest"));
          setEvents((events) => [...events, ...peerEvents]);
        } else {
          setEvents((events) => [...events, event]);
        }
      });
    }

    setupWebsocket(username, host, peerConnection);
  }, [username, host, peerConnection]);

  if (!username) {
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
    );
  }

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
                return "bg-pink-200 text-pink-900 border-pink-900";
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
                key={`event_${event.sender}_${index}`}
                className={clsx([
                  "flex items-center p-1 w-full border-2 space-x-2",
                  getColors(event.type),
                ])}
              >
                <span className="font-bold">{index}</span>
                <span className="flex-1">
                  {event.type} {`event =>`} sent by {event.sender}
                </span>
                <button
                  className={clsx(
                    "p-0.5 border-2 rounded-md",
                    getHoverColors(event.type),
                    getColors(event.type),
                  )}
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(event));
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
            );
          })}
        </ol>
      </section>
    </main>
  );
};

async function createPeerConnection(
  username: string,
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>,
) {
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
      setEvents((prevEvents) => [
        ...prevEvents,
        {
          candidate: JSON.stringify(event.candidate),
          sender: username,
          type: "candidate",
        } as CandidateEvent,
      ]);
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

  return peerConnection;
}

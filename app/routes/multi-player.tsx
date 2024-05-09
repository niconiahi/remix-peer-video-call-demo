import {
  type HeadersFunction,
  type MetaFunction,
} from "@remix-run/cloudflare";
import { Form } from "@remix-run/react";
import clsx from "clsx";
import { useRef, useState } from "react";
import invariant from "tiny-invariant";
import { z } from "zod";
import type {
  AnswerEvent,
  CandidateEvent,
  OfferEvent,
  Event,
} from "~/utils/peer-connection";
import {
  answerEventSchema,
  candidateEventSchema,
  eventSchema,
  offerEventSchema,
} from "~/utils/peer-connection";

export const headers: HeadersFunction = () => ({
  title: "Peer to peer chat app",
});

export const meta: MetaFunction = () => {
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

export default () => {
  const eventRef = useRef<HTMLTextAreaElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [peerConnection, setPeerConnection] = useState<
    RTCPeerConnection | undefined
  >(undefined);
  const _candidateEvents = z.array(candidateEventSchema).safeParse(
    events.filter((event) => {
      return event.type === "candidate";
    }),
  );
  const candidateEvents = _candidateEvents.success ? _candidateEvents.data : [];
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

  if (username.length === 0) {
    return (
      <main className="max-w-3xl mx-auto space-y-2 flex items-center justify-center h-screen">
        <Form className="bg-red-200 border-2 border-red-900 space-y-1 p-1">
          <p className="flex flex-col space-y-1">
            <label htmlFor="caller" className="text-red-900">
              Username
            </label>
            <input
              required
              type="text"
              id="caller"
              ref={usernameRef}
              className="border-2 border-red-900"
            />
          </p>
          <button
            className="p-4 w-full bg-red-200 border-2 border-red-900 text-red-900 hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-100 disabled:text-red-300 disabled:border-red-300"
            onClick={async () => {
              const input = usernameRef.current;

              if (!input) return;

              setUsername(input.value);
            }}
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
      <section className="grid grid-cols-10 gap-2">
        <button
          disabled={offerEvent !== undefined}
          className="p-4 bg-blue-100 w-full border-2 text-blue-900 border-blue-900 hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-100 disabled:text-blue-300 disabled:border-blue-300 col-span-4"
          type="submit"
          onClick={async () => {
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
                console.log("new candidate => ", event.candidate);
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

            // 6. creates offer `.createOffer()`
            const offer = await peerConnection.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });

            // 7. sets setLocalDescription
            peerConnection.setLocalDescription(offer);

            // 8. sends the offer as the "offer" event
            setPeerConnection(peerConnection);
            setEvents((prevEvents) => [
              ...prevEvents,
              {
                type: "offer",
                sender: username,
                sessionDescription: JSON.stringify(offer),
              } as OfferEvent,
            ]);
          }}
        >
          Create offer
        </button>
        <button
          className="p-4 w-full bg-green-200 border-2 border-green-900 text-green-900 hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-green-100 disabled:text-green-300 disabled:border-green-300 col-span-4"
          disabled={offerEvent === undefined || username === offerEvent?.sender}
          onClick={async () => {
            invariant(offerEvent, '"offer" is required to create an answer');

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
                console.log("new candidate => ", event.candidate);
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

            // 6. gets the offer value from the received event
            const { sessionDescription } = offerEvent;

            // 7. sets remote description using the offer
            peerConnection.setRemoteDescription(JSON.parse(sessionDescription));

            // 8. creates the answer using the offer
            const answer = await peerConnection.createAnswer();

            // 9. sets local description using the answer
            peerConnection.setLocalDescription(answer);

            // 10. add peer candidates
            candidateEvents
              .filter(({ sender }) => sender !== username)
              .forEach(({ candidate, sender }) => {
                console.log(
                  `${username} added an ice candidate from ${sender} =>`,
                );
                peerConnection.addIceCandidate(JSON.parse(candidate));
              });

            // 11. sends the answer as the "answer" event
            setPeerConnection(peerConnection);
            setEvents((prevEvents) => [
              ...prevEvents,
              {
                type: "answer",
                sender: username,
                sessionDescription: JSON.stringify(answer),
              } as AnswerEvent,
            ]);
          }}
        >
          Create answer
        </button>
        <button
          className="p-4 w-full bg-green-200 border-2 border-green-900 text-green-900 hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-green-100 disabled:text-green-300 disabled:border-green-300 col-span-2"
          disabled={
            offerEvent === undefined ||
            answerEvent === undefined ||
            answerEvent.sender === username ||
            peerConnection === undefined ||
            candidateEvents.length < 2
          }
          onClick={async () => {
            invariant(offerEvent, '"offerEvent" is required to add the answer');
            invariant(
              answerEvent,
              '"offerEvent" is required to add the answer',
            );
            invariant(
              peerConnection,
              '"peerConnection" is required to add the answer',
            );

            // 1. sets local description using the offer
            await peerConnection.setLocalDescription(
              JSON.parse(offerEvent.sessionDescription),
            );

            // 2. sets remote description using the answer
            await peerConnection.setRemoteDescription(
              JSON.parse(answerEvent.sessionDescription),
            );

            // 3. add peer candidates
            candidateEvents
              .filter(({ sender }) => sender !== username)
              .forEach(({ candidate, sender }) => {
                peerConnection.addIceCandidate(JSON.parse(candidate));
                console.log(
                  `${username} added an ice candidate from ${sender} =>`,
                );
              });
          }}
        >
          Add answer
        </button>
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
      <section className="grid grid-cols-3 space-y-2 gap-x-2 items-end">
        <p className="flex flex-col col-span-2">
          <label
            className="text-teal-900 border-2 border-teal-900 w-fit border-b-0 p-1"
            htmlFor="event"
          >
            Event
          </label>
          <textarea
            id="event"
            placeholder="Paste copied event here"
            className="max-h-[44px] h-[44px] flex-1 p-1 border-2 border-teal-900 bg-teal-200 placeholder:text-teal-900"
            ref={eventRef}
          />
        </p>
        <button
          onClick={() => {
            const textarea = eventRef.current;

            if (!textarea) return;

            const isArray = Array.isArray(JSON.parse(textarea.value));
            const events = z
              .array(eventSchema)
              .safeParse(
                isArray
                  ? JSON.parse(textarea.value)
                  : [JSON.parse(textarea.value)],
              );

            if (!events.success) {
              alert(events.error.message);

              return;
            }

            setEvents((prevEvents) => [...prevEvents, ...events.data]);

            textarea.value = "";
            console.info(
              `imported ${events.data.length} events from ${events.data[0].sender}`,
            );
          }}
          className={clsx([
            "h-[44px] col-span-1",
            "border-teal-900 bg-teal-200 text-teal-900 hover:bg-teal-400 border-2",
          ])}
        >
          Add event
        </button>
      </section>
      <section className="grid grid-cols-1 space-y-2">
        <button
          className="h-[44px] bg-indigo-100 w-full border-2 text-indigo-900 border-indigo-900 hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-100 disabled:text-indigo-300 disabled:border-indigo-300 col-span-4"
          onClick={() => {
            const emmitedEvents = events.filter(
              (event) => event.sender === username,
            );
            navigator.clipboard.writeText(JSON.stringify(emmitedEvents));
            console.info(
              `copied ${emmitedEvents.length} events emmited by you`,
            );
          }}
        >
          Copy events for the peer
        </button>
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

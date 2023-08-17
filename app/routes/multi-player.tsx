/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  json,
  type ActionArgs,
  type HeadersFunction,
  type LoaderArgs,
  type V2_MetaFunction,
  redirect,
} from "@remix-run/cloudflare";
import { useActionData, useFetcher, useLoaderData } from "@remix-run/react";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { namedAction } from "remix-utils";
import invariant from "tiny-invariant";
import { object, parse, safeParse, string } from "valibot";

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
      sessionDescription: string;
    }
  | {
      type: "answer";
      sessionDescription: string;
    }
  | {
      type: "ice-candidate";
      candidate: string;
    };

const OfferEventSchema = object({
  type: string(),
  sessionDescription: string(),
});

export async function action({ request }: ActionArgs) {
  return namedAction(request, {
    async offer() {
      const event = (await request.formData()).get("event");

      if (!event) {
        throw new Error(
          '"event" param is required when executing the "offer" action',
        );
      }

      const response = safeParse(
        OfferEventSchema,
        JSON.parse(event.toString()),
      );

      if (!response.success) {
        throw new Error(response.error.message);
      }

      const url = new URL(request.url);
      url.searchParams.set("offer", response.data.sessionDescription);

      return redirect(url.toString());
    },
  });
}

export function loader({ request }: LoaderArgs) {
  const url = new URL(request.url);
  const offer = url.searchParams.get("offer") ?? "";

  return json({
    offer,
    answer: "",
    iceCandidates: [] as string[],
    emittedEvents: [] as Event[],
    receivedEvents: [] as Event[],
  });
}

export default () => {
  const [peerConnection, setPeerConnection] = useState<
    RTCPeerConnection | undefined
  >(undefined);
  const [mediaStream, setMediaStream] = useState<MediaStream | undefined>(
    undefined,
  );

  const { emittedEvents, receivedEvents, answer, iceCandidates, offer } =
    useLoaderData<typeof loader>();

  const actionData = useActionData();
  console.log("actionData:", actionData);

  useSetupCaller({ setMediaStream, setPeerConnection });

  return (
    <main className="max-w-3xl mx-auto space-y-5">
      <section className="flex flex-row">
        <video className="w-3/5" id="local-video" autoPlay playsInline />
        <video className="w-2/5" id="remote-video" autoPlay playsInline />
      </section>
      <section className="grid grid-flow-col-dense gap-1">
        <OfferButton offer={offer} peerConnection={peerConnection} />
        <Button>Create answer</Button>
      </section>
      <section className="grid grid-flow-col-dense gap-1">
        <p className="flex flex-col">
          <label htmlFor="offer">Offer</label>
          <textarea
            id="offer"
            className="h-[300px]"
            disabled={offer.length > 0}
            value={offer}
            onChange={() => {
              // 1. creates peer connection
              const peerConnection = new RTCPeerConnection(iceServers);
              // 2. gets the offer value from the received event
              // 3. sets remote description using the offer
              // 4. sets up media and its video
              // 5. adds its media tracks to the peer connection
              // 6. creates the answer using the offer
              // 7. sets local description using the answer
              // 8. sends the answer as the "answer" event
            }}
          />
        </p>
        <p className="flex flex-col">
          <label htmlFor="answer">Answer</label>
          <textarea
            id="answer"
            disabled={answer.length > 0}
            className="h-[300px]"
            value={answer}
            onChange={() => {}}
          />
        </p>
      </section>
      <section className="grid grid-flow-col-dense gap-1">
        <ol>
          {emittedEvents.map((emmitedEvent) => (
            <Event
              className="bg-red-300"
              key={`emitted_event_${emmitedEvent.type}`}
            >
              <span>Sent event: {emmitedEvent.type}</span>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(emmitedEvent));
                }}
              >
                Copy
              </Button>
            </Event>
          ))}
        </ol>
        <ol>
          {receivedEvents.map((receivedEvent) => (
            <Event
              className="bg-blue-300"
              key={`emitted_event_${receivedEvent.type}`}
            >
              <span>Received event: {receivedEvent.type}</span>
            </Event>
          ))}
        </ol>
      </section>
      {/* <section>
        <p>
          <label>Add received event</label>
          <p className="flex flex-col">
            <label htmlFor="editable-offer">Event</label>
            <textarea
              id="editable-offer"
              className="h-[300px]"
              value={receivingEvent}
              disabled={receivingEvent.length > 0}
              onChange={(event) => setReceivingEvent(event.target.value)}
            />
          </p>
          <Button
            onClick={() => {
              const event = JSON.parse(receivingEvent) as unknown as Event;

              setReceivedEvents((receivedEvents) => [...receivedEvents, event]);
              setReceivingEvent("");
            }}
          >
            Add
          </Button>
        </p>
      </section> */}
    </main>
  );
};

function useSetupCaller({
  setMediaStream,
  setPeerConnection,
}: {
  setMediaStream: React.Dispatch<React.SetStateAction<MediaStream | undefined>>;
  setPeerConnection: React.Dispatch<
    React.SetStateAction<RTCPeerConnection | undefined>
  >;
}) {
  const fetcher = useFetcher();

  useEffect(() => {
    if (typeof window === "undefined") return;

    async function callerSetup() {
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
          // setIceCandidates((prevIceCandidates) => [
          //   ...prevIceCandidates,
          //   JSON.stringify(event.candidate),
          // ]);
        } else {
          console.log("all local candidates have been added =>");
        }
      };

      setMediaStream(mediaStream);
      setPeerConnection(peerConnection);
    }

    callerSetup();
  }, []);
}

function OfferButton({
  offer,
  peerConnection,
}: {
  offer: string;
  peerConnection?: RTCPeerConnection;
}) {
  const fetcher = useFetcher();

  return (
    <fetcher.Form>
      <Button
        // disabled={offer.length > 0}
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
              event: JSON.stringify({
                type: "offer",
                sessionDescription: JSON.stringify(offer),
              } as Event),
            },
            {
              method: "post",
              action: "?/offer",
            },
          );
        }}
      >
        Create offer
      </Button>
    </fetcher.Form>
  );
}

function Event({
  children,
  ...liProps
}: {
  children: ReactNode;
} & React.LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li
      {...liProps}
      className={clsx([
        "flex justify-between items-center p-3 w-full",
        liProps.className,
      ])}
    >
      {children}
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
        "p-4 bg-gray-900 text-gray-100 disabled:bg-gray-600 disabled:cursor-not-allowed",
        buttonProps.className,
      ])}
    >
      {children}
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

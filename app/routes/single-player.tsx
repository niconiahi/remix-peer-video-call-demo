import type { HeadersFunction, V2_MetaFunction } from "@remix-run/cloudflare";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

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

type Connection = {
  mediaStream?: MediaStream;
  peerConnection?: RTCPeerConnection;
};

type Step =
  | "media"
  | "peerConnection"
  | "createOffer"
  | "setOffer"
  | "createAnswer"
  | "setAnswer"
  | undefined;

export default () => {
  const [offer, setOffer] = useState("");
  const [answer, setAnswer] = useState("");
  const [step, setStep] = useState<Step>("media");
  // const [sources, setSources] = useState<MediaDeviceInfo[]>([]);
  const [local, setLocal] = useState<Connection>({
    mediaStream: undefined,
    peerConnection: undefined,
  });
  const [remote, setRemote] = useState<Connection>({
    mediaStream: undefined,
    peerConnection: undefined,
  });

  // 1. get audio and video options available for the user
  useEffect(() => {
    if (typeof window === "undefined") return;

    // get possible local user media inputs options
    // function getSources() {
    //   console.log("getting sources =>");
    //   return navigator.mediaDevices.enumerateDevices();
    // }

    // getSources().then(setSources);

    // setup browser-dependant initial state
    setLocal((prevLocal) => ({
      ...prevLocal,
      peerConnection: new RTCPeerConnection(iceServers),
    }));

    setRemote((prevRemote) => ({
      ...prevRemote,
      peerConnection: new RTCPeerConnection(iceServers),
    }));
  }, []);

  return (
    <main className="max-w-3xl mx-auto space-y-5">
      {/* <section>
        <p>
          <label htmlFor="audioSrc">Audio source:</label>
          <select id="audioSrc">
            <option value={undefined}>Not selected</option>
            {sources
              .filter(({ kind }) => kind === "audioinput")
              .map(({ deviceId, label }) => (
                <option key={`audio_source_${deviceId}`} value={deviceId}>
                  {label}
                </option>
              ))}
          </select>
        </p>
        <p>
          <label htmlFor="videoSrc">Video source:</label>
          <select className="w-24" id="videoSrc">
            <option value={undefined}>Not selected</option>
            {sources
              .filter(({ kind }) => kind === "videoinput")
              .map(({ deviceId, label }) => (
                <option key={`video_source_${deviceId}`} value={deviceId}>
                  {label}
                </option>
              ))}
          </select>
        </p>
      </section> */}
      <section className="grid grid-flow-col-dense gap-1">
        <Button
          disabled={step !== "media"}
          // 2. get local media and set the local video up
          onClick={async () => {
            function getMediaStream() {
              return navigator.mediaDevices.getUserMedia({
                video: {
                  width: { min: 640, ideal: 1920, max: 1920 },
                  height: { min: 480, ideal: 1080, max: 1080 },
                },
                audio: false,
              });
            }

            const mediaStream = await getMediaStream();

            setLocal((prevLocal) => ({
              ...prevLocal,
              mediaStream,
            }));

            const localVideo = document.querySelector("#local-video");

            if (localVideo) {
              (localVideo as HTMLVideoElement).srcObject = mediaStream;
            }

            setStep("peerConnection");
          }}
        >
          Get media
        </Button>
        <Button
          disabled={step !== "peerConnection"}
          // 3. establish peer connection:
          // - peers need to share media tracks
          // - peers need to share ice candidates
          onClick={async () => {
            const {
              mediaStream: localMediaStream,
              peerConnection: localPeerConnection,
            } = local;
            const { peerConnection: remotePeerConnection } = remote;

            if (!localMediaStream) {
              throw new Error(
                '"localVideoStream" is required to establish a peer connection',
              );
            }
            if (!remotePeerConnection) {
              throw new Error(
                '"remotePeerConnection" is required to establish a peer connection',
              );
            }
            if (!localPeerConnection) {
              throw new Error(
                '"localPeerConnection" is required to establish a peer connection',
              );
            }

            const localAudioTracks = localMediaStream.getAudioTracks();
            const localVideoTracks = localMediaStream.getVideoTracks();

            if (localVideoTracks.length > 0) {
              console.log(`using video device => ${localVideoTracks[0].label}`);
            }
            if (localAudioTracks.length > 0) {
              console.log(`using audio device => ${localAudioTracks[0].label}`);
            }

            const remoteVideo = document.querySelector("#remote-video");

            localPeerConnection.onicecandidate = (event) => {
              if (event.candidate) {
                remotePeerConnection.addIceCandidate(event.candidate);
              } else {
                console.log("all local candidates have been added =>");
              }
            };
            remotePeerConnection.onicecandidate = (event) => {
              if (event.candidate) {
                localPeerConnection.addIceCandidate(event.candidate);
              } else {
                console.log("all remote candidates have been added =>");
              }
            };
            remotePeerConnection.ontrack = (event) => {
              if (!remoteVideo) return;
              const video = remoteVideo as HTMLVideoElement;
              const mediaStream = event.streams[0];

              if (video.srcObject !== mediaStream) {
                video.srcObject = mediaStream;
              }
            };
            localMediaStream
              .getTracks()
              .forEach((track) =>
                localPeerConnection.addTrack(track, localMediaStream),
              );

            setStep("createOffer");
          }}
        >
          Create peer connection
        </Button>
        <Button
          disabled={step !== "createOffer"}
          // 4. the local user, the one who initiates the conection, creates the offer
          onClick={async () => {
            const { peerConnection: localPeerConnection } = local;

            if (!localPeerConnection) {
              throw new Error(
                '"localPeerConnection" is required to create an offer',
              );
            }

            const offer = await localPeerConnection.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });

            setOffer(JSON.stringify(offer));
            setStep("setOffer");
          }}
        >
          Create offer
        </Button>
        <Button
          disabled={step !== "setOffer"}
          // 5. with this offer:
          // - the local user sets it as its local description
          // - the remote user sets it as its remote description
          onClick={async () => {
            const { peerConnection: localPeerConnection } = local;
            const { peerConnection: remotePeerConnection } = remote;

            if (!localPeerConnection) {
              throw new Error(
                '"localPeerConnection" is required to set the offer',
              );
            }
            if (!remotePeerConnection) {
              throw new Error(
                '"remotePeerConnection" is required to set the offer',
              );
            }

            const description = JSON.parse(offer);
            await localPeerConnection.setLocalDescription(description);
            await remotePeerConnection.setRemoteDescription(description);
            setStep("createAnswer");
          }}
        >
          Set offer
        </Button>
        <Button
          disabled={step !== "createAnswer"}
          // 6. the remote user, the one who accepts the conection, creates the answer
          onClick={async () => {
            const { peerConnection: remotePeerConnection } = remote;

            if (!remotePeerConnection) {
              throw new Error(
                '"remotePeerConnection" is required to set the offer',
              );
            }

            const answer = await remotePeerConnection.createAnswer();

            setAnswer(JSON.stringify(answer));
            setStep("setAnswer");
          }}
        >
          Create answer
        </Button>
        <Button
          // 7. with this answer:
          // - the local user sets it as its remote description
          // - the remote user sets it as its local description
          disabled={step !== "setAnswer"}
          onClick={async () => {
            const { peerConnection: localPeerConnection } = local;
            const { peerConnection: remotePeerConnection } = remote;

            if (!localPeerConnection) {
              throw new Error(
                '"localPeerConnection" is required to set the offer',
              );
            }
            if (!remotePeerConnection) {
              throw new Error(
                '"remotePeerConnection" is required to set the offer',
              );
            }

            const description = JSON.parse(answer);
            await localPeerConnection.setRemoteDescription(description);
            await remotePeerConnection.setLocalDescription(description);
            setStep(undefined);
          }}
        >
          Set answer
        </Button>
      </section>
      <section className="flex flex-row">
        <video className="w-1/2" id="local-video" autoPlay playsInline />
        <video className="w-1/2" id="remote-video" autoPlay playsInline />
      </section>
      <section className="flex flex-row">
        <textarea className="w-3/4 h-[300px]" value={offer} readOnly />
        <textarea className="w-3/4 h-[300px]" value={answer} readOnly />
      </section>
    </main>
  );
};

function Button({
  children,
  ...buttonProps
}: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="p-4 bg-gray-900 text-gray-100 disabled:bg-gray-600 disabled:cursor-not-allowed"
      {...buttonProps}
    >
      {children}
    </button>
  );
}

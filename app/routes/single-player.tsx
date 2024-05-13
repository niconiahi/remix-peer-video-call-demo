import type { HeadersFunction, MetaFunction } from "@remix-run/cloudflare"
import { useEffect, useState } from "react"

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

const iceServers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
}

interface Connection {
  mediaStream?: MediaStream
  peerConnection?: RTCPeerConnection
}

type Step =
  | "media"
  | "peerConnection"
  | "createOffer"
  | "setOffer"
  | "createAnswer"
  | "setAnswer"
  | undefined

export default () => {
  const [offer, setOffer] = useState("")
  const [answer, setAnswer] = useState("")
  const [step, setStep] = useState<Step>("media")
  const [local, setLocal] = useState<Connection>({
    mediaStream: undefined,
    peerConnection: undefined,
  })
  const [remote, setRemote] = useState<Connection>({
    mediaStream: undefined,
    peerConnection: undefined,
  })

  // 1. get audio and video options available for the user
  useEffect(() => {
    if (typeof window === "undefined")
      return

    // setup browser-dependant initial state
    setLocal(prevLocal => ({
      ...prevLocal,
      peerConnection: new RTCPeerConnection(iceServers),
    }))

    setRemote(prevRemote => ({
      ...prevRemote,
      peerConnection: new RTCPeerConnection(iceServers),
    }))
  }, [])

  return (
    <main className="max-w-3xl mx-auto space-y-2 py-2">
      <section className="grid grid-cols-2 gap-2">
        <video
          className="border-2 border-gray-900 w-full h-[215.5px]"
          id="local-video"
          autoPlay
          playsInline
        />
        <video
          className="border-2 border-gray-900 w-full h-[215.5px]"
          id="remote-video"
          autoPlay
          playsInline
        />
      </section>
      <section className="grid grid-flow-col-dense gap-1">
        <button
          disabled={step !== "media"}
          className="p-4 w-full bg-fuchsia-200 border-2 border-fuchsia-900 text-fuchsia-900 hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:bg-fuchsia-100 disabled:text-fuchsia-300 disabled:border-fuchsia-300 col-span-4"
          // 2. get local media and set the local video up
          onClick={async () => {
            function getMediaStream() {
              return navigator.mediaDevices.getUserMedia({
                video: {
                  width: { min: 640, ideal: 1920, max: 1920 },
                  height: { min: 480, ideal: 1080, max: 1080 },
                },
                audio: false,
              })
            }

            const mediaStream = await getMediaStream()

            setLocal(prevLocal => ({
              ...prevLocal,
              mediaStream,
            }))

            const localVideo = document.querySelector("#local-video")

            if (localVideo)
              (localVideo as HTMLVideoElement).srcObject = mediaStream

            setStep("peerConnection")
          }}
        >
          Get media
        </button>
        <button
          disabled={step !== "peerConnection"}
          className="p-4 w-full bg-red-200 border-2 border-red-900 text-red-900 hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-100 disabled:text-red-300 disabled:border-red-300 col-span-4"
          // 3. establish peer connection:
          // - peers need to share media tracks
          // - peers need to share ice candidates
          onClick={async () => {
            const {
              mediaStream: localMediaStream,
              peerConnection: localPeerConnection,
            } = local
            const { peerConnection: remotePeerConnection } = remote

            if (!localMediaStream) {
              throw new Error(
                "\"localVideoStream\" is required to establish a peer connection",
              )
            }
            if (!remotePeerConnection) {
              throw new Error(
                "\"remotePeerConnection\" is required to establish a peer connection",
              )
            }
            if (!localPeerConnection) {
              throw new Error(
                "\"localPeerConnection\" is required to establish a peer connection",
              )
            }

            const localAudioTracks = localMediaStream.getAudioTracks()
            const localVideoTracks = localMediaStream.getVideoTracks()

            if (localVideoTracks.length > 0)
              console.log(`using video device => ${localVideoTracks[0].label}`)

            if (localAudioTracks.length > 0)
              console.log(`using audio device => ${localAudioTracks[0].label}`)

            const remoteVideo = document.querySelector("#remote-video")

            localPeerConnection.onicecandidate = (event) => {
              if (event.candidate) {
                console.log("onClick={ ~ event.candidate:", event.candidate)
                remotePeerConnection.addIceCandidate(event.candidate)
              }
              else {
                console.log("all local candidates have been added =>")
              }
            }
            remotePeerConnection.onicecandidate = (event) => {
              if (event.candidate)
                localPeerConnection.addIceCandidate(event.candidate)
              else
                console.log("all remote candidates have been added =>")
            }
            remotePeerConnection.ontrack = (event) => {
              if (!remoteVideo)
                return
              const video = remoteVideo as HTMLVideoElement
              const mediaStream = event.streams[0]

              if (video.srcObject !== mediaStream)
                video.srcObject = mediaStream
            }
            localMediaStream
              .getTracks()
              .forEach(track =>
                localPeerConnection.addTrack(track, localMediaStream),
              )

            setStep("createOffer")
          }}
        >
          Create peer connection
        </button>
        <button
          className="p-4 bg-blue-100 w-full border-2 text-blue-900 border-blue-900 hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-100 disabled:text-blue-300 disabled:border-blue-300 col-span-4"
          disabled={step !== "createOffer"}
          // 4. the local user, the one who initiates the conection, creates the offer
          onClick={async () => {
            const { peerConnection: localPeerConnection } = local

            if (!localPeerConnection) {
              throw new Error(
                "\"localPeerConnection\" is required to create an offer",
              )
            }

            const offer = await localPeerConnection.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            })

            setOffer(JSON.stringify(offer))
            setStep("setOffer")
          }}
        >
          Create offer
        </button>
        <button
          disabled={step !== "setOffer"}
          className="p-4 bg-orange-100 w-full border-2 text-orange-900 border-orange-900 hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-orange-100 disabled:text-orange-300 disabled:border-orange-300 col-span-4"
          // 5. with this offer:
          // - the local user sets it as its local description
          // - the remote user sets it as its remote description
          onClick={async () => {
            const { peerConnection: localPeerConnection } = local
            const { peerConnection: remotePeerConnection } = remote

            if (!localPeerConnection) {
              throw new Error(
                "\"localPeerConnection\" is required to set the offer",
              )
            }
            if (!remotePeerConnection) {
              throw new Error(
                "\"remotePeerConnection\" is required to set the offer",
              )
            }

            const description = JSON.parse(offer)
            await localPeerConnection.setLocalDescription(description)
            await remotePeerConnection.setRemoteDescription(description)
            setStep("createAnswer")
          }}
        >
          Set offer
        </button>
        <button
          disabled={step !== "createAnswer"}
          className="p-4 w-full bg-green-200 border-2 border-green-900 text-green-900 hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-green-100 disabled:text-green-300 disabled:border-green-300 col-span-4"
          // 6. the remote user, the one who accepts the conection, creates the answer
          onClick={async () => {
            const { peerConnection: remotePeerConnection } = remote

            if (!remotePeerConnection) {
              throw new Error(
                "\"remotePeerConnection\" is required to set the offer",
              )
            }

            const answer = await remotePeerConnection.createAnswer()

            setAnswer(JSON.stringify(answer))
            setStep("setAnswer")
          }}
        >
          Create answer
        </button>
        <button
          // 7. with this answer:
          // - the local user sets it as its remote description
          // - the remote user sets it as its local description
          disabled={step !== "setAnswer"}
          className="p-4 bg-purple-100 w-full border-2 text-purple-900 border-purple-900 hover:bg-purple-400 disabled:cursor-not-allowed disabled:bg-purple-100 disabled:text-purple-300 disabled:border-purple-300 col-span-4"
          onClick={async () => {
            const { peerConnection: localPeerConnection } = local
            const { peerConnection: remotePeerConnection } = remote

            if (!localPeerConnection) {
              throw new Error(
                "\"localPeerConnection\" is required to set the offer",
              )
            }
            if (!remotePeerConnection) {
              throw new Error(
                "\"remotePeerConnection\" is required to set the offer",
              )
            }

            const description = JSON.parse(answer)
            await localPeerConnection.setRemoteDescription(description)
            await remotePeerConnection.setLocalDescription(description)
            setStep(undefined)
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
            defaultValue={offer}
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
            defaultValue={answer}
          />
        </p>
      </section>
    </main>
  )
}

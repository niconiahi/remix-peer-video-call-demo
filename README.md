### Expectations
In this repo you'll learn how to create a [WebRTC connection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection) connection between your local computer and a peer computer (a new tab is OK)

### Demo
In this demo you can find all the demos this repository holds - [demo](https://remix-peer-video-call-demo.pages.dev/)

### Files to pay attention
1. [single-player.tsx](/app/routes/single-player.tsx)
2. [multi-player.tsx](/app/routes/multi-player.tsx)

### Links
- [Very thorough MDN article on how WebRTC works](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling)
- [Another great MDN article to add to the previous one](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity)
- [WebRTC course by Traversy Media](https://www.youtube.com/watch?v=QsH8FL0952k)
- [Official demo by WebRTC](https://webrtc.github.io/samples/src/content/peerconnection/munge-sdp/)
- [All official demos by WebRTC](https://webrtc.github.io/samples/)

### Demos
- [webrtc/samples/tree/gh-pages/src/content/peerconnection/munge-sdp](https://github.com/webrtc/samples/tree/gh-pages/src/content/peerconnection/munge-sdp)
- [divanov11/WebRTC-Simple-SDP-Handshake-Demo](https://github.com/divanov11/WebRTC-Simple-SDP-Handshake-Demo)
- [divanov11/PeerChat](https://github.com/divanov11/PeerChat)

### Instructions

#### Single player
- Visit the page `/single-player` to be able to go through the complete process of creating a WebRTC connection all within one tab
- It's recommended to start here to get a greater understanding of what's happening before jumping into a more detailed demo

#### Multiplayer
- Visit the page `/multi-player` to be able to go through the complete process of creating a WebRTC connection all within one tab
- In this you'll see `events` being created as you interact with the demo. These are the actual `events` that would be travelling through a signaling system when creating the WebRTC connection
- We are replacing the signaling system with copy-pasting, so that these `events` can "travel" from one peer to the other
- The buttons disable as it makes sense. If you are creating the offer, you won't be able to create the answer
- Once you have no button to click on next, you need to "Copy events for the peer" and send give these copied events to the peer you are trying to connect to
- You can try it yourself by opening two different tabs of the same page, no need for an actual different person to test it

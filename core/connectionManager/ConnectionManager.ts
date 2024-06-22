import io, { Socket } from "socket.io-client";
// import { Rnnoise } from "@shiguredo/rnnoise-wasm";
//types
import {
  SocketEvent,
  CONNECTION_MANAGER_EVENTS,
  INCOMING_SOCKET_EVENTS,
  OUTGOING_SOCKET_EVENTS,
  WEB_RTC_EVENTS,
} from "./types";

export class ConnectionManager extends EventTarget {
  private _socket: Socket;
  private _myId?: string;
  private _roomId?: string;
  private _peers: Record<string, RTCPeerConnection> = {};
  private _pcConfig: any;
  private _isAdmin: boolean = false;

  private _audioContext?: AudioContext;
  private _workletNode?: AudioWorkletNode;

  private _localStream?: MediaStream;
  private _remoteStreams: Record<string, MediaStream> = {};
  private _hostURL?: string;

  private _rnnoise: any;

  private _audioSource: MediaStreamAudioSourceNode | null = null;

  private _audioDestination: MediaStreamAudioDestinationNode | null = null;

  private _noiseSuppressorNode?: AudioWorkletNode | null = null;

  private _originalMediaTrack: MediaStreamTrack | null = null;

  private _outputMediaTrack: MediaStreamTrack | null = null;

  constructor({
    socketUrl,
    pcConfig,
    hostURL,
  }: {
    socketUrl: string;
    pcConfig: any;
    hostURL: string;
  }) {
    super();
    this._hostURL = hostURL;
    console.log("hostURL ,this", this._hostURL);
    this._pcConfig = pcConfig;
    // try {
    this._socket = io(socketUrl, {
      transports: ["websocket"],
    });

    // this._loadRNNoise();
    // }
    // catch (error) {
    //   console.log("Error", { error });
    // }
  }
  // private async _loadRNNoise(){
  //   //  this._rnnoise = await Rnnoise.load({assetsPath:`${this._hostURL}/`});
  //    console.log("RNN loaded");
  // }

  private async _initializeAudioContext(): Promise<AudioWorkletNode | undefined
  > {
    // if(this._audioContext){
    //   this._workletNode?.disconnect();
    //   this._audioContext.close();
    // }
    // this._audioContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    // try {

    //   // console.log("Rnn framesize: ",this._rnnoise.frameSize);

    //   await this._audioContext!.audioWorklet.addModule( `${this._hostURL}/NoiseSuppressionProcessor.ts`);
    //   console.log("AUDIOCONT. ",this._audioContext);

    //   setTimeout(() => {
    //   }, 500);

    //   this._workletNode = new AudioWorkletNode(this._audioContext!, "noise-suppression-processor", {

    //   });
    //   this._workletNode?.port.postMessage({rnnoise: this._rnnoise, type: "rnnoise_module"});

    //   console.log("AUDIO CONTEXT");
    //   this._workletNode.connect(this._audioContext!.destination);
    // } catch (error) {

    //   console.error('Error initializing audio context:', JSON.stringify(error));
    // }

    await this._audioContext?.resume();
    try {
      setTimeout(() => {}, 1000);
      await this._audioContext!.audioWorklet.addModule(
        `${this._hostURL}/NoiseSuppressionProcessor.js`
      ); // ?? see source code
    } catch (error) {
      console.log("Error while adding audio worklet module: ", error);
    }
    setTimeout(() => {}, 1000);
    return (new AudioWorkletNode(this._audioContext!, 'noise-suppressor-worklet',{

    }));
  }

  getRoomId() {
    return this._roomId;
  }

  private _emitEventToServer(
    event: SocketEvent,
    payload?: { message: any; toId: string }
  ) {
    const { message, toId } = payload || {};

    const socket = this._socket;

    console.log("Emit event to server", {
      event,
      firstArg: { message, toId, fromId: socket.id },
      roomId: this._roomId,
    });
    socket.emit(event, { message, toId, fromId: socket.id }, this._roomId);
  }

  private _emitEventToUI(eventName: string, detail: any) {
    this.dispatchEvent(
      new CustomEvent(eventName, {
        detail,
      })
    );
  }

  // if initiator
  private _onPeer(socketId: string) {
    // make a new webRTC Peer connection for incoming peer
    this._createPeerConnection(socketId);

    const guestPc = this._peers[socketId];
    this._peers[socketId] = guestPc;

    // createOffer for that guest
    console.log(`Creating offer for sid: ${socketId}`);

    guestPc.createOffer().then((sessionDescription) => {
      // setLocalDescription
      guestPc.setLocalDescription(sessionDescription);

      console.log(
        `Offer has been created for guest: ${socketId} with sessionDescription:`,
        sessionDescription
      );

      // send offer to this guest
      this._emitEventToServer(OUTGOING_SOCKET_EVENTS.SEND_OFFER, {
        toId: socketId,
        message: sessionDescription,
      });
    });
  }

  // if guest
  private _onOffer(socketId: string, sessionDescription: any) {
    this._peers[socketId].setRemoteDescription(sessionDescription).then(() => {
      console.log(
        `Remote sessionDescription for client: ${socketId} is created`
      );
      this._peers[socketId].createAnswer().then((localDescription) => {
        console.log(
          `An answer for client: ${socketId} is created with sessionDescription:`,
          localDescription
        );

        this._peers[socketId].setLocalDescription(localDescription);

        // send answer to this guest
        this._emitEventToServer(OUTGOING_SOCKET_EVENTS.SEND_ANSWER, {
          toId: socketId,
          message: localDescription,
        });
      });
    });
  }

  private _onAnswer(socketId: string, sessionDescription: any) {
    this._peers[socketId].setRemoteDescription(sessionDescription).then(() => {
      console.log(
        `Remote Session description for answer from client: ${socketId} is set successfully`
      );
    });
  }

  private _addEventListeners() {
    console.log("Adding event listeners on socket");

    const socket = this._socket;

    socket.on("connect", () => {
      console.log("Socket is connected");

      this._myId = this._socket.id;

      // send event to server and ask to make a new room with this roomId if not already present else join this room
      this._emitEventToServer(OUTGOING_SOCKET_EVENTS.JOIN);
    });

    socket.on(INCOMING_SOCKET_EVENTS.ROOM_CREATED, (socketId: string) => {
      console.log(`Room ${this._roomId} has been created`);

      this._isAdmin = true;

      const localStream = this._localStream;

      this._emitEventToUI(CONNECTION_MANAGER_EVENTS.ADD_PARTICIPANT, {
        participant: {
          id: socketId,
          name: "Admin",
          stream: localStream,
        },
      });
    });

    socket.on(
      INCOMING_SOCKET_EVENTS.ROOM_JOINED,
      (socketId: string, existingClients: Array<string>) => {
        const localStream = this._localStream;

        this._emitEventToUI(CONNECTION_MANAGER_EVENTS.ADD_PARTICIPANT, {
          participant: {
            id: socketId,
            name: "Admin",
            stream: localStream,
          },
        });

        // create new RTCPeerConnection for each existing clients
        existingClients.map((socketId) => {
          this._createPeerConnection(socketId);
        });
      }
    );

    socket.on(INCOMING_SOCKET_EVENTS.GUEST_LEFT, (socketId: string) => {
      console.log(`Guest with sid: ${socketId} left the room.`);
    });

    socket.on(INCOMING_SOCKET_EVENTS.NEW_GUEST_JOINED, (socketId: string) => {
      if (socketId !== this._socket.id) {
        console.log(`Guest with sid: ${socketId} joined the room.`);
        this._onPeer(socketId);
      }
    });

    socket.on(
      INCOMING_SOCKET_EVENTS.OFFER,
      (socketId: string, sessionDescription: any) => {
        console.log(
          `Client: ${socketId} sent an offer with sessionDescription:`,
          sessionDescription
        );
        this._onOffer(socketId, sessionDescription);
      }
    );

    socket.on(
      INCOMING_SOCKET_EVENTS.ANSWER,
      (socketId: string, sessionDescription: any) => {
        console.log(`Got answer from peer with sid: ${socketId}.`);
        this._onAnswer(socketId, sessionDescription);
      }
    );

    socket.on(
      INCOMING_SOCKET_EVENTS.ADD_ICE_CANDIDATE,
      (socketId: string, message: any) => {
        this._peers[socketId].addIceCandidate(
          new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate,
          })
        );
        console.log(`Added ice candidate to client: ${socketId} connection `);
      }
    );

    socket.on(INCOMING_SOCKET_EVENTS.GUEST_LEFT, (socketId: string) => {
      this._peers[socketId].close();
      delete this._peers[socketId];
      delete this._remoteStreams[socketId];

      this._emitEventToUI(CONNECTION_MANAGER_EVENTS.REMOVE_PARTICIPANT, {
        participantId: socketId,
      });
    });
  }

  private _createPeerConnection(socketId: string) {
    if (this._peers[socketId]) {
      console.warn(
        "Connection with sid: ",
        socketId,
        " was already established"
      );
      return;
    }

    const pc = new RTCPeerConnection(this._pcConfig);
    // map local stream tracks to current peer tracks
    const localStream = this._localStream;
    localStream?.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // add event listener for iceCandidate
    pc.addEventListener(WEB_RTC_EVENTS.ICE_CANDIDATE, (event: any) => {
      console.log("iceCandidate event", { candidate: event.candidate });

      // send ice candidate through signalling server
      if (event.candidate) {
        this._emitEventToServer(OUTGOING_SOCKET_EVENTS.SEND_ICE_CANDIDATE, {
          toId: socketId,
          message: {
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
          },
        });
      }
    });

    pc.addEventListener(WEB_RTC_EVENTS.CONNECTION_STATE_CHANGE, (e) => {
      console.log("Connection state change: ", { e });
    });
    pc.addEventListener(WEB_RTC_EVENTS.ICE_CANDIDATE_ERROR, (e) => {
      console.log("Ice candidate error: ", { e });
    });
    pc.addEventListener(WEB_RTC_EVENTS.ICE_CONNECTION_STATE_CHANGE, (e) => {
      console.log("Ice connection state change: ", { e });
    });
    pc.addEventListener(WEB_RTC_EVENTS.ICE_GATHERINGS_STATE_CHANGE, (e) => {
      console.log("Ice gatherings state change: ", { e });
    });
    pc.addEventListener(WEB_RTC_EVENTS.NEGOTIATION_NEEDED, (e) => {
      console.log("Ice negotiations needed: ", { e });
    });
    pc.addEventListener(WEB_RTC_EVENTS.SIGNALLING_STATE_CHANGE, (e) => {
      console.log("Signalling state change: ", { e });
    });

    pc.addEventListener(WEB_RTC_EVENTS.TRACK, (event: RTCTrackEvent) => {
      console.log("Remote stream added for ", socketId);

      //save this stream to streams locally
      console.log("Local stream: ", this._localStream);
      console.log("incoming stream: ", event.streams[0].id);
      if (
        !this._remoteStreams[socketId] &&
        this._localStream?.id !== event.streams[0].id
      ) {
        this._remoteStreams[socketId] = event.streams[0];
        this._emitEventToUI(CONNECTION_MANAGER_EVENTS.ADD_PARTICIPANT, {
          participant: {
            id: socketId,
            name: `Guest: ${socketId}`,
            stream: event.streams[0],
          },
        });
      }
    });

    this._peers[socketId] = pc;

    console.log("Created RTCPeerConnection for ", socketId);
  }

  startEffect(audioStream: MediaStream): MediaStream {
    this._originalMediaTrack = audioStream.getAudioTracks()[0];

    // if (!this._audioContext) {
    //   this._audioContext = new ((window as any).AudioContext ||
    //     (window as any).webkitAudioContext)();
    // }
    console.log("AC -",this._audioContext);
    this._audioSource = this._audioContext!.createMediaStreamSource(audioStream);
    this._audioDestination = this._audioContext!.createMediaStreamDestination();
    this._outputMediaTrack = this._audioDestination.stream.getAudioTracks()[0];

    let init = this._initializeAudioContext().then((filterNode) => {
      this._noiseSuppressorNode = filterNode;
    });

    init.then(() => {
      if (this._noiseSuppressorNode) {
        this._audioSource?.connect(this._noiseSuppressorNode);
        this._noiseSuppressorNode.connect(this._audioDestination!);
      }
    });

    // Sync the effect track muted state with the original track state.
    this._outputMediaTrack.enabled = this._originalMediaTrack.enabled;

    this._originalMediaTrack.enabled = true;

    return this._audioDestination.stream;
  }

  public async init(roomId: string) {
    // add roomId to local variables
    this._roomId = roomId;
    
    // getLocalStream
    // try {
    //   this._localStream = await navigator.mediaDevices.getUserMedia({
    //     audio: true,
    //     video: true,
    //   });
    //   this.mute();
    //   // if (this._audioContext && this._workletNode && this._localStream) {
    //   //   const source = this._audioContext.createMediaStreamSource(this._localStream);
    //   //   source.connect(this._workletNode);
    //   // }
    //   if (!this._audioContext) {
    //     this._audioContext = new ((window as any).AudioContext ||
    //       (window as any).webkitAudioContext)();
    //   }

    //   console.log("Got the local stream.", this._localStream);
    //   this._addEventListeners();

    //   console.log("Initialization completed successfully.");
    // } catch (error) {
    //   console.error("Error initializing:", error);
    // }
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: true,
      })
      .then((stream) => {
        console.log("Got local stream.", stream);
        this._localStream = stream;

        // add event listeners on socket connection
        this._addEventListeners();
      })
      .catch((e) => {
        console.error("Can't get user media because of error: ", { error: e });
      });






  }
  mute() {
    var audioTracks = this._localStream!.getAudioTracks();
    audioTracks.forEach(function (track) {
      track.enabled = false;
    });
  }
  unmute() {
    var audioTracks = this._localStream!.getAudioTracks();
    audioTracks.forEach(function (track) {
      track.enabled = true;
    });
    // start effecT
    
    // const processedStream = this.startEffect(this._localStream!);
    // this._localStream = processedStream;
  }
  destroy() {
    console.log("Destroying websocket");
    if (this._socket) {
      this._socket.close();
    }
    // Close the audio context if it exists
    if (this._audioContext) {
      this._audioContext.close();
    }
  }
}

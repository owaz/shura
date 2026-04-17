import React, { useRef, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

const BACKEND = 'http://localhost:5001';

interface CallWidgetProps {
  roomId?: string;
  audioOnly?: boolean;
}

export default function CallWidget({ roomId: initialRoomId = 'test-room', audioOnly = false }: CallWidgetProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [roomId, setRoomId] = useState(initialRoomId);
  const [joined, setJoined] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(!audioOnly);
  const [status, setStatus] = useState('');
  const [callDuration, setCallDuration] = useState(0);

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioEnabled, video: videoEnabled });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setStatus('Local stream started');
    } catch (err) {
      setStatus('Failed to access camera/microphone: ' + (err as Error).message);
      throw err;
    }
  };

  const ensureSocket = () => {
    if (socket) return socket;
    const s = io(BACKEND, { transports: ['websocket'] });
    setSocket(s);
    return s;
  };

  const createPeerConnection = (s: Socket) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        s.emit('webrtc_ice_candidate', { roomId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
      setStatus('Remote stream received');
    };

    pc.onconnectionstatechange = () => {
      setStatus(`Connection: ${pc.connectionState}`);
    };

    // add local tracks
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        pc.addTrack(track, localStreamRef.current);
      }
    }

    return pc;
  };

  const handleJoin = async () => {
    await startLocalStream();
    const s = ensureSocket();
    const pc = createPeerConnection(s);
    pcRef.current = pc;

    s.emit('join_call', { roomId });

    s.on('webrtc_offer', async ({ from, sdp }) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      s.emit('webrtc_answer', { roomId, sdp: pcRef.current.localDescription });
      setStatus('Answered call');
    });

    s.on('webrtc_answer', async ({ from, sdp }) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      setInCall(true);
      setStatus('Call connected');
    });

    s.on('webrtc_ice_candidate', async ({ from, candidate }) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.addIceCandidate(candidate);
      } catch (err) {
        console.warn('Failed to add ICE candidate', err);
      }
    });

    s.on('peer_joined', ({ socketId }) => {
      setStatus(`Peer joined: ${socketId}`);
    });

    s.on('peer_left', ({ socketId }) => {
      setStatus(`Peer left: ${socketId}`);
      setInCall(false);
    });

    setJoined(true);
  };

  const handleCall = async () => {
    if (!socket) return;
    if (!pcRef.current) return;
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    socket.emit('webrtc_offer', { roomId, sdp: pcRef.current.localDescription });
    setStatus('Calling...');
  };

  const handleLeave = () => {
    if (socket) {
      socket.emit('leave_call', { roomId });
      socket.disconnect();
      setSocket(null);
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      for (const t of localStreamRef.current.getTracks()) t.stop();
      localStreamRef.current = null;
    }
    setJoined(false);
    setInCall(false);
    setStatus('');
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  useEffect(() => {
    return () => {
      handleLeave();
    };
  }, []);

  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (inCall) {
      setCallDuration(0);
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [inCall]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gray-900 text-white">
        <h3 className="text-lg font-semibold">{audioOnly ? 'Audio Call' : 'Video Call'}</h3>
        <div className="text-sm text-gray-300">Room: {roomId}</div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center relative">
        {!audioOnly ? (
          <>
            {/* Remote video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Local video overlay */}
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute top-4 right-4 w-32 h-24 border-2 border-white rounded-lg object-cover"
            />
          </>
        ) : (
          /* Audio call UI */
          <div className="text-center text-white">
            <div className="w-24 h-24 bg-gray-600 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Audio Call in Progress</h2>
            <p className="text-gray-300 text-3xl font-mono">{formatDuration(callDuration)}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-gray-900">
        <div className="flex justify-center space-x-4">
          {!joined ? (
            <button
              onClick={handleJoin}
              className="px-6 py-3 bg-green-600 text-white rounded-full font-semibold hover:bg-green-700 transition-colors"
            >
              Start Call
            </button>
          ) : (
            <>
              {inCall && (
                <>
                  <button
                    onClick={toggleAudio}
                    className={`px-4 py-3 rounded-full font-semibold transition-colors ${
                      audioEnabled ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {audioEnabled ? 'Mute' : 'Unmute'}
                  </button>
                  {!audioOnly && (
                    <button
                      onClick={toggleVideo}
                      className={`px-4 py-3 rounded-full font-semibold transition-colors ${
                        videoEnabled ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {videoEnabled ? 'Video Off' : 'Video On'}
                    </button>
                  )}
                </>
              )}
              <button
                onClick={handleCall}
                disabled={inCall}
                className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inCall ? 'In Call' : 'Call'}
              </button>
              <button
                onClick={handleLeave}
                className="px-6 py-3 bg-red-600 text-white rounded-full font-semibold hover:bg-red-700 transition-colors"
              >
                End Call
              </button>
            </>
          )}
        </div>
        <div className="text-center mt-4 text-gray-400 text-sm">
          {status}
        </div>
      </div>
    </div>
  );
}

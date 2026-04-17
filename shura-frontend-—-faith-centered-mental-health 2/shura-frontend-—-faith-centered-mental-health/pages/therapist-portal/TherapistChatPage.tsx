
import React, { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Client, Conversation, Message } from '../../types';

// MOCK DATA
const mockClients: Client[] = [
  { id: 1, name: 'Aisha P.', avatarUrl: 'https://i.pravatar.cc/150?u=aisha' },
  { id: 2, name: 'Omar F.', avatarUrl: 'https://i.pravatar.cc/150?u=omar' },
  { id: 3, name: 'Fatima K.', avatarUrl: 'https://i.pravatar.cc/150?u=fatima' },
];

const mockConversations: Conversation[] = [
    {
        client: mockClients[0],
        messages: [
            { id: 1, text: "Assalamu Alaikum Dr. Zaina, thank you for the session last week. I've been practicing the breathing exercises.", senderId: 1, timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
            { id: 2, text: "Wa'alaikum Assalam Aisha, I'm so glad to hear that. How have they been working for you?", senderId: 'therapist', timestamp: new Date(Date.now() - 2 * 24 * 60 * 58 * 1000).toISOString() },
            { id: 3, text: "They help a lot, especially in the mornings. I feel more centered.", senderId: 1, timestamp: new Date(Date.now() - 2 * 24 * 60 * 55 * 1000).toISOString() },
        ]
    },
    {
        client: mockClients[1],
        messages: [
            { id: 4, text: "Hi Doctor, just wanted to confirm our session for tomorrow at 2 PM.", senderId: 2, timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() },
            { id: 5, text: "Hello Omar, yes, it's confirmed. Looking forward to it.", senderId: 'therapist', timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
        ]
    },
    {
        client: mockClients[2],
        messages: [
             { id: 6, text: "I had a question about the article you shared.", senderId: 3, timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
        ]
    }
];

const VideoIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const AudioIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
);

const SendIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);

const TherapistChatPage: React.FC = () => {
    const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(conversations[0]);
    const [newMessage, setNewMessage] = useState('');
    const [callActive, setCallActive] = useState(false);
    const [callType, setCallType] = useState<'audio' | 'video' | null>(null);
    const [callStatus, setCallStatus] = useState('');
    const [callDuration, setCallDuration] = useState(0);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const callTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeConversation]);

    // Attach local stream to video element when available
    useEffect(() => {
        if (localStreamRef.current && localVideoRef.current && callType === 'video') {
            console.log('🎥 Attaching stream to video element');
            localVideoRef.current.srcObject = localStreamRef.current;
            localVideoRef.current.onloadedmetadata = () => {
                console.log('✅ Video metadata loaded, playing...');
                localVideoRef.current?.play().catch(err => console.error('Video play error:', err));
            };
        }
    }, [callType, callActive]);

    // Call duration timer
    useEffect(() => {
        if (callActive) {
            setCallDuration(0);
            callTimerRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (callTimerRef.current) {
                clearInterval(callTimerRef.current);
                callTimerRef.current = null;
            }
            setCallDuration(0);
        }
        
        return () => {
            if (callTimerRef.current) {
                clearInterval(callTimerRef.current);
            }
        };
    }, [callActive]);

    const formatCallDuration = (seconds: number): string => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Initialize socket only when needed for calls
    const initializeSocket = () => {
        if (!socketRef.current) {
            socketRef.current = io('http://localhost:5001', { 
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: 1000,
                timeout: 10000
            });
        }
        return socketRef.current;
    };

    const initializeMediaStream = async (type: 'audio' | 'video') => {
        try {
            const constraints = {
                audio: true,
                video: type === 'video' ? { 
                    width: { ideal: 1280 }, 
                    height: { ideal: 720 },
                    facingMode: 'user'
                } : false
            };
            console.log('Requesting media with constraints:', constraints);
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Got media stream:', stream.getTracks());
            localStreamRef.current = stream;
            
            // Note: Video element might not be in DOM yet, will attach in useEffect
            console.log('localVideoRef.current exists?', !!localVideoRef.current);
            
            return stream;
        } catch (error) {
            console.error('Media access error:', error);
            setCallStatus(`Error accessing media: ${(error as Error).message}`);
            throw error;
        }
    };

    const startCall = async (type: 'audio' | 'video') => {
        console.log('🎬 startCall clicked! Type:', type, 'Active conversation:', activeConversation?.client?.name || 'none');
        
        if (!activeConversation) {
            console.error('❌ No active conversation! Cannot start call.');
            return;
        }
        
        try {
            setCallType(type);
            setCallStatus('Starting call...');
            
            // Initialize socket connection
            const socket = initializeSocket();
            
            // Initialize media stream
            const stream = await initializeMediaStream(type);
            
            // Create peer connection
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            
            peerConnectionRef.current = pc;
            
            // Add local stream tracks
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });
            
            // Handle remote stream
            pc.ontrack = (event) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };
            
            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate && socket) {
                    socket.emit('ice-candidate', {
                        to: activeConversation.client.id,
                        candidate: event.candidate
                    });
                }
            };
            
            // Create and send offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            socket?.emit('call-offer', {
                to: activeConversation.client.id,
                offer,
                callType: type
            });
            
            setCallActive(true);
            setCallStatus(`${type.charAt(0).toUpperCase() + type.slice(1)} call connected`);
        } catch (error) {
            setCallStatus(`Call failed: ${(error as Error).message}`);
            endCall();
        }
    };

    const endCall = () => {
        // Stop all tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        
        // Close peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        
        // Emit call end event
        if (activeConversation && socketRef.current) {
            socketRef.current.emit('call-end', { to: activeConversation.client.id });
        }
        
        setCallActive(false);
        setCallType(null);
        setCallStatus('');
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeConversation) return;

        const message: Message = {
            id: Date.now(),
            text: newMessage,
            senderId: 'therapist',
            timestamp: new Date().toISOString()
        };

        const updatedConversations = conversations.map(convo => 
            convo.client.id === activeConversation.client.id 
            ? { ...convo, messages: [...convo.messages, message] }
            : convo
        );

        setConversations(updatedConversations);
        setActiveConversation(updatedConversations.find(c => c.client.id === activeConversation.client.id) || null);
        setNewMessage('');
    };

    return (
        <div className="flex h-[calc(100vh-100px)] bg-ivory rounded-xl shadow-lg overflow-hidden">
            {/* Conversation List */}
            <div className="w-1/3 border-r border-sand flex flex-col">
                <div className="p-4 border-b border-sand">
                    <h1 className="text-xl font-serif font-bold text-brown-dark">Client Conversations</h1>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {conversations.map(convo => (
                        <div 
                            key={convo.client.id} 
                            className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-sand transition-colors ${activeConversation?.client.id === convo.client.id ? 'bg-sand' : ''}`}
                            onClick={() => setActiveConversation(convo)}
                        >
                            <img src={convo.client.avatarUrl} alt={convo.client.name} className="w-12 h-12 rounded-full object-cover"/>
                            <div className="flex-grow overflow-hidden">
                                <p className="font-semibold text-brown-dark">{convo.client.name}</p>
                                <p className="text-sm text-taupe truncate">{convo.messages[convo.messages.length - 1].text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Window */}
            <div className="w-2/3 flex flex-col">
                {activeConversation ? (
                    <>
                    <div className="p-4 border-b border-sand flex items-center justify-between bg-white">
                        <div className="flex items-center gap-4">
                            <img src={activeConversation.client.avatarUrl} alt={activeConversation.client.name} className="w-10 h-10 rounded-full object-cover"/>
                            <h2 className="font-semibold text-brown-dark">{activeConversation.client.name}</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => callActive ? endCall() : startCall('audio')}
                                className={`p-2 rounded-lg transition-colors ${
                                    callActive && callType === 'audio' 
                                    ? 'bg-red-500 text-white' 
                                    : 'text-taupe hover:text-brown-soft'
                                }`} 
                                aria-label="Start audio call"
                            >
                                <AudioIcon className="w-6 h-6" />
                            </button>
                             <button 
                                onClick={() => callActive ? endCall() : startCall('video')}
                                className={`p-2 rounded-lg transition-colors ${
                                    callActive && callType === 'video' 
                                    ? 'bg-red-500 text-white' 
                                    : 'text-taupe hover:text-brown-soft'
                                }`} 
                                aria-label="Start video call"
                            >
                                <VideoIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-grow p-6 overflow-y-auto bg-sand/50 relative">
                        {/* Call Interface */}
                        {callActive && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 p-6">
                                <div className="text-white text-center">
                                    <p className="text-xl font-semibold mb-2">{callStatus}</p>
                                    <p className="text-3xl font-mono font-bold mb-4" style={{ color: '#F8F5F0' }}>{formatCallDuration(callDuration)}</p>
                                    <button 
                                        onClick={endCall}
                                        className="mt-4 bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-semibold"
                                    >
                                        End Call
                                    </button>
                                </div>
                                {callType === 'video' && (
                                    <div className="flex gap-4 w-full max-w-4xl">
                                        <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden" style={{ minHeight: '400px', maxHeight: '600px' }}>
                                            <video 
                                                ref={localVideoRef} 
                                                autoPlay 
                                                playsInline
                                                muted 
                                                className="w-full h-full object-cover"
                                                style={{ transform: 'scaleX(-1)' }}
                                            />
                                            <p className="absolute bottom-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">You</p>
                                        </div>
                                        <div className="flex-1 relative bg-gray-700 rounded-lg overflow-hidden" style={{ minHeight: '400px', maxHeight: '600px' }}>
                                            <video 
                                                ref={remoteVideoRef} 
                                                autoPlay 
                                                playsInline
                                                className="w-full h-full object-cover" 
                                            />
                                            <p className="absolute bottom-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">{activeConversation?.client.name}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Chat Messages */}
                        {!callActive && (
                            <div className="space-y-4">
                                {activeConversation.messages.map(message => (
                                <div key={message.id} className={`flex ${message.senderId === 'therapist' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-md p-3 rounded-xl ${message.senderId === 'therapist' ? 'bg-brown-soft text-white' : 'bg-white text-brown-dark shadow-sm'}`}>
                                        <p>{message.text}</p>
                                        <p className={`text-xs mt-1 ${message.senderId === 'therapist' ? 'text-ivory/70 text-right' : 'text-taupe text-left'}`}>
                                            {new Date(message.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                            </div>
                        )}
                    </div>
                    {!callActive && (
                    <div className="p-4 bg-white border-t border-sand">
                        <form onSubmit={handleSendMessage} className="flex items-center gap-4">
                            <input 
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type your message..."
                                className="flex-grow bg-sand rounded-full py-3 px-4 focus:ring-brown-soft focus:border-brown-soft border-transparent text-brown-dark"
                            />
                            <button type="submit" className="bg-brown-soft text-white p-3 rounded-full hover:bg-opacity-90 transition-colors shadow-sm" aria-label="Send message">
                                <SendIcon className="w-6 h-6" />
                            </button>
                        </form>
                    </div>
                    )}
                    </>
                ) : (
                    <div className="flex-grow flex items-center justify-center">
                        <p className="text-taupe">Select a conversation to start chatting.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TherapistChatPage;

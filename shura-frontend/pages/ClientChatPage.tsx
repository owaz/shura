
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Therapist, Message } from '../types';
import { mockTherapists } from '../data/therapists';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeftIcon } from '../components/Icons';

// Re-using icons from TherapistChatPage, defined locally for this component
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


const ClientChatPage: React.FC = () => {
    const { therapistId } = useParams<{ therapistId: string }>();
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [therapist, setTherapist] = useState<Therapist | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        
        const foundTherapist = mockTherapists.find(t => t.id === Number(therapistId));
        if (foundTherapist) {
            setTherapist(foundTherapist);
            // Mock initial conversation
            setMessages([
                { id: 1, text: `Assalamu Alaikum, I saw your profile and I'm interested in booking a session to discuss some personal growth challenges.`, senderId: 99, timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() }, // Assuming client ID is 99
                { id: 2, text: `Wa'alaikum Assalam! Thank you for reaching out. I'd be happy to help. Feel free to ask any questions you have, or we can go ahead and schedule an introductory call.`, senderId: 'therapist', timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString() },
            ]);
        } else {
            // Therapist not found, redirect to the list
            navigate('/therapists');
        }
    }, [isAuthenticated, navigate, therapistId]);
    
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !therapist) return;

        const message: Message = {
            id: Date.now(),
            text: newMessage,
            senderId: 99, // client ID
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, message]);
        setNewMessage('');
    };

    if (!therapist) {
        return (
            <div className="flex h-screen items-center justify-center bg-sand">
                <p className="text-brown-soft">Loading chat...</p>
            </div>
        );
    }

    return (
        <div className="flex h-screen flex-col bg-sand">
            {/* Chat Header */}
            <header className="flex-shrink-0 bg-ivory p-4 border-b border-sand shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="text-brown-soft hover:text-brown-dark">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <img src={therapist.imageUrl} alt={therapist.name} className="w-12 h-12 rounded-full object-cover" />
                    <div>
                        <h1 className="font-bold text-brown-dark text-lg">{therapist.name}</h1>
                        <p className="text-sm text-taupe">{therapist.title}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/call', { state: { roomId: `therapist-${therapistId}`, audioOnly: true } })} className="p-2 text-taupe hover:text-brown-soft transition-colors" aria-label="Start audio call">
                        <AudioIcon className="w-7 h-7" />
                    </button>
                    <button onClick={() => navigate('/call', { state: { roomId: `therapist-${therapistId}` } })} className="p-2 text-taupe hover:text-brown-soft transition-colors" aria-label="Start video call">
                        <VideoIcon className="w-7 h-7" />
                    </button>
                </div>
            </header>

            {/* Messages */}
            <main className="flex-grow p-6 overflow-y-auto">
                <div className="space-y-4">
                    {messages.map(message => (
                        <div key={message.id} className={`flex ${message.senderId !== 'therapist' ? 'justify-end' : 'justify-start'}`}>
                             <div className={`flex items-end max-w-lg gap-2 ${message.senderId !== 'therapist' ? 'flex-row-reverse' : ''}`}>
                                {message.senderId === 'therapist' && (
                                    <img src={therapist.imageUrl} alt={therapist.name} className="w-8 h-8 rounded-full object-cover self-end flex-shrink-0"/>
                                )}
                                <div className={`p-3 rounded-xl ${message.senderId !== 'therapist' ? 'bg-brown-soft text-white rounded-br-none' : 'bg-white text-brown-dark shadow-sm rounded-bl-none'}`}>
                                    <p className="leading-relaxed">{message.text}</p>
                                    <p className={`text-xs mt-1 ${message.senderId !== 'therapist' ? 'text-ivory/70 text-right' : 'text-taupe text-left'}`}>
                                        {new Date(message.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>
            </main>

            {/* Message Input */}
            <footer className="flex-shrink-0 p-4 bg-ivory border-t border-sand">
                <form onSubmit={handleSendMessage} className="flex items-center gap-4">
                    <input 
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-grow bg-sand rounded-full py-3 px-5 focus:ring-brown-soft focus:border-brown-soft border-transparent text-brown-dark placeholder:text-taupe"
                        aria-label="Chat message input"
                    />
                    <button type="submit" className="bg-brown-soft text-white p-3 rounded-full hover:bg-opacity-90 transition-colors shadow-sm flex-shrink-0" aria-label="Send message">
                        <SendIcon className="w-6 h-6" />
                    </button>
                </form>
            </footer>
        </div>
    );
};

export default ClientChatPage;

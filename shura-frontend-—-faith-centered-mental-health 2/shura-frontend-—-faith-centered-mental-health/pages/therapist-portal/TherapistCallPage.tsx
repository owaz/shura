import React from 'react';
import { useLocation } from 'react-router-dom';
import CallWidget from '../../components/CallWidget';

export default function TherapistCallPage() {
  const location = useLocation();
  const roomId = (location.state as any)?.roomId || 'therapist-room';
  const audioOnly = (location.state as any)?.audioOnly || false;

  return (
    <div style={{ padding: 20 }}>
      <h1>{audioOnly ? 'Audio Call' : 'Video Call'}</h1>
      <CallWidget roomId={roomId} audioOnly={audioOnly} />
    </div>
  );
}
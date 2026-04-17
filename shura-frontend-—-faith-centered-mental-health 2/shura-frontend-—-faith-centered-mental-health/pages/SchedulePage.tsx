
import React, { useState } from 'react';
import CalendarDemo from '../components/CalendarDemo';

interface Session {
  id: number;
  therapist: string;
  date: string;
  time: string;
  type: string;
  status: string;
  duration?: number;
  notes?: string;
  recordingUrl?: string;
}

const mockUpcomingSessions: Session[] = [
  {
    id: 1,
    therapist: 'Dr. Zara Khan',
    date: '2026-02-02',
    time: '10:00 AM',
    type: 'Video',
    status: 'Upcoming',
  },
  {
    id: 2,
    therapist: 'Dr. Omar Siddiq',
    date: '2026-02-10',
    time: '3:30 PM',
    type: 'Audio',
    status: 'Upcoming',
  },
];

const mockPastSessions: Session[] = [
  {
    id: 101,
    therapist: 'Dr. Zara Khan',
    date: '2026-01-28',
    time: '10:00 AM',
    type: 'Video',
    status: 'Completed',
    duration: 55,
    notes: 'Discussed anxiety management techniques and coping strategies.',
    recordingUrl: '#'
  },
  {
    id: 102,
    therapist: 'Dr. Omar Siddiq',
    date: '2026-01-21',
    time: '3:30 PM',
    type: 'Audio',
    status: 'Completed',
    duration: 48,
    notes: 'Session focused on personal growth and self-reflection.',
    recordingUrl: '#'
  },
  {
    id: 103,
    therapist: 'Dr. Zara Khan',
    date: '2026-01-14',
    time: '2:00 PM',
    type: 'Video',
    status: 'Completed',
    duration: 60,
    notes: 'Initial assessment and goal-setting for therapy journey.',
    recordingUrl: '#'
  },
];


const SchedulePage: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  return (
    <div className="min-h-screen bg-[#F3E9DC] flex flex-col relative">
      {/* Watermark */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none select-none z-0">
        <img 
          src="https://res.cloudinary.com/dyqspp2ud/image/upload/e_background_removal/v1762852351/grey_shura_logo_cdrwgs.png"
          alt="Shura Logo Watermark"
          className="opacity-5"
          style={{width: '400px', height: '400px', objectFit: 'contain'}}
        />
      </div>
      {/* Main Content */}
      <main className="flex-1 p-8 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#5C5043] font-serif">My Sessions</h1>
        </div>
        
        {/* All Sessions */}
        <section>
          <div className="space-y-4">
            {mockUpcomingSessions.length === 0 && mockPastSessions.length === 0 ? (
              <p className="text-[#8D7B68] text-center py-8 bg-[#F3E9DC] rounded-lg">No sessions scheduled.</p>
            ) : (
              <>
                {/* Upcoming Sessions */}
                {mockUpcomingSessions.length > 0 && (
                  <>
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-[#5C5043] mb-3">Upcoming</h3>
                      <div className="space-y-4">
                        {mockUpcomingSessions.map((session) => (
                          <div key={session.id} className="flex items-center justify-between p-4 gap-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow border-l-4 border-[#C5A059]">
                            <div className="flex items-center gap-4 flex-1">
                              <img src={`https://randomuser.me/api/portraits/men/${40 + session.id}.jpg`} alt={session.therapist} className="w-12 h-12 rounded-full border-2 border-[#b4845c]" />
                              <div className="flex-1">
                                <div className="font-semibold text-[#5C5043]">{session.therapist}</div>
                                <div className="text-sm text-[#8D7B68]">{session.date} at {session.time}</div>
                                <div className="text-xs text-[#8D7B68]">{session.type} Session</div>
                              </div>
                            </div>
                            <button className="px-4 py-2 bg-[#b4845c] text-white rounded-lg font-medium hover:bg-[#8D7B68] transition-colors">
                              Join Call
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Past Sessions */}
                {mockPastSessions.length > 0 && (
                  <>
                    <div>
                      <h3 className="text-lg font-semibold text-[#5C5043] mb-3">Past Sessions</h3>
                      <div className="space-y-4">
                        {mockPastSessions.map((session) => (
                          <div key={session.id} className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow border-l-4 border-[#D4C4B0]">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex items-start gap-4 flex-1">
                                <img src={`https://randomuser.me/api/portraits/men/${40 + (session.id % 2)}.jpg`} alt={session.therapist} className="w-12 h-12 rounded-full border-2 border-[#b4845c]" />
                                <div className="flex-1">
                                  <div className="font-semibold text-[#5C5043]">{session.therapist}</div>
                                  <div className="text-sm text-[#8D7B68]">{session.date} at {session.time}</div>
                                  <div className="flex gap-4 mt-1">
                                    <span className="text-xs bg-[#D4C4B0] text-[#5C5043] px-2 py-1 rounded-full">{session.type}</span>
                                    <span className="text-xs bg-[#D4C4B0] text-[#5C5043] px-2 py-1 rounded-full">{session.duration} mins</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="ml-16">
                              <div className="text-sm text-[#8D7B68] mb-3">
                                <span className="font-medium">Notes:</span> {session.notes}
                              </div>
                              {session.recordingUrl && (
                                <button className="text-[#b4845c] font-medium text-sm hover:text-[#8D7B68] transition-colors">
                                  📹 View Recording
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default SchedulePage;

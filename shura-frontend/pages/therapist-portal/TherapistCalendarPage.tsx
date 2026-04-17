
import React, { useState } from 'react';
import type { Appointment, Client } from '../../types';
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/Icons';

// Mock Data
const mockClients: Client[] = [
  { id: 1, name: 'Aisha P.', avatarUrl: 'https://i.pravatar.cc/150?u=aisha' },
  { id: 2, name: 'Omar F.', avatarUrl: 'https://i.pravatar.cc/150?u=omar' },
  { id: 3, name: 'Fatima K.', avatarUrl: 'https://i.pravatar.cc/150?u=fatima' },
  { id: 4, name: 'Yusuf K.', avatarUrl: 'https://i.pravatar.cc/150?u=yusuf' },
];

const generateMockAppointments = (date: Date): Appointment[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return [
        { id: 1, client: mockClients[0], dateTime: new Date(year, month, 3, 10, 0).toISOString(), sessionType: 'Video', status: 'Upcoming' },
        { id: 2, client: mockClients[1], dateTime: new Date(year, month, 10, 14, 30).toISOString(), sessionType: 'Audio', status: 'Upcoming' },
        { id: 3, client: mockClients[2], dateTime: new Date(year, month, 10, 16, 0).toISOString(), sessionType: 'Video', status: 'Upcoming' },
        { id: 4, client: mockClients[3], dateTime: new Date(year, month, 22, 11, 0).toISOString(), sessionType: 'Text', status: 'Upcoming' },
        { id: 5, client: mockClients[0], dateTime: new Date(year, month, 25, 9, 0).toISOString(), sessionType: 'Video', status: 'Completed' },
    ];
};


const TherapistCalendarPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const mockAppointments = generateMockAppointments(currentDate);

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDay = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday, etc.

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const leadingEmptyDays = Array.from({ length: startingDay });
  
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (day: number) => 
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day;

  const sessionTypeColors: Record<'Video' | 'Audio' | 'Text', string> = {
    Video: 'bg-blue-400',
    Audio: 'bg-green-400',
    Text: 'bg-yellow-400',
  };

  return (
    <div className="bg-ivory p-6 rounded-xl shadow-lg">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-brown-dark">
          {currentDate.toLocaleString('default', { month: 'long' })} {year}
        </h1>
        <div className="flex items-center space-x-2">
          <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-sand transition-colors">
            <ChevronLeftIcon className="h-6 w-6 text-taupe" />
          </button>
          <button onClick={handleToday} className="px-4 py-2 text-sm font-semibold text-brown-dark bg-sand rounded-lg hover:bg-taupe/40 transition-colors">
            Today
          </button>
          <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-sand transition-colors">
            <ChevronRightIcon className="h-6 w-6 text-taupe" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-semibold text-taupe text-sm pb-2">{day}</div>
        ))}

        {leadingEmptyDays.map((_, index) => <div key={`empty-${index}`} className="border-t border-sand"></div>)}
        
        {days.map(day => {
            const dayAppointments = mockAppointments.filter(app => new Date(app.dateTime).getDate() === day);
            return (
              <div key={day} className={`min-h-[120px] p-2 border-t border-l border-sand flex flex-col ${isToday(day) ? 'bg-sand' : 'bg-white'}`}>
                  <div className={`font-semibold text-sm ${isToday(day) ? 'text-brown-soft' : 'text-brown-dark'}`}>{day}</div>
                  <div className="mt-1 space-y-1 overflow-y-auto scrollbar-hide">
                    {dayAppointments.map(app => (
                        <div key={app.id} className="bg-ivory p-1.5 rounded-md text-xs border-l-4 border-brown-soft">
                            <div className="flex items-center">
                                <span className={`w-2 h-2 rounded-full mr-1.5 flex-shrink-0 ${sessionTypeColors[app.sessionType]}`}></span>
                                <p className="font-semibold text-brown-dark truncate">{app.client.name}</p>
                            </div>
                            <p className="text-taupe pl-3.5">{new Date(app.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                        </div>
                    ))}
                  </div>
              </div>
            )
        })}
      </div>
    </div>
  );
};

export default TherapistCalendarPage;

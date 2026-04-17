import React, { useState } from 'react';

const users = [
  { name: 'Esther C. Casecord', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', status: 'upcoming' },
  { name: 'Mosh Feloseoo', avatar: 'https://randomuser.me/api/portraits/men/45.jpg', status: 'upcoming' },
  { name: 'Hainard Baosechig', avatar: 'https://randomuser.me/api/portraits/men/46.jpg', status: 'completed' },
  { name: 'Bed Contd', avatar: 'https://randomuser.me/api/portraits/women/47.jpg', status: 'cancelled' },
];

const calendarAvatars = [
  'https://randomuser.me/api/portraits/women/44.jpg',
  'https://randomuser.me/api/portraits/men/45.jpg',
  'https://randomuser.me/api/portraits/men/46.jpg',
  'https://randomuser.me/api/portraits/women/47.jpg',
];

const ClientDashboardReplica: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Live Status Bar */}
      <div className="w-full bg-green-500 text-white text-center py-2 font-semibold tracking-wide">Live: Your therapist is online</div>
      {/* Main Content */}
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Client Portal</h1>
          </div>
          <div className="flex items-center gap-4">
            <input className="border rounded px-3 py-1 text-sm" placeholder="Search..." />
            <span className="relative">
              <img src="https://randomuser.me/api/portraits/women/48.jpg" alt="User" className="w-8 h-8 rounded-full" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
            </span>
            <img src="https://randomuser.me/api/portraits/men/49.jpg" alt="User" className="w-8 h-8 rounded-full" />
          </div>
        </div>
        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upcoming Sessions & Book */}
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Upcoming</h2>
              <button className="bg-green-500 text-white px-4 py-2 rounded font-semibold hover:bg-green-600">Book A Session</button>
            </div>
            <div className="bg-white rounded-xl shadow p-4 divide-y">
              {users.map((user, i) => (
                <div key={i} className="flex items-center py-3 gap-4">
                  <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full border-2 border-green-200" />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{user.name}</div>
                    <div className="text-xs text-gray-400">@{user.name.toLowerCase().replace(/\s/g, '')}</div>
                  </div>
                  <button className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-medium">Book Session</button>
                </div>
              ))}
            </div>
          </section>
          {/* Calendar */}
          <section>
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center gap-2 mb-4">
                {calendarAvatars.map((src, i) => (
                  <img key={i} src={src} alt="avatar" className="w-7 h-7 rounded-full border-2 border-white -ml-2 first:ml-0" />
                ))}
                <span className="ml-2 text-xs text-gray-400">+2</span>
              </div>
              <div className="text-center mb-2 font-semibold text-gray-700">Sail</div>
              {/* Simple static calendar grid */}
              <table className="w-full text-center border-collapse mb-2">
                <thead>
                  <tr className="text-xs text-gray-400">
                    <th>AM</th><th>UW</th><th>TE</th><th>WEC</th><th>DIV</th><th>FK</th><th>MOV</th><th>BSGY</th>
                  </tr>
                </thead>
                <tbody>
                  {[...Array(5)].map((_, w) => (
                    <tr key={w}>
                      {[...Array(7)].map((_, d) => (
                        <td key={d} className="py-1">
                          <button className={`w-7 h-7 rounded-full ${selectedDate === w * 7 + d + 1 ? 'bg-green-500 text-white' : 'hover:bg-green-100'}`} onClick={() => setSelectedDate(w * 7 + d + 1)}>
                            {w * 7 + d + 1 <= 31 ? w * 7 + d + 1 : ''}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        {/* Therapist History & Session History */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <section className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold mb-2">Therapist History</h3>
              <div className="text-sm text-gray-500">No therapist history yet.</div>
            </div>
          </section>
          <section>
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold mb-2">Session History</h3>
              <div className="text-sm text-gray-500">No session history yet.</div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default ClientDashboardReplica;

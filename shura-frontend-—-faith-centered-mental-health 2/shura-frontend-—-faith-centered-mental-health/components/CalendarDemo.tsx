import React, { useState } from 'react';

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const daysInMonth = 31;
const firstDayOfMonth = 4; // January 1, 2026 is a Thursday (index 4)

// Example: days with availability or special markers (customize as needed)
const availableDays = [6, 9, 17, 20, 27];

const CalendarDemo: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Build the calendar grid for January 2026
  const weeks: (number | null)[][] = [];
  let currentDay = 1 - firstDayOfMonth;
  for (let week = 0; week < 6; week++) {
    const weekArr: (number | null)[] = [];
    for (let day = 0; day < 7; day++) {
      if (currentDay > 0 && currentDay <= daysInMonth) {
        weekArr.push(currentDay);
      } else {
        weekArr.push(null);
      }
      currentDay++;
    }
    weeks.push(weekArr);
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <table className="w-full text-center border-collapse select-none">
        <thead>
          <tr>
            {daysOfWeek.map((d) => (
              <th key={d} className="py-2 text-xs font-semibold text-gray-400">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>
              {week.map((day, j) => {
                if (!day) {
                  return <td key={j} className="py-2" />;
                }
                let cellClass =
                  'w-10 h-10 rounded-full transition-colors duration-150 cursor-pointer mx-auto flex items-center justify-center ';
                let textClass = 'text-base ';
                if (selectedDay === day) {
                  if (availableDays.includes(day)) {
                    cellClass += 'bg-[#e6f4f1] text-[#24585D] font-semibold rounded-full shadow-none border-none ';
                  } else {
                    cellClass += 'bg-gray-300 text-white ';
                  }
                } else if (availableDays.includes(day)) {
                  cellClass += 'bg-[#e6f4f1] text-[#24585D] font-semibold rounded-full shadow-none border-none ';
                } else {
                  cellClass += 'hover:bg-gray-100 text-gray-700 ';
                }
                return (
                  <td key={j} className="py-2">
                    <button
                      className={cellClass + ' relative'}
                      onClick={() => setSelectedDay(day)}
                      style={{ position: 'relative' }}
                    >
                      {/* Dots above number removed as requested */}
                      <span className={textClass}>{day}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {selectedDay && (
        <div className="mt-4 text-center">
          <div className="text-lg font-semibold">Selected: Jan {selectedDay}, 2026</div>
          {availableDays.includes(selectedDay) && (
            <div className="mt-2">
              <div className="text-gray-700 mb-2">Available slots:</div>
              <div className="flex gap-4 justify-center">
                {['10:00 AM', '2:00 PM'].map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className={
                      'px-7 py-2 rounded-full text-lg font-semibold shadow-none border-none ' +
                      (selectedSlot === slot
                        ? 'bg-[#24585D] text-white'
                        : 'bg-[#e6f4f1] text-[#24585D]')
                    }
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              {selectedSlot && (
                <div className="mt-3 text-[#24585D] font-medium">Selected slot: {selectedSlot}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarDemo;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from '../config/api';
import { Watermark } from '../components/Watermark';

const BookingPage: React.FC = () => {
  const [therapists, setTherapists] = useState<any[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTherapists();
  }, []);

  const fetchTherapists = async () => {
    try {
      const res = await fetch(`${config.apiUrl}/api/therapists`);
      const data = await res.json();
      setTherapists(data.therapists || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSlots = async () => {
    if (!selectedTherapist || !date) return;
    
    try {
      const res = await fetch(`${config.apiUrl}/api/bookings/therapist/${selectedTherapist}/slots?date=${date}`);
      const data = await res.json();
      setSlots(data.slots || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedTherapist && date) {
      fetchSlots();
    }
  }, [selectedTherapist, date]);

  const handleBook = async () => {
    if (!selectedTherapist || !date || !time) {
      alert('Please select therapist, date, and time');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.apiUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          therapist_id: selectedTherapist,
          date,
          time,
          session_type: 'video'
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        // Proceed to payment
        const amount = 500; // ₹500 per session
        navigate(`/payment?booking_id=${data.booking.id}&amount=${amount}`);
      } else {
        alert(data.error || 'Booking failed');
      }
    } catch (err) {
      alert('Booking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Book a Session</h1>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Therapist</label>
            <select
              value={selectedTherapist || ''}
              onChange={(e) => setSelectedTherapist(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Choose a therapist</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} - {t.specialization}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Select Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {slots.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Select Time</label>
              <div className="grid grid-cols-4 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setTime(slot)}
                    className={`border rounded px-3 py-2 ${
                      time === slot ? 'bg-teal-600 text-white' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4">
            <button
              onClick={handleBook}
              disabled={loading || !selectedTherapist || !date || !time}
              className="w-full bg-teal-600 text-white py-3 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Booking...' : 'Book & Pay ₹500'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingPage;

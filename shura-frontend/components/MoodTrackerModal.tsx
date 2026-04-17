
import React, { useState } from 'react';
import { CloseIcon } from './Icons';

interface MoodTrackerModalProps {
  onClose: () => void;
  onSubmit: (mood: string, notes: string) => void;
}

const moodOptions = [
  { label: 'Excellent', emoji: '😊' },
  { label: 'Good', emoji: '🙂' },
  { label: 'Okay', emoji: '😐' },
  { label: 'Sad', emoji: '😔' },
  { label: 'Anxious', emoji: '😟' },
];

const MoodTrackerModal: React.FC<MoodTrackerModalProps> = ({ onClose, onSubmit }) => {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleSubmit = () => {
    if (selectedMood) {
      onSubmit(selectedMood, notes);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mood-tracker-title"
    >
      <div
        className="bg-ivory rounded-xl shadow-2xl w-full max-w-lg p-8 relative transform transition-all duration-300 scale-95 animate-modal-enter"
        onClick={handleModalContentClick}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-taupe hover:text-brown-dark transition-colors"
          aria-label="Close mood tracker"
        >
          <CloseIcon className="h-7 w-7" />
        </button>

        <div className="text-center">
          <h2 id="mood-tracker-title" className="text-3xl font-serif font-bold text-brown-dark mb-2">How are you feeling today?</h2>
          <p className="text-brown-soft">Checking in can be a helpful first step.</p>
        </div>

        <div className="my-8 flex justify-center gap-3 sm:gap-4">
          {moodOptions.map(({ label, emoji }) => (
            <button
              key={label}
              onClick={() => setSelectedMood(label)}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg w-20 h-20 sm:w-24 sm:h-24 justify-center transition-all duration-200 border-2 ${
                selectedMood === label
                  ? 'bg-sand border-gold shadow-md transform -translate-y-1'
                  : 'bg-white border-sand hover:border-taupe/50'
              }`}
              aria-pressed={selectedMood === label}
            >
              <span className="text-3xl sm:text-4xl" role="img" aria-label={label}>{emoji}</span>
              <span className="text-xs font-semibold text-brown-soft">{label}</span>
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="mood-notes" className="block text-sm font-semibold text-brown-soft mb-2 text-center">Care to share more? (Optional)</label>
          <textarea
            id="mood-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-sand border-2 border-sand rounded-lg p-3 focus:ring-2 focus:ring-gold focus:border-gold transition text-brown-dark placeholder:text-taupe"
            placeholder="e.g., Feeling hopeful about the week ahead."
          ></textarea>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            onClick={handleSubmit}
            disabled={!selectedMood}
            className="w-full max-w-xs block text-center bg-brown-soft text-white py-3 px-6 rounded-full font-semibold hover:bg-opacity-90 transition-colors disabled:bg-taupe/50 disabled:cursor-not-allowed"
          >
            Save Mood
          </button>
          <button
            onClick={onClose}
            className="text-sm text-taupe hover:underline"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoodTrackerModal;
import React from 'react';

export interface SessionTypeSelectProps {
  value?: string;
  onChange?: (value: string) => void;
}

const sessionTypes = [
  { value: 'video', label: 'Video Session' },
  { value: 'audio', label: 'Audio Session' },
  { value: 'inperson', label: 'In-Person Session' },
];

const SessionTypeSelect: React.FC<SessionTypeSelectProps> = ({ value, onChange }) => {
  return (
    <select
      className="w-full border rounded px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-300"
      value={value || sessionTypes[0].value}
      onChange={e => onChange?.(e.target.value)}
    >
      {sessionTypes.map(type => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </select>
  );
};

export default SessionTypeSelect;

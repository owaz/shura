import React from 'react';
import { Link } from 'react-router-dom';
import type { Therapist } from '../types';

interface TherapistCardProps {
  therapist: Therapist;
  isBestMatch?: boolean;
}

const TherapistCard: React.FC<TherapistCardProps> = ({ therapist, isBestMatch }) => {
  return (
    <div className="bg-ivory rounded-xl shadow-lg overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 flex flex-col relative">
      {isBestMatch && (
        <div className="absolute top-0 right-0 bg-gold text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">
          Best Match
        </div>
      )}
      <img className="w-full h-56 object-cover" src={therapist.imageUrl} alt={therapist.name} />
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-serif font-semibold text-brown-dark">{therapist.name}</h3>
        <p className="text-brown-soft text-sm mb-1">{therapist.title}</p>
        <p className="text-taupe text-xs mb-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-taupe" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            {therapist.location}
        </p>
        <p className="text-brown-soft text-sm mb-4 flex-grow">{therapist.bioSnippet}</p>
        <div className="mb-4">
          {therapist.specialties.slice(0, 2).map((spec, index) => (
            <span key={index} className="inline-block bg-sand text-brown-soft text-xs font-medium mr-2 mb-2 px-2.5 py-1 rounded-full">
              {spec}
            </span>
          ))}
        </div>
        <Link 
          to={`/therapist/${therapist.id}`}
          state={{ isBestMatch }}
          className="mt-auto block text-center w-full bg-brown-soft text-white px-4 py-2 rounded-lg hover:bg-brown-dark transition-colors duration-300 font-semibold"
        >
          View Profile
        </Link>
      </div>
    </div>
  );
};

export default TherapistCard;
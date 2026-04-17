
import React, { useState } from 'react';
import { ChevronDownIcon } from './Icons';
import type { FaqItem } from '../types';

const FaqAccordion: React.FC<{ items: FaqItem[] }> = ({ items }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={item.id} className="border-b border-sand pb-4">
          <button
            className="w-full flex justify-between items-center text-left text-lg font-semibold text-brown-dark focus:outline-none"
            onClick={() => toggleItem(index)}
          >
            <span>{item.question}</span>
            <ChevronDownIcon
              className={`h-6 w-6 text-brown-soft transition-transform duration-300 ${openIndex === index ? 'transform rotate-180' : ''}`}
            />
          </button>
          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              openIndex === index ? 'max-h-96 mt-4' : 'max-h-0'
            }`}
          >
            <p className="text-brown-soft leading-relaxed">{item.answer}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FaqAccordion;

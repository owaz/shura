import React, { useState, useRef } from 'react';

interface HoverPopupProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const HoverPopup: React.FC<HoverPopupProps> = ({ trigger, children, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const openPopup = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const closePopup = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 200); // Delay to allow moving mouse between trigger and popup
  };

  return (
    <div 
      className="relative inline-block" 
      onMouseEnter={openPopup} 
      onMouseLeave={closePopup}
    >
      {trigger}
      {isOpen && (
        <div 
          className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 w-max max-w-xs z-[51] animate-popup-enter ${className}`}
        >
          <div className="bg-white rounded-lg shadow-xl p-2">
            {children}
          </div>
          {/* Arrow pointing down */}
          <div className="absolute left-1/2 transform -translate-x-1/2 bottom-[-8px] w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-white"></div>
        </div>
      )}
    </div>
  );
};

export default HoverPopup;
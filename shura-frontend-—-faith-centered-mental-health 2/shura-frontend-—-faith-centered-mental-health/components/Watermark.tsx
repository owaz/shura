import React from 'react';

/**
 * Watermark component with Shura logo
 * Displays as a fixed, centered background element
 */
export const Watermark: React.FC<{ opacity?: string }> = ({ opacity = 'opacity-5' }) => (
  <div className="fixed inset-0 flex items-center justify-center pointer-events-none select-none z-0">
    <img 
      src="https://res.cloudinary.com/dyqspp2ud/image/upload/e_background_removal/v1762852351/grey_shura_logo_cdrwgs.png"
      alt="Shura Logo Watermark"
      className={opacity}
      style={{width: '400px', height: '400px', objectFit: 'contain'}}
    />
  </div>
);

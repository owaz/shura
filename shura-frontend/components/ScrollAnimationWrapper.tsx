import React, { useEffect, useRef, useState, ReactNode } from 'react';

interface ScrollAnimationWrapperProps {
  children: ReactNode;
  className?: string;
  delay?: number; // Optional delay in ms
}

const ScrollAnimationWrapper: React.FC<ScrollAnimationWrapperProps> = ({ children, className, delay = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      { 
        rootMargin: '0px 0px -50px 0px',
        threshold: 0.1 
      }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  const style: React.CSSProperties = { 
    transitionDelay: `${delay}ms` 
  };

  return (
    <div 
      ref={ref} 
      className={`scroll-animate ${isVisible ? 'is-visible' : ''} ${className || ''}`}
      style={style}
    >
      {children}
    </div>
  );
};

export default ScrollAnimationWrapper;

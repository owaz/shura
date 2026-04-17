
import React, { useState, useEffect, useRef } from 'react';
import SessionTypeSelect from '../components/SessionTypeSelect';
import ReactSelect from 'react-select';
import CalendarDemo from '../components/CalendarDemo';
import Select from 'react-select';


const therapists = [
  {
    name: 'Dr. Zara Khan',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
  {
    name: 'Dr. Omar Siddiq',
    avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
  },
];


const therapistOptions = therapists.map(t => ({ value: t.name, label: t.name, avatar: t.avatar }));

const customStyles = {
  control: (provided: any) => ({
    ...provided,
    backgroundColor: '#f7f3ee',
    color: '#7c6a53',
    borderColor: '#e6d9c3',
    boxShadow: 'none',
    minHeight: '48px',
    borderRadius: '24px',
  }),
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: '#f7f3ee',
    color: '#7c6a53',
    borderRadius: '24px',
    marginTop: 2,
    overflow: 'hidden',
  }),
  menuList: (provided: any) => ({
    ...provided,
    borderRadius: '24px',
    padding: 0,
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? '#cbb893'
      : state.isFocused
      ? '#e6d9c3'
      : '#f7f3ee',
    color: '#7c6a53',
    fontWeight: state.isSelected ? 600 : 400,
    display: 'flex',
    alignItems: 'center',
    fontSize: '1rem',
    paddingLeft: 12,
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: '#7c6a53',
    display: 'flex',
    alignItems: 'center',
  }),
};

const BookSession: React.FC = () => {
  const [selectedTherapist, setSelectedTherapist] = React.useState(therapistOptions[0]);
  
  // Scroll animation
  const [visibleSections, setVisibleSections] = useState<Set<number>>(new Set());
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Small delay to ensure refs are assigned
    const timer = setTimeout(() => {
      const currentRefs = sectionRefs.current.filter(ref => ref !== null);
      if (currentRefs.length === 0) return;

      const observers = currentRefs.map((ref, index) => {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                setVisibleSections((prev) => new Set(prev).add(index));
              }
            });
          },
          { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
        );
        observer.observe(ref);
        return observer;
      });

      return () => {
        observers.forEach((observer) => observer?.disconnect());
      };
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <style>{`
        .animate-section {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .animate-section.visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
      <div className="min-h-screen bg-[#F3E9DC] flex flex-col relative">
      {/* Watermark */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none select-none z-0">
        <img 
          src="https://res.cloudinary.com/dyqspp2ud/image/upload/e_background_removal/v1762852351/grey_shura_logo_cdrwgs.png"
          alt="Shura Logo Watermark"
          className="opacity-5"
          style={{width: '400px', height: '400px', objectFit: 'contain'}}
        />
      </div>
      <main className="flex-1 p-8 relative z-10">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#5C5043] font-serif">Book a Session</h1>
        </div>
        <div className="max-w-4xl mx-auto">
          <div ref={(el) => (sectionRefs.current[0] = el)} className={`bg-white rounded-xl shadow p-8 flex flex-col items-center mb-8 animate-section ${visibleSections.has(0) ? 'visible' : ''}`}>
            <CalendarDemo />
          </div>
          <div ref={(el) => (sectionRefs.current[1] = el)} className={`bg-white rounded-xl shadow p-8 animate-section ${visibleSections.has(1) ? 'visible' : ''}`}>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Therapist</label>
                  <div className="flex items-center gap-4">
                    <div className="w-full">
                      <Select
                        options={therapistOptions}
                        value={selectedTherapist}
                        onChange={option => setSelectedTherapist(option!)}
                        styles={customStyles}
                        formatOptionLabel={(option: any) => (
                          <div className="flex items-center gap-3">
                            <img src={option.avatar} alt={option.label} className="w-8 h-8 rounded-full border-2 border-green-200" />
                            <span>{option.label}</span>
                          </div>
                        )}
                        isSearchable={false}
                      />
                    </div>
                    {/* No extra therapist image outside the select bar */}
                  </div>
                </div>
                {/* Date and Time fields removed; use calendar and slot selection above */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Session Type</label>
                  <ReactSelect
                    options={[
                      { value: 'video', label: 'Video Session' },
                      { value: 'audio', label: 'Audio Session' },
                    ]}
                    defaultValue={{ value: 'video', label: 'Video Session' }}
                    styles={customStyles}
                    isSearchable={false}
                  />
                </div>

                <button type="submit" className="bg-[#94836A] text-white px-8 py-3 rounded-full font-semibold hover:bg-[#7c6a53] transition-colors duration-200">Book Session</button>
              </form>
            </div>
        </div>
      </main>
    </div>
    </>
  );
};

export default BookSession;

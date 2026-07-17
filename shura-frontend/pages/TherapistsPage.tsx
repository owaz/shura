import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Therapist } from '../types';
import { mockTherapists } from '../data/therapists';
import TherapistCard from '../components/TherapistCard';
import { ChevronLeftIcon } from '../components/Icons';
import ScrollAnimationWrapper from '../components/ScrollAnimationWrapper';
import { apiFetch } from '../config/api';

interface ScoredTherapist extends Therapist {
  score: number;
}

type TherapyType = 'All' | 'Individual' | 'Couples' | 'Family' | 'Child';
type PriceRange = 'all' | 'low' | 'mid' | 'high';

const THERAPY_KEYWORDS: Record<Exclude<TherapyType, 'All'>, string[]> = {
  Individual: ['Anxiety', 'Depression', 'Personal Growth', 'Grief', 'Trauma', 'Self-Esteem', 'Spirituality', 'Lifestyle Changes', 'ADHD', 'Anger Management', 'Bipolar Disorder', 'Eating Disorders', 'Pregnancy/Prenatal/Postpartum', 'Cognitive Behavioural Therapy (CBT)', 'Person-Centered Therapy', 'Faith-Centered Approach'],
  Couples: ['Marital', 'Couples Therapy', 'Gottman Method', 'Imago', 'Infidelity'],
  Family: ['Family Conflict', 'Family Therapy', 'Family Systems Therapy', 'Structural Family Therapy'],
  Child: ['Child issues', 'Parenting', 'Play Therapy', 'Parent-Child Interaction Therapy (PCIT)', 'Autism', 'Behavioral Issues'],
};

const normalize = (value: string) => value.trim().toLowerCase();

const containsKeyword = (value: string, keyword: string) => {
  const normalizedValue = normalize(value);
  const normalizedKeyword = normalize(keyword);
  return normalizedValue === normalizedKeyword
    || normalizedValue.includes(normalizedKeyword)
    || normalizedKeyword.includes(normalizedValue);
};

const matchesAnyKeyword = (therapist: Therapist, keywords: string[]) => {
  const searchable = [...therapist.concerns, ...therapist.specialties];
  return searchable.some((value) => keywords.some((keyword) => containsKeyword(value, keyword)));
};

const deriveTherapyTypes = (therapist: Therapist): Exclude<TherapyType, 'All'>[] => {
  const matched = (Object.keys(THERAPY_KEYWORDS) as Exclude<TherapyType, 'All'>[])
    .filter((type) => matchesAnyKeyword(therapist, THERAPY_KEYWORDS[type]));
  return matched.length ? matched : ['Individual'];
};

const passesPriceRange = (therapist: Therapist, range: PriceRange) => {
  if (range === 'all') return true;
  const price = therapist.rates.session60 || 0;
  if (range === 'low') return price > 0 && price <= 1500;
  if (range === 'mid') return price > 1500 && price <= 3000;
  return price > 3000;
};

const splitLanguages = (therapist: Therapist) =>
  therapist.language.split(',').map((value) => value.trim()).filter(Boolean);

const TherapistsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMatching = Boolean(location.state?.concerns);

  const [therapists, setTherapists] = useState<Therapist[]>(mockTherapists);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [therapyType, setTherapyType] = useState<TherapyType>('All');
  const [specialty, setSpecialty] = useState('All');
  const [language, setLanguage] = useState('All');
  const [sessionType, setSessionType] = useState('All');
  const [priceRange, setPriceRange] = useState<PriceRange>('all');

  useEffect(() => {
    let isMounted = true;
    const loadTherapists = async () => {
      setIsLoading(true);
      try {
        const response = await apiFetch('/auth/therapists');
        if (!response.ok) return;
        const data = await response.json();
        if (isMounted && Array.isArray(data.therapists)) {
          setTherapists(data.therapists);
        }
      } catch (error) {
        console.error('Failed to load therapists:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadTherapists();
    return () => {
      isMounted = false;
    };
  }, []);

  const specialtyOptions = useMemo(() => {
    const options = new Set<string>();
    therapists.forEach((therapist) => {
      [...therapist.concerns, ...therapist.specialties].forEach((value) => options.add(value));
    });
    return ['All', ...Array.from(options).sort((a, b) => a.localeCompare(b))];
  }, [therapists]);

  const languageOptions = useMemo(() => {
    const options = new Set<string>();
    therapists.forEach((therapist) => splitLanguages(therapist).forEach((lang) => options.add(lang)));
    return ['All', ...Array.from(options).sort((a, b) => a.localeCompare(b))];
  }, [therapists]);

  const sessionTypeOptions = useMemo(() => {
    const options = new Set<string>();
    therapists.forEach((therapist) => therapist.sessionTypes.forEach((type) => options.add(type)));
    return ['All', ...Array.from(options)];
  }, [therapists]);

  const filteredTherapists = useMemo(() => {
    return therapists.filter((therapist) => {
      if (therapyType !== 'All' && !deriveTherapyTypes(therapist).includes(therapyType)) return false;

      if (specialty !== 'All') {
        const hasSpecialty = [...therapist.concerns, ...therapist.specialties]
          .some((value) => containsKeyword(value, specialty));
        if (!hasSpecialty) return false;
      }

      if (language !== 'All') {
        const hasLanguage = splitLanguages(therapist).some((value) => normalize(value) === normalize(language));
        if (!hasLanguage) return false;
      }

      if (sessionType !== 'All' && !therapist.sessionTypes.includes(sessionType as 'Video' | 'Audio' | 'Text')) {
        return false;
      }

      if (!passesPriceRange(therapist, priceRange)) return false;

      if (searchQuery.trim()) {
        const q = normalize(searchQuery);
        const searchable = [
          therapist.name,
          therapist.title,
          therapist.location,
          therapist.language,
          ...therapist.concerns,
          ...therapist.specialties,
        ].map(normalize);
        if (!searchable.some((value) => value.includes(q))) return false;
      }

      return true;
    });
  }, [language, priceRange, searchQuery, sessionType, specialty, therapists, therapyType]);

  const scoredTherapists = useMemo(() => {
    if (!isMatching) return [];
    const { concerns, gender } = location.state as { concerns: string[]; gender: string };
    return therapists.map((therapist) => {
      let score = 0;
      therapist.concerns.forEach((concern) => {
        if (concerns.includes(concern)) score += 2;
      });
      if (gender !== 'No Preference' && therapist.gender === gender) score += 5;
      return { ...therapist, score };
    }).sort((a, b) => b.score - a.score);
  }, [isMatching, location.state, therapists]);

  const activeList: (Therapist | ScoredTherapist)[] = isMatching ? scoredTherapists : filteredTherapists;

  const resetFilters = () => {
    setSearchQuery('');
    setTherapyType('All');
    setSpecialty('All');
    setLanguage('All');
    setSessionType('All');
    setPriceRange('all');
  };

  return (
    <div className="bg-cream min-h-screen">
      <section className="bg-sand py-12">
        <div className="container mx-auto px-6 max-w-5xl text-center">
          {isMatching ? (
            <>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-brown-dark mb-4">Here Are Your Recommended Therapists</h1>
              <p className="text-lg text-brown-soft">Based on your preferences, we believe these professionals would be a great fit for your journey.</p>
              <button
                onClick={() => navigate('/questionnaire')}
                className="mt-6 inline-flex items-center gap-2 text-brown-soft hover:text-brown-dark transition-colors font-semibold group"
              >
                <ChevronLeftIcon className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                <span>Change Preferences</span>
              </button>
            </>
          ) : (
            <>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-brown-dark mb-4">Find Your Therapist</h1>
              <p className="text-lg text-brown-soft">Browse all available therapists, apply filters, and choose the right fit for your healing journey.</p>
            </>
          )}
        </div>
      </section>

      {!isMatching && (
        <section className="py-8 border-b border-sand/70 bg-ivory/40">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <input
                type="text"
                placeholder="Search therapist, concern, or location"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="xl:col-span-2 bg-white border border-sand rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brown-soft/40 focus:border-brown-soft"
              />
              <select value={therapyType} onChange={(e) => setTherapyType(e.target.value as TherapyType)} className="bg-white border border-sand rounded-lg px-3 py-2 text-sm">
                <option value="All">Therapy Type: All</option>
                <option value="Individual">Individual</option>
                <option value="Couples">Couples</option>
                <option value="Family">Family</option>
                <option value="Child">Child & Teen</option>
              </select>
              <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="bg-white border border-sand rounded-lg px-3 py-2 text-sm">
                {specialtyOptions.map((option) => <option key={option} value={option}>{option === 'All' ? 'Concern/Specialty: All' : option}</option>)}
              </select>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-white border border-sand rounded-lg px-3 py-2 text-sm">
                {languageOptions.map((option) => <option key={option} value={option}>{option === 'All' ? 'Language: All' : option}</option>)}
              </select>
              <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} className="bg-white border border-sand rounded-lg px-3 py-2 text-sm">
                {sessionTypeOptions.map((option) => <option key={option} value={option}>{option === 'All' ? 'Session Type: All' : option}</option>)}
              </select>
              <select value={priceRange} onChange={(e) => setPriceRange(e.target.value as PriceRange)} className="bg-white border border-sand rounded-lg px-3 py-2 text-sm">
                <option value="all">Price: Any</option>
                <option value="low">Up to ₹1,500</option>
                <option value="mid">₹1,501 - ₹3,000</option>
                <option value="high">Above ₹3,000</option>
              </select>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-brown-soft">{filteredTherapists.length} therapist{filteredTherapists.length === 1 ? '' : 's'} found</p>
              <button onClick={resetFilters} className="text-sm font-semibold text-brown-soft hover:text-brown-dark transition-colors">Reset filters</button>
            </div>
          </div>
        </section>
      )}

      <main className="container mx-auto px-6 py-10 max-w-6xl">
        {isLoading && <p className="text-sm text-brown-soft mb-4">Loading therapists...</p>}
        {activeList.length === 0 ? (
          <div className="bg-ivory border border-sand rounded-xl p-8 text-center">
            <h2 className="text-2xl font-serif font-semibold text-brown-dark">No therapists match your filters</h2>
            <p className="text-brown-soft mt-2">Try changing your filters to see more therapists.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {activeList.map((therapist, index) => (
              <ScrollAnimationWrapper key={therapist.id} delay={100 * (index % 3)}>
                <TherapistCard
                  therapist={therapist as Therapist}
                  isBestMatch={isMatching && index === 0}
                />
              </ScrollAnimationWrapper>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default TherapistsPage;

import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from '../components/Icons';
import { Logo } from '../components/Logo';

const totalSteps = 3;

const IntakeFormPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [error, setError] = useState('');

  // Step 1: Personal & Background
  const [maritalStatus, setMaritalStatus] = useState('');
  const [hasChildren, setHasChildren] = useState('');
  const [childrenDetails, setChildrenDetails] = useState('');
  const [livingSituation, setLivingSituation] = useState('');
  const [religiousPractice, setReligiousPractice] = useState('');
  const [prayerFrequency, setPrayerFrequency] = useState('');
  const [quranEngagement, setQuranEngagement] = useState('');
  const [communityInvolvement, setCommunityInvolvement] = useState('');

  // Step 2: Mental Health & Concerns
  const [mainConcerns, setMainConcerns] = useState('');
  const [concernDuration, setConcernDuration] = useState('');
  const [concernSeverity, setConcernSeverity] = useState(5);
  const [therapyGoals, setTherapyGoals] = useState('');
  const [moodSymptoms, setMoodSymptoms] = useState<string[]>([]);
  const [anxietySymptoms, setAnxietySymptoms] = useState<string[]>([]);
  const [sleepIssues, setSleepIssues] = useState<string[]>([]);
  const [appetiteIssues, setAppetiteIssues] = useState<string[]>([]);
  const [suicidalThoughts, setSuicidalThoughts] = useState('');
  const [suicidalDetails, setSuicidalDetails] = useState('');

  // Step 3: Health, Support & Additional Info
  const [traumaHistory, setTraumaHistory] = useState<string[]>([]);
  const [traumaImpact, setTraumaImpact] = useState('');
  const [relationshipQuality, setRelationshipQuality] = useState('');
  const [relationshipDifficulties, setRelationshipDifficulties] = useState<string[]>([]);
  const [socialSupport, setSocialSupport] = useState('');
  const [physicalHealth, setPhysicalHealth] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [previousTherapy, setPreviousTherapy] = useState('');
  const [previousTherapyDetails, setPreviousTherapyDetails] = useState('');
  const [copingMechanisms, setCopingMechanisms] = useState<string[]>([]);
  const [spiritualConnection, setSpiritualConnection] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  useEffect(() => {
    // Verify token and load client info
    let isMounted = true;
    const controller = new AbortController();

    const verifyToken = async () => {
      try {
        console.log('Verifying token:', token);
        const response = await fetch(`http://localhost:5001/api/intake/verify/${token}`, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!isMounted) return;
        
        const data = await response.json();
        console.log('Token verification response:', data);
        
        if (response.ok) {
          setClientInfo(data.client);
          setLoading(false);
        } else {
          setError(data.message || 'Invalid or expired link');
          setLoading(false);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('Request was aborted');
          return;
        }
        if (!isMounted) return;
        console.error('Token verification error:', err);
        setError('Failed to verify link. Please try again.');
        setLoading(false);
      }
    };

    if (token) {
      verifyToken();
    } else {
      setError('No token provided');
      setLoading(false);
    }

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [token]);

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleArrayItem = (arr: string[], setArr: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setArr(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = {
      token,
      maritalStatus,
      hasChildren,
      childrenDetails,
      livingSituation,
      religiousPractice,
      prayerFrequency,
      quranEngagement,
      communityInvolvement,
      mainConcerns,
      concernDuration,
      concernSeverity,
      therapyGoals,
      moodSymptoms,
      anxietySymptoms,
      sleepIssues,
      appetiteIssues,
      suicidalThoughts,
      suicidalDetails,
      traumaHistory,
      traumaImpact,
      relationshipQuality,
      relationshipDifficulties,
      socialSupport,
      physicalHealth,
      medicalConditions,
      currentMedications,
      previousTherapy,
      previousTherapyDetails,
      copingMechanisms,
      spiritualConnection,
      additionalInfo
    };

    try {
      const response = await fetch('http://localhost:5001/api/intake/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        navigate('/intake-success');
      } else {
        setError(result.message || 'Failed to submit form');
      }
    } catch (err) {
      setError('Failed to submit form. Please try again.');
    }
  };

  const isNextDisabled = () => {
    if (currentStep === 1) {
      return !maritalStatus || !livingSituation || !religiousPractice || !prayerFrequency;
    }
    if (currentStep === 2) {
      return !mainConcerns || !concernDuration || !therapyGoals || !suicidalThoughts;
    }
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand">
        <div className="text-center">
          <Logo className="h-16 w-16 mx-auto mb-4 text-brown-soft" />
          <p className="text-lg text-brown-soft">Loading your intake form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand">
        <div className="text-center max-w-md">
          <Logo className="h-16 w-16 mx-auto mb-4 text-brown-soft" />
          <h2 className="text-2xl font-serif font-semibold text-brown-dark mb-4">Link Error</h2>
          <p className="text-lg text-brown-soft mb-6">{error}</p>
          <Link to="/" className="text-brown-soft underline hover:text-brown-dark">Return to Home</Link>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div key={1} className="animate-fade-in w-full space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-serif font-semibold text-brown-dark mb-4">
                Welcome, {clientInfo?.full_name || 'there'}
              </h2>
              <p className="text-lg text-brown-soft max-w-2xl mx-auto">
                Thank you for choosing Shura. This intake form helps your therapist understand you better. It takes about 10 minutes to complete.
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <label className="block text-brown-dark font-semibold mb-3">Marital Status *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['Single', 'Married', 'Divorced', 'Widowed'].map(status => (
                    <label key={status} className={`block p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-medium ${maritalStatus === status ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="radio" className="hidden" checked={maritalStatus === status} onChange={() => setMaritalStatus(status)} />
                      {status}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Do you have children?</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Yes', 'No'].map(option => (
                    <label key={option} className={`block p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-medium ${hasChildren === option ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="radio" className="hidden" checked={hasChildren === option} onChange={() => setHasChildren(option)} />
                      {option}
                    </label>
                  ))}
                </div>
                {hasChildren === 'Yes' && (
                  <input
                    type="text"
                    value={childrenDetails}
                    onChange={(e) => setChildrenDetails(e.target.value)}
                    placeholder="How many and their ages (e.g., 2 children: ages 5 and 8)"
                    className="mt-3 block w-full bg-ivory border-2 border-taupe/50 rounded-md py-3 px-4 focus:ring-gold focus:border-gold placeholder:text-taupe text-brown-dark"
                  />
                )}
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Current Living Situation *</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Living alone', 'Living with spouse', 'Living with family', 'Living with roommates'].map(situation => (
                    <label key={situation} className={`block p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-medium ${livingSituation === situation ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="radio" className="hidden" checked={livingSituation === situation} onChange={() => setLivingSituation(situation)} />
                      {situation}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Current Level of Religious Practice *</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Very practicing', 'Moderately practicing', 'Somewhat practicing', 'Not currently practicing'].map(level => (
                    <label key={level} className={`block p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-medium ${religiousPractice === level ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="radio" className="hidden" checked={religiousPractice === level} onChange={() => setReligiousPractice(level)} />
                      {level}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Five Daily Prayers (Salah) *</label>
                <div className="grid grid-cols-3 gap-3">
                  {['All five', 'Some of them', 'Not currently'].map(freq => (
                    <label key={freq} className={`block p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-medium ${prayerFrequency === freq ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="radio" className="hidden" checked={prayerFrequency === freq} onChange={() => setPrayerFrequency(freq)} />
                      {freq}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Quran Engagement</label>
                <input
                  type="text"
                  value={quranEngagement}
                  onChange={(e) => setQuranEngagement(e.target.value)}
                  placeholder="How often do you read/listen to the Quran?"
                  className="block w-full bg-ivory border-2 border-taupe/50 rounded-md py-3 px-4 focus:ring-gold focus:border-gold placeholder:text-taupe text-brown-dark"
                />
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Muslim Community Involvement</label>
                <input
                  type="text"
                  value={communityInvolvement}
                  onChange={(e) => setCommunityInvolvement(e.target.value)}
                  placeholder="Do you attend a mosque or Muslim community? Which one?"
                  className="block w-full bg-ivory border-2 border-taupe/50 rounded-md py-3 px-4 focus:ring-gold focus:border-gold placeholder:text-taupe text-brown-dark"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div key={2} className="animate-fade-in w-full space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-serif font-semibold text-brown-dark mb-4">
                Mental Health & Concerns
              </h2>
              <p className="text-lg text-brown-soft max-w-2xl mx-auto">
                Help us understand what you're experiencing and what you hope to achieve through therapy.
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <label className="block text-brown-dark font-semibold mb-3">What brings you to therapy? *</label>
                <textarea
                  value={mainConcerns}
                  onChange={(e) => setMainConcerns(e.target.value)}
                  rows={4}
                  placeholder="Please describe your main concerns in detail..."
                  className="block w-full bg-ivory border-2 border-taupe/50 rounded-md py-3 px-4 focus:ring-gold focus:border-gold placeholder:text-taupe text-brown-dark"
                />
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">When did you first start experiencing these concerns? *</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {['Within the past month', '1-6 months ago', '6-12 months ago', '1-2 years ago', 'More than 2 years ago'].map(duration => (
                    <label key={duration} className={`block p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-medium text-sm ${concernDuration === duration ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="radio" className="hidden" checked={concernDuration === duration} onChange={() => setConcernDuration(duration)} />
                      {duration}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">
                  Rate the severity of your concerns: {concernSeverity}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={concernSeverity}
                  onChange={(e) => setConcernSeverity(parseInt(e.target.value))}
                  className="w-full h-2 bg-taupe/30 rounded-lg appearance-none cursor-pointer accent-brown-soft"
                />
                <div className="flex justify-between text-sm text-brown-soft mt-2">
                  <span>1 (Mild)</span>
                  <span>10 (Severe)</span>
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">What are your therapy goals? *</label>
                <textarea
                  value={therapyGoals}
                  onChange={(e) => setTherapyGoals(e.target.value)}
                  rows={3}
                  placeholder="What do you hope to achieve?"
                  className="block w-full bg-ivory border-2 border-taupe/50 rounded-md py-3 px-4 focus:ring-gold focus:border-gold placeholder:text-taupe text-brown-dark"
                />
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Current Mood Symptoms (select all that apply)</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Persistent sadness', 'Excessive worry', 'Mood swings', 'Irritability', 'Feeling numb', 'Loss of interest'].map(symptom => (
                    <label key={symptom} className={`block p-2 border-2 rounded-lg cursor-pointer transition-colors text-center text-sm font-medium ${moodSymptoms.includes(symptom) ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="checkbox" className="hidden" checked={moodSymptoms.includes(symptom)} onChange={() => toggleArrayItem(moodSymptoms, setMoodSymptoms, symptom)} />
                      {symptom}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Anxiety Symptoms (select all that apply)</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Panic attacks', 'Social anxiety', 'Excessive worrying', 'Obsessive thoughts', 'Compulsive behaviors'].map(symptom => (
                    <label key={symptom} className={`block p-2 border-2 rounded-lg cursor-pointer transition-colors text-center text-sm font-medium ${anxietySymptoms.includes(symptom) ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="checkbox" className="hidden" checked={anxietySymptoms.includes(symptom)} onChange={() => toggleArrayItem(anxietySymptoms, setAnxietySymptoms, symptom)} />
                      {symptom}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Sleep Issues (select all that apply)</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Difficulty falling asleep', 'Waking frequently', 'Waking too early', 'Sleeping too much', 'Nightmares'].map(issue => (
                    <label key={issue} className={`block p-2 border-2 rounded-lg cursor-pointer transition-colors text-center text-sm font-medium ${sleepIssues.includes(issue) ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="checkbox" className="hidden" checked={sleepIssues.includes(issue)} onChange={() => toggleArrayItem(sleepIssues, setSleepIssues, issue)} />
                      {issue}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Thoughts of Self-Harm or Suicide *</label>
                <div className="grid grid-cols-3 gap-3">
                  {['Yes, currently', 'Yes, in the past', 'No, never'].map(option => (
                    <label key={option} className={`block p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-medium ${suicidalThoughts === option ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="radio" className="hidden" checked={suicidalThoughts === option} onChange={() => setSuicidalThoughts(option)} />
                      {option}
                    </label>
                  ))}
                </div>
                {(suicidalThoughts === 'Yes, currently' || suicidalThoughts === 'Yes, in the past') && (
                  <textarea
                    value={suicidalDetails}
                    onChange={(e) => setSuicidalDetails(e.target.value)}
                    rows={3}
                    placeholder="Please describe (your therapist will discuss this with you)"
                    className="mt-3 block w-full bg-ivory border-2 border-taupe/50 rounded-md py-3 px-4 focus:ring-gold focus:border-gold placeholder:text-taupe text-brown-dark"
                  />
                )}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div key={3} className="animate-fade-in w-full space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-serif font-semibold text-brown-dark mb-4">
                Health, Support & Background
              </h2>
              <p className="text-lg text-brown-soft max-w-2xl mx-auto">
                Final section - this helps your therapist provide comprehensive care.
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <div>
                <label className="block text-brown-dark font-semibold mb-3">Trauma History (select all that apply)</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Physical abuse', 'Emotional abuse', 'Sexual abuse', 'Domestic violence', 'Loss of loved one', 'Serious illness', 'Witnessing violence', 'Discrimination', 'None'].map(trauma => (
                    <label key={trauma} className={`block p-2 border-2 rounded-lg cursor-pointer transition-colors text-center text-sm font-medium ${traumaHistory.includes(trauma) ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="checkbox" className="hidden" checked={traumaHistory.includes(trauma)} onChange={() => toggleArrayItem(traumaHistory, setTraumaHistory, trauma)} />
                      {trauma}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Quality of Current Relationships</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Very supportive', 'Mostly supportive', 'Some supportive, some problematic', 'Mostly problematic'].map(quality => (
                    <label key={quality} className={`block p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-medium text-sm ${relationshipQuality === quality ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="radio" className="hidden" checked={relationshipQuality === quality} onChange={() => setRelationshipQuality(quality)} />
                      {quality}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Relationship Difficulties (select all that apply)</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Marital problems', 'Family conflicts', 'Friendship issues', 'Parenting challenges', 'Isolation/loneliness', 'None'].map(difficulty => (
                    <label key={difficulty} className={`block p-2 border-2 rounded-lg cursor-pointer transition-colors text-center text-sm font-medium ${relationshipDifficulties.includes(difficulty) ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="checkbox" className="hidden" checked={relationshipDifficulties.includes(difficulty)} onChange={() => toggleArrayItem(relationshipDifficulties, setRelationshipDifficulties, difficulty)} />
                      {difficulty}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Social Support System</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['Strong support', 'Moderate support', 'Limited support', 'No support'].map(support => (
                    <label key={support} className={`block p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-medium ${socialSupport === support ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="radio" className="hidden" checked={socialSupport === support} onChange={() => setSocialSupport(support)} />
                      {support}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Overall Physical Health</label>
                <div className="grid grid-cols-4 gap-3">
                  {['Excellent', 'Good', 'Fair', 'Poor'].map(health => (
                    <label key={health} className={`block p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-medium ${physicalHealth === health ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="radio" className="hidden" checked={physicalHealth === health} onChange={() => setPhysicalHealth(health)} />
                      {health}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Chronic Medical Conditions</label>
                <input
                  type="text"
                  value={medicalConditions}
                  onChange={(e) => setMedicalConditions(e.target.value)}
                  placeholder="e.g., diabetes, heart disease, thyroid issues (or 'None')"
                  className="block w-full bg-ivory border-2 border-taupe/50 rounded-md py-3 px-4 focus:ring-gold focus:border-gold placeholder:text-taupe text-brown-dark"
                />
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Current Medications</label>
                <input
                  type="text"
                  value={currentMedications}
                  onChange={(e) => setCurrentMedications(e.target.value)}
                  placeholder="Please list all current medications (or 'None')"
                  className="block w-full bg-ivory border-2 border-taupe/50 rounded-md py-3 px-4 focus:ring-gold focus:border-gold placeholder:text-taupe text-brown-dark"
                />
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Previous Therapy Experience</label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {['Yes', 'No'].map(option => (
                    <label key={option} className={`block p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-medium ${previousTherapy === option ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="radio" className="hidden" checked={previousTherapy === option} onChange={() => setPreviousTherapy(option)} />
                      {option}
                    </label>
                  ))}
                </div>
                {previousTherapy === 'Yes' && (
                  <textarea
                    value={previousTherapyDetails}
                    onChange={(e) => setPreviousTherapyDetails(e.target.value)}
                    rows={2}
                    placeholder="When? Duration? Was it helpful?"
                    className="block w-full bg-ivory border-2 border-taupe/50 rounded-md py-3 px-4 focus:ring-gold focus:border-gold placeholder:text-taupe text-brown-dark"
                  />
                )}
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Current Coping Mechanisms (select all that apply)</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Prayer (Salah)', 'Quran recitation', 'Dhikr', 'Dua', 'Talking to family/friends', 'Exercise', 'Journaling', 'Meditation'].map(coping => (
                    <label key={coping} className={`block p-2 border-2 rounded-lg cursor-pointer transition-colors text-center text-sm font-medium ${copingMechanisms.includes(coping) ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="checkbox" className="hidden" checked={copingMechanisms.includes(coping)} onChange={() => toggleArrayItem(copingMechanisms, setCopingMechanisms, coping)} />
                      {coping}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Spiritual Connection to Allah</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['Very connected', 'Somewhat connected', 'Struggling', 'Not connected'].map(connection => (
                    <label key={connection} className={`block p-3 border-2 rounded-lg cursor-pointer transition-colors text-center font-medium ${spiritualConnection === connection ? 'bg-ivory text-brown-dark border-gold' : 'bg-ivory/50 text-brown-soft border-taupe/50 hover:bg-ivory hover:border-taupe'}`}>
                      <input type="radio" className="hidden" checked={spiritualConnection === connection} onChange={() => setSpiritualConnection(connection)} />
                      {connection}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-brown-dark font-semibold mb-3">Anything Else Your Therapist Should Know?</label>
                <textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  rows={4}
                  placeholder="Strengths, hopes, cultural considerations, language preferences, etc."
                  className="block w-full bg-ivory border-2 border-taupe/50 rounded-md py-3 px-4 focus:ring-gold focus:border-gold placeholder:text-taupe text-brown-dark"
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-sand text-brown-dark font-sans antialiased">
      <header className="absolute top-0 left-0 w-full p-6 z-10">
        <Link to="/" className="flex items-center gap-2 text-3xl font-serif font-bold text-brown-dark hover:opacity-80 transition-opacity">
          <Logo className="h-8 w-8" />
          <span>Shura</span>
        </Link>
      </header>
      
      <div className="flex-grow flex items-center justify-center p-4 md:p-6 pt-24 md:pt-6">
        <div className="w-full max-w-4xl">
          {renderStep()}
        </div>
      </div>
      
      <footer className="w-full bg-ivory/80 p-4 sticky bottom-0 backdrop-blur-sm border-t border-taupe/20">
        <div className="w-full h-1 bg-taupe/30 absolute top-0 left-0">
          <div className="bg-gold h-full transition-all duration-500" style={{ width: `${(currentStep / totalSteps) * 100}%` }}></div>
        </div>
        <div className="container mx-auto flex justify-between items-center max-w-5xl">
          <div>
            <button 
              type="button" 
              onClick={handleBack} 
              className={`font-semibold transition-opacity duration-300 flex items-center gap-2 group text-brown-soft hover:text-brown-dark ${currentStep === 1 ? 'opacity-0 pointer-events-none' : 'opacity-70 hover:opacity-100'}`}
            >
              <ChevronLeftIcon className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              Previous
            </button>
          </div>
          <span className="text-sm font-semibold text-brown-soft">{currentStep} of {totalSteps}</span>
          <div>
            {currentStep < totalSteps ? (
              <button 
                type="button" 
                onClick={handleNext} 
                disabled={isNextDisabled()}
                className="bg-brown-soft text-white py-3 px-8 rounded-xl font-bold shadow-md shadow-brown-soft/20 hover:bg-opacity-95 transition-all duration-300 disabled:bg-taupe/50 disabled:cursor-not-allowed flex items-center gap-2 group transform hover:-translate-y-0.5 hover:shadow-lg"
              >
                Next
                <ChevronRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleSubmit}
                className="bg-brown-soft text-white py-3 px-8 rounded-xl font-bold shadow-md shadow-brown-soft/20 hover:bg-opacity-95 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
              >
                Submit Intake Form
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default IntakeFormPage;

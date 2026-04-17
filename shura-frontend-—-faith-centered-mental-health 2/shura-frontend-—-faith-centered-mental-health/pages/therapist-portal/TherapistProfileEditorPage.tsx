
import React, { useState } from 'react';
import type { Therapist } from '../../types';
import { mockTherapists } from '../../data/therapists';
import { CheckIcon } from '../../components/Icons';

const TherapistProfileEditorPage: React.FC = () => {
    // Pre-populate form with data for the first mock therapist
    const [formData, setFormData] = useState<Therapist>(mockTherapists[0]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleArrayChange = (e: React.ChangeEvent<HTMLTextAreaElement>, field: 'specialties' | 'concerns') => {
        const { value } = e.target;
        setFormData(prev => ({ ...prev, [field]: value.split(',').map(item => item.trim()) }));
    };

    const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>, duration: 'session60' | 'session90') => {
        const { value } = e.target;
        setFormData(prev => ({
            ...prev,
            rates: {
                ...prev.rates,
                [duration]: value ? parseInt(value, 10) : undefined,
            }
        }));
    };

    const handleSessionTypeToggle = (type: 'Video' | 'Audio' | 'Text') => {
        setFormData(prev => ({
          ...prev,
          sessionTypes: prev.sessionTypes.includes(type)
            ? prev.sessionTypes.filter(t => t !== type)
            : [...prev.sessionTypes, type]
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Saving profile data:", formData);
        alert('Profile updated successfully!');
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div>
                <h1 className="text-3xl font-serif font-bold text-brown-dark">Edit Your Profile</h1>
                <p className="text-brown-soft mt-1">This information will be visible to clients on your public profile page.</p>
            </div>

            {/* Personal Details Section */}
            <div className="bg-ivory p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-serif font-semibold text-brown-dark border-b border-sand pb-3 mb-4">Personal Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Profile Picture */}
                    <div className="md:col-span-2 flex items-center gap-6">
                        <img src={formData.imageUrl} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-sand" />
                        <div>
                            <p className="font-semibold text-brown-dark">Profile Picture</p>
                            <button type="button" className="text-sm mt-1 bg-white border border-taupe/50 text-brown-soft px-3 py-1 rounded-md hover:bg-sand transition-colors">
                                Upload New Image
                            </button>
                        </div>
                    </div>
                    {/* Full Name */}
                    <div className="md:col-span-2">
                        <label htmlFor="name" className="block text-sm font-medium text-brown-soft">Full Name</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" />
                    </div>
                    {/* Title */}
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-brown-soft">Professional Title</label>
                        <input type="text" id="title" name="title" value={formData.title} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" />
                    </div>
                    {/* Years of Experience */}
                    <div>
                        <label htmlFor="experience" className="block text-sm font-medium text-brown-soft">Years of Experience</label>
                        <input type="number" id="experience" name="experience" value={formData.experience} onChange={handleChange} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" />
                    </div>
                    {/* Full Bio */}
                    <div className="md:col-span-2">
                        <label htmlFor="fullBio" className="block text-sm font-medium text-brown-soft">Full Bio</label>
                        <textarea id="fullBio" name="fullBio" value={formData.fullBio} onChange={handleChange} rows={6} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" placeholder="Share your story, approach, and what clients can expect..."></textarea>
                    </div>
                </div>
            </div>

            {/* Expertise Section */}
            <div className="bg-ivory p-6 rounded-xl shadow-sm">
                 <h2 className="text-xl font-serif font-semibold text-brown-dark border-b border-sand pb-3 mb-4">Areas of Expertise</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="specialties" className="block text-sm font-medium text-brown-soft">Specialties / Therapeutic Approaches</label>
                        <textarea id="specialties" value={formData.specialties.join(', ')} onChange={(e) => handleArrayChange(e, 'specialties')} rows={3} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" placeholder="e.g., CBT, Couples Therapy, etc. (comma-separated)"></textarea>
                    </div>
                    <div>
                        <label htmlFor="concerns" className="block text-sm font-medium text-brown-soft">Concerns Addressed</label>
                        <textarea id="concerns" value={formData.concerns.join(', ')} onChange={(e) => handleArrayChange(e, 'concerns')} rows={3} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" placeholder="e.g., Anxiety, Depression, Marital, etc. (comma-separated)"></textarea>
                    </div>
                 </div>
            </div>

            {/* Practice Details Section */}
            <div className="bg-ivory p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-serif font-semibold text-brown-dark border-b border-sand pb-3 mb-4">Practice Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-brown-soft mb-2">Session Types</label>
                        <div className="flex flex-wrap gap-4">
                            {(['Video', 'Audio', 'Text'] as const).map(type => (
                                <label key={type} className={`flex items-center gap-3 cursor-pointer p-3 border-2 rounded-lg transition-colors bg-white ${
                                    formData.sessionTypes.includes(type) ? 'border-brown-dark' : 'border-sand hover:border-taupe/50'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={formData.sessionTypes.includes(type)}
                                        onChange={() => handleSessionTypeToggle(type)}
                                        className="sr-only"
                                    />
                                    <div className={`w-6 h-6 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                                        formData.sessionTypes.includes(type) ? 'bg-brown-dark border-brown-dark' : 'bg-white border-taupe'
                                    }`}>
                                        {formData.sessionTypes.includes(type) && <CheckIcon className="w-4 h-4 text-white" />}
                                    </div>
                                    <span className="font-medium text-brown-dark select-none">{type}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label htmlFor="session60" className="block text-sm font-medium text-brown-soft">Rate (60 min)</label>
                             <input type="number" id="session60" value={formData.rates.session60 || ''} onChange={(e) => handleRateChange(e, 'session60')} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" placeholder="e.g., 2000" />
                        </div>
                        <div>
                             <label htmlFor="session90" className="block text-sm font-medium text-brown-soft">Rate (90 min)</label>
                             <input type="number" id="session90" value={formData.rates.session90 || ''} onChange={(e) => handleRateChange(e, 'session90')} className="mt-1 block w-full bg-white border-sand rounded-md shadow-sm py-2 px-3 focus:ring-brown-soft focus:border-brown-soft" placeholder="e.g., 3000"/>
                        </div>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button type="submit" className="bg-brown-soft text-white py-3 px-8 rounded-lg font-semibold hover:bg-opacity-90 transition-colors shadow-md">
                    Save Changes
                </button>
            </div>
        </form>
    );
};

export default TherapistProfileEditorPage;
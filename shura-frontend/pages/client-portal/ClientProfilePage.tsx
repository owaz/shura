import React, { useEffect, useMemo, useState } from 'react';
import { clientPortalApi, PortalApiError } from './clientPortalApi';
import type { ClientOptions, ClientProfile } from './clientPortalTypes';
import { ErrorState, Field, PageSkeleton, PortalCard, Toast, inputClass } from './PortalUi';
import { countryOptions, defaultPhoneCodes, timezoneOptions } from './portalOptions';
import { useAuth } from '../../contexts/AuthContext';

type SectionName = 'personal' | 'contact' | 'about' | 'emergency';

const fallbackOptions: ClientOptions = { languages: [], specialisations: [], phoneCountryCodes: defaultPhoneCodes };
const display = (value?: string) => value || 'Not provided';
const formatChoice = (value?: string) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not provided';
const splitPhone = (phone: string, codes = defaultPhoneCodes) => {
  const match = [...codes].sort((a, b) => b.code.length - a.code.length).find(({ code }) => phone.startsWith(code));
  return { code: match?.code || '+971', number: match ? phone.slice(match.code.length) : phone.replace(/^\+/, '') };
};

const Definition: React.FC<{ label: string; value?: string }> = ({ label, value }) => <div><dt className="text-xs font-semibold uppercase tracking-[0.11em] text-brown-soft">{label}</dt><dd className="mt-1.5 text-[15px] text-brown-dark">{display(value)}</dd></div>;

const ProfilePhotoEditor: React.FC<{ currentUrl: string; onUploaded: (url: string) => void; onError: (message: string) => void }> = ({ currentUrl, onUploaded, onError }) => {
  const [source, setSource] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1);
  const [uploading, setUploading] = useState(false);

  useEffect(() => () => { if (source) URL.revokeObjectURL(source); }, [source]);

  const chooseFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0];
    event.target.value = '';
    if (!next) return;
    if (!['image/jpeg', 'image/png'].includes(next.type) || next.size > 5 * 1024 * 1024) {
      onError('Choose a JPG or PNG image up to 5 MB.');
      return;
    }
    if (source) URL.revokeObjectURL(source);
    setFile(next);
    setSource(URL.createObjectURL(next));
    setZoom(1);
  };

  const cropAndUpload = async () => {
    if (!file || !source) return;
    setUploading(true);
    try {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Photo cropping is not supported in this browser.');
      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
      const sourceX = (image.naturalWidth - sourceSize) / 2;
      const sourceY = (image.naturalHeight - sourceSize) / 2;
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 512, 512);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not prepare the photo.')), 'image/jpeg', 0.9));
      const result = await clientPortalApi.uploadProfilePhoto(blob);
      onUploaded(result.profilePicture);
      URL.revokeObjectURL(source);
      setSource('');
      setFile(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Your photo could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-[#F1E5D9] bg-sand">
        {currentUrl ? <img src={currentUrl} alt="Your profile" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl font-bold text-brown-soft" aria-label="No profile photo">?</div>}
      </div>
      <div><label className="inline-flex cursor-pointer rounded-full border border-[#BDAA99] bg-white px-4 py-2.5 text-sm font-semibold text-brown-dark hover:bg-sand focus-within:ring-2 focus-within:ring-[#8C4F3A]"><input type="file" accept="image/jpeg,image/png" onChange={chooseFile} className="sr-only" />Choose photo</label><p className="mt-2 text-xs text-brown-soft">JPG or PNG, up to 5 MB</p></div>

      {source && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-brown-dark/45 p-4" role="dialog" aria-modal="true" aria-labelledby="crop-title">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h3 id="crop-title" className="font-serif text-2xl">Crop your photo</h3>
          <p className="mt-2 text-sm text-brown-soft">Position your face in the circular preview and adjust the zoom.</p>
          <div className="mx-auto mt-6 h-64 w-64 overflow-hidden rounded-full border-4 border-sand bg-[#EEE6DD]"><img src={source} alt="Profile photo crop preview" className="h-full w-full object-cover" style={{ transform: `scale(${zoom})` }} /></div>
          <label htmlFor="photoZoom" className="mt-6 block text-sm font-semibold">Zoom</label><input id="photoZoom" type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="mt-2 w-full accent-[#8C4F3A]" />
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => { URL.revokeObjectURL(source); setSource(''); setFile(null); }} className="rounded-full px-4 py-2.5 font-semibold text-brown-soft hover:bg-sand">Cancel</button><button type="button" disabled={uploading} onClick={() => void cropAndUpload()} className="rounded-full bg-[#8C4F3A] px-5 py-2.5 font-semibold text-white disabled:opacity-60">{uploading ? 'Uploading…' : 'Use this photo'}</button></div>
        </div>
      </div>}
    </div>
  );
};

const ClientProfilePage: React.FC = () => {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [draft, setDraft] = useState<ClientProfile | null>(null);
  const [options, setOptions] = useState<ClientOptions>(fallbackOptions);
  const [editing, setEditing] = useState<SectionName | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');

  const load = async () => {
    setLoading(true); setLoadError('');
    try {
      const [result, settings] = await Promise.all([clientPortalApi.getProfile(), clientPortalApi.getSettings()]);
      setProfile(result.profile); setDraft(result.profile); setOptions(settings.options);
    } catch (err) { setLoadError(err instanceof Error ? err.message : 'Your profile could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const startEdit = (section: SectionName) => { setDraft(profile); setErrors({}); setEditing(section); };
  const cancelEdit = () => { setDraft(profile); setErrors({}); setEditing(null); };
  const fieldsForSection: Record<SectionName, Array<keyof ClientProfile>> = {
    personal: ['firstName', 'lastName', 'dateOfBirth', 'gender', 'phone'],
    contact: ['country', 'city', 'timezone'],
    about: ['aboutMe'],
    emergency: ['emergencyContactName', 'emergencyContactRelationship', 'emergencyContactPhone'],
  };
  const saveSection = async (section: SectionName) => {
    if (!draft) return;
    setSaving(true); setErrors({});
    try {
      const patch = Object.fromEntries(fieldsForSection[section].map((key) => [key, draft[key] || null]));
      const result = await clientPortalApi.updateProfile(patch);
      setProfile(result.profile); setDraft(result.profile); setEditing(null);
      setToast({ kind: 'success', message: 'Your profile has been updated.' });
    } catch (err) {
      if (err instanceof PortalApiError && err.details) setErrors(err.details);
      setToast({ kind: 'error', message: err instanceof Error ? err.message : 'Your changes could not be saved.' });
    } finally { setSaving(false); }
  };

  const personalPhone = useMemo(() => splitPhone(draft?.phone || '', options.phoneCountryCodes), [draft?.phone, options.phoneCountryCodes]);
  const emergencyPhone = useMemo(() => splitPhone(draft?.emergencyContactPhone || '', options.phoneCountryCodes), [draft?.emergencyContactPhone, options.phoneCountryCodes]);
  const setPhone = (key: 'phone' | 'emergencyContactPhone', code: string, value: string) => {
    if (!draft) return;
    const digits = value.replace(/\D/g, '');
    setDraft({ ...draft, [key]: digits ? `${code}${digits}` : '' });
  };

  const resetPassword = async () => {
    try {
      const { url } = await clientPortalApi.createPasswordResetTicket();
      window.location.assign(url);
    } catch (err) { setToast({ kind: 'error', message: err instanceof Error ? err.message : 'Password reset is unavailable.' }); }
  };
  const deleteAccount = async () => {
    setSaving(true);
    try {
      await clientPortalApi.deleteAccount();
      await logout();
    } catch (err) { setToast({ kind: 'error', message: err instanceof Error ? err.message : 'Your account could not be deleted.' }); setSaving(false); }
  };

  if (loading) return <PageSkeleton />;
  if (loadError || !profile || !draft) return <ErrorState message={loadError} onRetry={() => void load()} />;

  const SectionHeader = ({ title, section }: { title: string; section: SectionName }) => <div className="mb-6 flex items-center justify-between gap-4"><h2 className="font-serif text-2xl text-brown-dark">{title}</h2>{editing === section ? <div className="flex gap-2"><button type="button" onClick={cancelEdit} className="rounded-full px-4 py-2 text-sm font-semibold text-brown-soft hover:bg-sand">Cancel</button><button type="button" disabled={saving} onClick={() => void saveSection(section)} className="rounded-full bg-[#70866A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button></div> : <button type="button" disabled={Boolean(editing)} onClick={() => startEdit(section)} className="rounded-full border border-[#CDB9A8] px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-sand disabled:opacity-40">Edit</button>}</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8C624E]">Your account</p><h1 className="mt-2 font-serif text-3xl md:text-4xl">My Profile</h1><p className="mt-2 text-brown-soft">Keep the information your therapist and Shura use to support you up to date.</p></div>

      <PortalCard><SectionHeader title="Personal Information" section="personal" /><ProfilePhotoEditor currentUrl={profile.profilePicture} onUploaded={(url) => { const next = { ...profile, profilePicture: url }; setProfile(next); setDraft(next); setToast({ kind: 'success', message: 'Your profile photo has been updated.' }); }} onError={(message) => setToast({ kind: 'error', message })} />
        {editing === 'personal' ? <div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label="First name" htmlFor="profileFirstName" required error={errors.firstName}><input id="profileFirstName" value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} className={inputClass} /></Field><Field label="Last name" htmlFor="profileLastName" required error={errors.lastName}><input id="profileLastName" value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} className={inputClass} /></Field><Field label="Date of birth" htmlFor="profileDob" required error={errors.dateOfBirth}><input id="profileDob" type="date" max={new Date().toISOString().slice(0, 10)} value={draft.dateOfBirth} onChange={(event) => setDraft({ ...draft, dateOfBirth: event.target.value })} className={inputClass} /></Field><Field label="Gender" htmlFor="profileGender" error={errors.gender}><select id="profileGender" value={draft.gender} onChange={(event) => setDraft({ ...draft, gender: event.target.value })} className={inputClass}><option value="male">Male</option><option value="female">Female</option><option value="prefer_not_to_say">Prefer not to say</option></select></Field><Field label="Phone number" htmlFor="profilePhone" error={errors.phone}><div className="mt-2 flex gap-2"><select aria-label="Phone country code" value={personalPhone.code} onChange={(event) => setPhone('phone', event.target.value, personalPhone.number)} className={`${inputClass} mt-0 w-36`}>{options.phoneCountryCodes.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</select><input id="profilePhone" type="tel" value={personalPhone.number} onChange={(event) => setPhone('phone', personalPhone.code, event.target.value)} className={`${inputClass} mt-0`} /></div></Field></div> : <dl className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"><Definition label="First name" value={profile.firstName} /><Definition label="Last name" value={profile.lastName} /><Definition label="Date of birth" value={profile.dateOfBirth} /><Definition label="Gender" value={formatChoice(profile.gender)} /><Definition label="Phone" value={profile.phone} /></dl>}
      </PortalCard>

      <PortalCard><SectionHeader title="Contact & Location" section="contact" />
        <div className="mb-6 rounded-xl bg-[#F8F3EE] p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-brown-soft">Email address</p><p className="mt-1 text-brown-dark">{profile.email}</p><p className="mt-1 text-xs text-brown-soft">To change your email, contact support.</p></div>
        {editing === 'contact' ? <div className="grid gap-5 sm:grid-cols-2"><Field label="Country" htmlFor="country" error={errors.country}><input id="country" list="countries" value={draft.country} onChange={(event) => setDraft({ ...draft, country: event.target.value })} className={inputClass} /><datalist id="countries">{countryOptions.map((country) => <option key={country} value={country} />)}</datalist></Field><Field label="City / State" htmlFor="city" error={errors.city}><input id="city" value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} className={inputClass} /></Field><Field label="Timezone" htmlFor="profileTimezone" required error={errors.timezone}><input id="profileTimezone" list="profile-timezones" value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} className={inputClass} /><datalist id="profile-timezones">{timezoneOptions.map((timezone) => <option key={timezone} value={timezone} />)}</datalist></Field></div> : <dl className="grid gap-6 sm:grid-cols-3"><Definition label="Country" value={profile.country} /><Definition label="City / State" value={profile.city} /><Definition label="Timezone" value={profile.timezone} /></dl>}
      </PortalCard>

      <PortalCard><SectionHeader title="About You" section="about" /><p className="mb-5 text-sm text-brown-soft">Shared with your therapist only — not publicly visible.</p>{editing === 'about' ? <Field label="Anything that may help your therapist understand you" htmlFor="aboutMe" error={errors.aboutMe}><textarea id="aboutMe" rows={5} maxLength={500} value={draft.aboutMe} onChange={(event) => setDraft({ ...draft, aboutMe: event.target.value })} className={inputClass} /><p className="mt-1 text-right text-xs text-brown-soft">{draft.aboutMe.length}/500</p></Field> : <p className="whitespace-pre-wrap leading-7 text-brown-dark">{display(profile.aboutMe)}</p>}</PortalCard>

      <PortalCard><SectionHeader title="Emergency Contact" section="emergency" />{editing === 'emergency' ? <div className="grid gap-5 sm:grid-cols-2"><Field label="Contact name" htmlFor="emergencyName" error={errors.emergencyContactName}><input id="emergencyName" value={draft.emergencyContactName} onChange={(event) => setDraft({ ...draft, emergencyContactName: event.target.value })} className={inputClass} /></Field><Field label="Relationship" htmlFor="emergencyRelationship" error={errors.emergencyContactRelationship}><select id="emergencyRelationship" value={draft.emergencyContactRelationship} onChange={(event) => setDraft({ ...draft, emergencyContactRelationship: event.target.value })} className={inputClass}><option value="">Select</option><option value="spouse">Spouse</option><option value="parent">Parent</option><option value="sibling">Sibling</option><option value="friend">Friend</option><option value="other">Other</option></select></Field><Field label="Phone number" htmlFor="emergencyPhone" error={errors.emergencyContactPhone}><div className="mt-2 flex gap-2"><select aria-label="Emergency contact country code" value={emergencyPhone.code} onChange={(event) => setPhone('emergencyContactPhone', event.target.value, emergencyPhone.number)} className={`${inputClass} mt-0 w-36`}>{options.phoneCountryCodes.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</select><input id="emergencyPhone" type="tel" value={emergencyPhone.number} onChange={(event) => setPhone('emergencyContactPhone', emergencyPhone.code, event.target.value)} className={`${inputClass} mt-0`} /></div></Field></div> : <dl className="grid gap-6 sm:grid-cols-3"><Definition label="Name" value={profile.emergencyContactName} /><Definition label="Relationship" value={formatChoice(profile.emergencyContactRelationship)} /><Definition label="Phone" value={profile.emergencyContactPhone} /></dl>}</PortalCard>

      <PortalCard><h2 className="font-serif text-2xl">Account</h2><div className="mt-5 flex items-center justify-between gap-4 border-b border-sand pb-5"><div><p className="font-semibold">Password</p><p className="mt-1 text-sm text-brown-soft">Managed securely through Auth0.</p></div><button type="button" onClick={() => void resetPassword()} className="rounded-full border border-[#CDB9A8] px-4 py-2 text-sm font-semibold hover:bg-sand">Change Password</button></div><div className="mt-5 rounded-xl border border-[#E5B9B0] bg-[#FFF6F3] p-5"><h3 className="font-semibold text-[#8E392F]">Delete Account</h3><p className="mt-2 text-sm leading-6 text-[#7A4B45]">Permanently deletes your Shura profile, preferences, session records, messages, and Auth0 identity. This cannot be undone.</p><button type="button" onClick={() => setDeleteOpen(true)} className="mt-4 text-sm font-semibold text-[#A54236] underline underline-offset-4">Delete my account</button></div></PortalCard>

      {deleteOpen && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-brown-dark/45 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 id="delete-title" className="font-serif text-2xl text-[#8E392F]">Permanently delete account?</h2><p className="mt-3 text-sm leading-6 text-brown-soft">All client data associated with this account will be permanently removed. Type <strong>DELETE</strong> to confirm.</p><label htmlFor="deleteConfirmation" className="mt-5 block text-sm font-semibold">Confirmation</label><input id="deleteConfirmation" value={deleteText} onChange={(event) => setDeleteText(event.target.value)} className={inputClass} autoComplete="off" /><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => { setDeleteOpen(false); setDeleteText(''); }} className="rounded-full px-4 py-2.5 font-semibold text-brown-soft hover:bg-sand">Keep my account</button><button type="button" disabled={deleteText !== 'DELETE' || saving} onClick={() => void deleteAccount()} className="rounded-full bg-[#A54236] px-4 py-2.5 font-semibold text-white disabled:opacity-40">{saving ? 'Deleting…' : 'Delete permanently'}</button></div></div></div>}
      {toast && <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ClientProfilePage;

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const uniqueStrings = (values) => [...new Set(toArray(values).map((value) => String(value).trim()).filter(Boolean))];

const normalizeSessionTypes = (values) => [...new Set(
  uniqueStrings(values)
    .map((value) => value.toLowerCase())
    .filter((value) => ['video', 'audio', 'text'].includes(value))
)];

const normalizeDurations = (values) => [...new Set(
  (Array.isArray(values) ? values : [])
    .map(Number)
    .filter((value) => [30, 50, 80].includes(value))
)].sort((a, b) => a - b);

const timeValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, 5);
};

const toAvailability = (rows = []) => rows.map((row) => ({
  dayOfWeek: Number(row.day_of_week),
  startTime: timeValue(row.start_time),
  endTime: timeValue(row.end_time),
  timezone: row.timezone || 'UTC',
}));

const toAssignedTherapist = ({ therapist, availability = [], imageUrl = '' }) => {
  if (!therapist) return null;
  const specialisations = uniqueStrings(therapist.specialties);
  if (!specialisations.length && therapist.specialization) {
    specialisations.push(String(therapist.specialization).trim());
  }
  const credentials = uniqueStrings(therapist.credentials);
  const durations = normalizeDurations(therapist.session_duration_options);

  return {
    id: therapist.id,
    name: therapist.full_name,
    professionalTitle: therapist.specialization || 'Licensed Therapist',
    credentials,
    verified: Boolean(therapist.is_verified),
    imageUrl,
    rating: Number(Number(therapist.average_rating || 0).toFixed(1)),
    reviewCount: Number(therapist.review_count || 0),
    bio: therapist.bio || '',
    specialisations,
    approach: therapist.approach || '',
    faithIntegration: therapist.faith_integration || '',
    languages: uniqueStrings(therapist.languages),
    sessionTypes: normalizeSessionTypes(therapist.session_types),
    durationOptions: durations.length ? durations : [50],
    availability: toAvailability(availability),
    assignedAt: therapist.assigned_at || null,
  };
};

module.exports = {
  normalizeDurations,
  normalizeSessionTypes,
  toAssignedTherapist,
  toArray,
  toAvailability,
  uniqueStrings,
};

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING } from '../theme/theme';
import { userApi } from '../utils/api';
import { getCurrentCoords, describePlace } from '../utils/location';
import {
  FITNESS_LEVELS,
  FITNESS_LEVEL_LABELS,
  FITNESS_GOALS,
  FITNESS_GOAL_LABELS,
  WORKOUT_TYPES,
  WORKOUT_TYPE_LABELS,
  DAYS_OF_WEEK,
  DAY_LABELS,
  TIME_SLOTS,
  DURATIONS,
  BUDDY_DISTANCES,
  GYM_CHANGE_COOLDOWN_DAYS,
} from '../constants/fitnessConstants';

const DAY_MS = 24 * 60 * 60 * 1000;

// Fields PUT /users/profile accepts. Everything else on the profile (xp, level, _id...) is
// server-managed and must not be sent back, or validation rejects the request.
const PROFILE_FIELDS = [
  'bio',
  'fitnessLevel',
  'commitmentType',
  'fitnessGoals',
  'workoutTypes',
  'preferredWorkoutDays',
  'preferredWorkoutTime',
  'workoutDuration',
  'gymLocation',
  'gymName',
  'gymAddress',
  'height',
  'weight',
  'dietType',
  'sleepPattern',
  'injuries',
  'equipment',
  'experienceYears',
  'buddyPreferences',
];

const prettify = (value) =>
  String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Options shown = the app's list plus anything already on the profile (so values set
// elsewhere, e.g. by an older app version, aren't silently dropped on save).
const withCurrent = (options, current = []) => [...new Set([...options, ...current])];

const slotKeyFor = (time) =>
  TIME_SLOTS.find((t) => t.start === time?.start && t.end === time?.end)?.key || 'custom';

/**
 * Builds the full PUT /users/profile body: the stored profile (whitelisted) with edits applied.
 * The endpoint applies defaults for omitted fields, so everything stored must be sent back.
 */
const buildPayload = (profile, edits) => {
  const payload = {};
  PROFILE_FIELDS.forEach((key) => {
    if (profile[key] !== undefined && profile[key] !== null) payload[key] = profile[key];
  });
  if (profile.height === null) payload.height = null;
  if (profile.weight === null) payload.weight = null;

  Object.assign(payload, edits);

  payload.gymLocation = { coordinates: edits.gymLocation?.coordinates || profile.gymLocation?.coordinates };
  if (payload.preferredWorkoutTime) {
    payload.preferredWorkoutTime = {
      start: payload.preferredWorkoutTime.start,
      end: payload.preferredWorkoutTime.end,
    };
  }
  if (payload.buddyPreferences) {
    const { genderPreference, levelRange, maxDistance, ageRange } = payload.buddyPreferences;
    payload.buddyPreferences = {
      ...(genderPreference && { genderPreference }),
      ...(levelRange && { levelRange }),
      ...(maxDistance && { maxDistance }),
      ...(ageRange && { ageRange: { min: ageRange.min, max: ageRange.max } }),
    };
  }
  return payload;
};

function Chip({ label, sublabel, selected, onPress, style }) {
  return (
    <TouchableOpacity style={[styles.chip, selected && styles.chipSelected, style]} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
      {sublabel ? <Text style={styles.chipSub}>{sublabel}</Text> : null}
    </TouchableOpacity>
  );
}

export default function EditProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [savedMsg, setSavedMsg] = useState(null);

  const [bio, setBio] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState(FITNESS_LEVELS.BEGINNER);
  const [fitnessGoals, setFitnessGoals] = useState([]);
  const [workoutTypes, setWorkoutTypes] = useState([]);
  const [days, setDays] = useState([]);
  const [slotKey, setSlotKey] = useState('morning');
  const [duration, setDuration] = useState(60);
  const [maxDistance, setMaxDistance] = useState(10);
  const [gymName, setGymName] = useState('');
  const [gymAddress, setGymAddress] = useState('');
  const [newGymCoords, setNewGymCoords] = useState(null); // set only when the user moves the gym
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await userApi.getMe();
      setLoading(false);
      const p = res.success ? res.data?.profile : null;
      if (!p) {
        setErrorMsg(res.message || 'Could not load your profile.');
        return;
      }
      setProfile(p);
      setBio(p.bio || '');
      setFitnessLevel(p.fitnessLevel || FITNESS_LEVELS.BEGINNER);
      setFitnessGoals(p.fitnessGoals || []);
      setWorkoutTypes(p.workoutTypes || []);
      setDays(p.preferredWorkoutDays || []);
      setSlotKey(slotKeyFor(p.preferredWorkoutTime));
      setDuration(p.workoutDuration || 60);
      setMaxDistance(p.buddyPreferences?.maxDistance || 10);
      setGymName(p.gymName || '');
      setGymAddress(p.gymAddress || '');
    })();
  }, []);

  const toggle = (list, setList, item) =>
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);

  const lastGymChange = profile?.gymLocationUpdatedAt ? new Date(profile.gymLocationUpdatedAt) : null;
  const nextGymChange = lastGymChange ? new Date(lastGymChange.getTime() + GYM_CHANGE_COOLDOWN_DAYS * DAY_MS) : null;
  const gymLocked = Boolean(nextGymChange && nextGymChange > new Date());

  const handleMoveGym = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const position = await getCurrentCoords();
      setNewGymCoords(position);
      const address = await describePlace(position.coordinates);
      if (address) setGymAddress(address);
    } catch (err) {
      setLocationError(err.message || 'Couldn’t get your location.');
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    setErrorMsg(null);
    setSavedMsg(null);
    if (fitnessGoals.length === 0) return setErrorMsg('Pick at least one fitness goal.');
    if (workoutTypes.length === 0) return setErrorMsg('Pick at least one training style.');
    if (days.length === 0) return setErrorMsg('Pick at least one workout day.');
    if (!gymName.trim()) return setErrorMsg('Enter your gym name.');

    const slot = TIME_SLOTS.find((t) => t.key === slotKey);
    const edits = {
      bio: bio.trim(),
      fitnessLevel,
      fitnessGoals,
      workoutTypes,
      preferredWorkoutDays: days,
      // 'custom' keeps whatever non-standard time the profile already had
      preferredWorkoutTime: slot ? { start: slot.start, end: slot.end } : profile.preferredWorkoutTime,
      workoutDuration: duration,
      gymName: gymName.trim(),
      gymAddress: gymAddress.trim(),
      buddyPreferences: { ...(profile.buddyPreferences || {}), maxDistance },
      ...(newGymCoords && { gymLocation: { coordinates: newGymCoords.coordinates } }),
    };

    setSaving(true);
    const res = await userApi.updateProfile(buildPayload(profile, edits));
    setSaving(false);

    if (res.success) {
      setProfile(res.data.profile);
      setNewGymCoords(null);
      setSavedMsg('Profile saved.');
      setTimeout(() => navigation.goBack(), 700);
    } else {
      setErrorMsg(res.message || 'Could not save your profile.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: SPACING.md }}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentTime = profile.preferredWorkoutTime;
  const goalOptions = withCurrent(Object.values(FITNESS_GOALS), profile.fitnessGoals);
  const typeOptions = withCurrent(Object.values(WORKOUT_TYPES), profile.workoutTypes);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <Text style={styles.subtitle}>Changes update your buddy matches straight away.</Text>

        <Text style={styles.label}>BIO</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={bio}
          onChangeText={setBio}
          maxLength={300}
          multiline
          placeholder="What are you training for?"
          placeholderTextColor={COLORS.textMuted}
        />

        <Text style={styles.label}>FITNESS LEVEL</Text>
        <View style={styles.wrap}>
          {Object.values(FITNESS_LEVELS).map((lvl) => (
            <Chip
              key={lvl}
              label={FITNESS_LEVEL_LABELS[lvl]}
              selected={fitnessLevel === lvl}
              onPress={() => setFitnessLevel(lvl)}
            />
          ))}
        </View>

        <Text style={styles.label}>GOALS</Text>
        <View style={styles.wrap}>
          {goalOptions.map((g) => (
            <Chip
              key={g}
              label={FITNESS_GOAL_LABELS[g] || prettify(g)}
              selected={fitnessGoals.includes(g)}
              onPress={() => toggle(fitnessGoals, setFitnessGoals, g)}
            />
          ))}
        </View>

        <Text style={styles.label}>TRAINING STYLES</Text>
        <View style={styles.wrap}>
          {typeOptions.map((t) => (
            <Chip
              key={t}
              label={WORKOUT_TYPE_LABELS[t] || prettify(t)}
              selected={workoutTypes.includes(t)}
              onPress={() => toggle(workoutTypes, setWorkoutTypes, t)}
            />
          ))}
        </View>

        <Text style={styles.label}>WORKOUT DAYS</Text>
        <View style={styles.wrap}>
          {DAYS_OF_WEEK.map((d) => (
            <Chip
              key={d}
              label={DAY_LABELS[d].slice(0, 3)}
              selected={days.includes(d)}
              onPress={() => toggle(days, setDays, d)}
            />
          ))}
        </View>

        <Text style={styles.label}>TIME OF DAY</Text>
        <View style={styles.wrap}>
          {TIME_SLOTS.map((t) => (
            <Chip
              key={t.key}
              label={t.label}
              sublabel={`${t.start}–${t.end}`}
              selected={slotKey === t.key}
              onPress={() => setSlotKey(t.key)}
              style={styles.halfChip}
            />
          ))}
          {slotKeyFor(currentTime) === 'custom' && currentTime?.start && (
            <Chip
              label="Keep current"
              sublabel={`${currentTime.start}–${currentTime.end}`}
              selected={slotKey === 'custom'}
              onPress={() => setSlotKey('custom')}
              style={styles.halfChip}
            />
          )}
        </View>

        <Text style={styles.label}>SESSION LENGTH</Text>
        <View style={styles.wrap}>
          {withCurrent(DURATIONS, [profile.workoutDuration].filter(Boolean))
            .sort((a, b) => a - b)
            .map((m) => (
              <Chip key={m} label={`${m} min`} selected={duration === m} onPress={() => setDuration(m)} />
            ))}
        </View>

        <Text style={styles.label}>FIND BUDDIES WITHIN</Text>
        <View style={styles.wrap}>
          {withCurrent(BUDDY_DISTANCES, [profile.buddyPreferences?.maxDistance].filter(Boolean))
            .sort((a, b) => a - b)
            .map((km) => (
              <Chip key={km} label={`${km} km`} selected={maxDistance === km} onPress={() => setMaxDistance(km)} />
            ))}
        </View>

        <Text style={styles.label}>GYM NAME</Text>
        <TextInput
          style={styles.input}
          value={gymName}
          onChangeText={setGymName}
          placeholder="Your gym"
          placeholderTextColor={COLORS.textMuted}
        />

        <Text style={styles.label}>GYM ADDRESS</Text>
        <TextInput
          style={styles.input}
          value={gymAddress}
          onChangeText={setGymAddress}
          placeholder="Street, area, city"
          placeholderTextColor={COLORS.textMuted}
        />

        <Text style={styles.label}>GYM LOCATION</Text>
        <Text style={styles.hint}>
          {newGymCoords
            ? `New location captured${newGymCoords.accuracy ? ` (±${newGymCoords.accuracy} m)` : ''}. It’s saved when you tap Save.`
            : gymLocked
              ? `Changed on ${lastGymChange.toDateString()}. You can move it again on ${nextGymChange.toDateString()}.`
              : `Check-ins are verified against this spot. Move it while you’re at your new gym — once every ${GYM_CHANGE_COOLDOWN_DAYS} days.`}
        </Text>
        <TouchableOpacity
          style={[styles.locationButton, (gymLocked || locating) && styles.disabled, newGymCoords && styles.locationDone]}
          onPress={handleMoveGym}
          disabled={gymLocked || locating}
        >
          {locating ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={styles.locationButtonText}>
              {newGymCoords ? '✓ Use a fresh reading instead' : '📍 Move my gym to where I am now'}
            </Text>
          )}
        </TouchableOpacity>
        {locationError && <Text style={styles.errorText}>{locationError}</Text>}

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}
        {savedMsg && <Text style={styles.savedText}>✓ {savedMsg}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.saveText}>SAVE CHANGES</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loader: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  scroll: { padding: SPACING.lg, paddingTop: 60, paddingBottom: 120 },
  backText: { color: COLORS.primary, fontSize: 14, fontWeight: '700', marginBottom: SPACING.sm },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: COLORS.textMuted, fontSize: 14, marginTop: SPACING.xs, marginBottom: SPACING.sm },
  label: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  hint: { color: COLORS.textMuted, fontSize: 13, marginBottom: SPACING.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  chip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    margin: 3,
    alignItems: 'center',
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  chipSub: { color: COLORS.text, opacity: 0.7, fontSize: 11, marginTop: 2 },
  halfChip: { width: '47%', borderRadius: 12 },
  input: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    color: COLORS.text,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  locationButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  locationDone: { borderColor: COLORS.success, backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  disabled: { opacity: 0.45 },
  locationButtonText: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 8,
    padding: SPACING.sm,
    marginTop: SPACING.md,
  },
  errorText: { color: COLORS.accent, fontSize: 14, textAlign: 'center' },
  savedText: { color: COLORS.success, fontWeight: '800', textAlign: 'center', marginTop: SPACING.md },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  saveText: { color: COLORS.text, fontWeight: '800', letterSpacing: 1 },
});

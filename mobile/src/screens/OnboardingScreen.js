import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
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
  BUDDY_GENDER_PREFS,
  BUDDY_LEVEL_RANGES,
  COMMITMENT_TYPES,
} from '../constants/fitnessConstants';

const FITNESS_LEVEL_OPTIONS = Object.values(FITNESS_LEVELS);
const FITNESS_GOAL_OPTIONS = Object.values(FITNESS_GOALS);
const WORKOUT_TYPE_OPTIONS = [
  WORKOUT_TYPES.WEIGHTLIFTING,
  WORKOUT_TYPES.CARDIO,
  WORKOUT_TYPES.CALISTHENICS,
  WORKOUT_TYPES.HIIT,
];

const TIME_SLOTS = [
  { key: 'early', label: 'Early morning', start: '05:00', end: '07:00' },
  { key: 'morning', label: 'Morning', start: '07:00', end: '09:00' },
  { key: 'midday', label: 'Midday', start: '11:00', end: '13:00' },
  { key: 'afternoon', label: 'Afternoon', start: '14:00', end: '16:00' },
  { key: 'evening', label: 'Evening', start: '17:00', end: '19:00' },
  { key: 'night', label: 'Night', start: '19:00', end: '21:00' },
];

const DURATIONS = [45, 60, 90, 120];

export default function OnboardingScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [bio, setBio] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState(FITNESS_LEVELS.BEGINNER);
  const [fitnessGoals, setFitnessGoals] = useState([]);
  const [workoutTypes, setWorkoutTypes] = useState([]);
  const [preferredDays, setPreferredDays] = useState([]);

  const [timeSlot, setTimeSlot] = useState(null);
  const [duration, setDuration] = useState(60);

  const [gymName, setGymName] = useState('');
  const [gymAddress, setGymAddress] = useState('');
  const [gymCoords, setGymCoords] = useState(null); // { coordinates: [lng, lat], accuracy }
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const position = await getCurrentCoords();
      setGymCoords(position);
      if (!gymAddress.trim()) {
        const address = await describePlace(position.coordinates);
        if (address) setGymAddress(address);
      }
    } catch (err) {
      setLocationError(err.message || 'Couldn’t get your location.');
    } finally {
      setLocating(false);
    }
  };

  const toggleArrayItem = (list, setList, item) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleNextStep = () => {
    if (step === 2 && fitnessGoals.length === 0) {
      setErrorMsg('Please select at least one fitness goal');
      return;
    }
    if (step === 3 && workoutTypes.length === 0) {
      setErrorMsg('Please select at least one workout type');
      return;
    }
    if (step === 4 && preferredDays.length === 0) {
      setErrorMsg('Please select at least one workout day');
      return;
    }
    if (step === 4 && !timeSlot) {
      setErrorMsg('Please pick the time of day you usually train');
      return;
    }
    setErrorMsg(null);
    setStep(step + 1);
  };

  const handleBackStep = () => {
    setErrorMsg(null);
    setStep(step - 1);
  };

  const handleCompleteOnboarding = async () => {
    if (!gymName.trim()) {
      setErrorMsg('Please enter your gym name');
      return;
    }
    if (!gymCoords) {
      setErrorMsg('Please set your gym location — we use it to find buddies and verify check-ins');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    const slot = TIME_SLOTS.find((t) => t.key === timeSlot) || TIME_SLOTS[1];

    const payload = {
      bio,
      fitnessLevel,
      commitmentType: COMMITMENT_TYPES.REGULAR,
      fitnessGoals,
      workoutTypes,
      preferredWorkoutDays: preferredDays,
      preferredWorkoutTime: {
        start: slot.start,
        end: slot.end,
      },
      workoutDuration: duration,
      gymLocation: {
        coordinates: gymCoords.coordinates,
      },
      gymName: gymName.trim(),
      gymAddress: gymAddress.trim(),
      buddyPreferences: {
        genderPreference: BUDDY_GENDER_PREFS.ANY,
        levelRange: BUDDY_LEVEL_RANGES.ANY,
        maxDistance: 10,
        ageRange: { min: 18, max: 50 },
      },
    };

    const result = await userApi.updateProfile(payload);
    setLoading(false);

    if (result.success) {
      navigation.replace('Home');
    } else {
      setErrorMsg(result.message || 'Onboarding failed. Please review your selections.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Step {step} of 5</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressIndicator, { width: `${step * 20}%` }]} />
        </View>
      </View>

      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Tell us about your fitness level</Text>
            <Text style={styles.stepSubtitle}>
              This matches you with partners of compatible workout intensity.
            </Text>

            {FITNESS_LEVEL_OPTIONS.map((level) => (
              <TouchableOpacity
                key={level}
                style={[styles.optionCard, fitnessLevel === level && styles.optionCardSelected]}
                onPress={() => setFitnessLevel(level)}
              >
                <Text style={styles.optionCardTitle}>{FITNESS_LEVEL_LABELS[level]}</Text>
                <Text style={styles.optionCardDesc}>
                  {level === FITNESS_LEVELS.BEGINNER && 'New to training, getting started.'}
                  {level === FITNESS_LEVELS.INTERMEDIATE && 'Consistent training for 1-2 years.'}
                  {level === FITNESS_LEVELS.ADVANCED && 'Experienced lifter, serious progress goals.'}
                  {level === FITNESS_LEVELS.ATHLETE && 'Competitive or high-performance training.'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Select your fitness goals</Text>
            <Text style={styles.stepSubtitle}>Pick all that apply to you.</Text>

            {FITNESS_GOAL_OPTIONS.map((goal) => (
              <TouchableOpacity
                key={goal}
                style={[styles.toggleChip, fitnessGoals.includes(goal) && styles.toggleChipSelected]}
                onPress={() => toggleArrayItem(fitnessGoals, setFitnessGoals, goal)}
              >
                <Text style={styles.toggleChipText}>{FITNESS_GOAL_LABELS[goal]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What training styles do you do?</Text>
            <Text style={styles.stepSubtitle}>We use this to find buddies with matching routines.</Text>

            {WORKOUT_TYPE_OPTIONS.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.toggleChip, workoutTypes.includes(type) && styles.toggleChipSelected]}
                onPress={() => toggleArrayItem(workoutTypes, setWorkoutTypes, type)}
              >
                <Text style={styles.toggleChipText}>{WORKOUT_TYPE_LABELS[type]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>When do you usually train?</Text>
            <Text style={styles.stepSubtitle}>Days of the week you prefer to hit the gym.</Text>

            {DAYS_OF_WEEK.map((day) => (
              <TouchableOpacity
                key={day}
                style={[styles.toggleChip, preferredDays.includes(day) && styles.toggleChipSelected]}
                onPress={() => toggleArrayItem(preferredDays, setPreferredDays, day)}
              >
                <Text style={styles.toggleChipText}>{DAY_LABELS[day]}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>USUAL TIME OF DAY</Text>
            <View style={styles.chipGrid}>
              {TIME_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot.key}
                  style={[styles.gridChip, timeSlot === slot.key && styles.toggleChipSelected]}
                  onPress={() => setTimeSlot(slot.key)}
                >
                  <Text style={styles.gridChipTitle}>{slot.label}</Text>
                  <Text style={styles.gridChipSub}>
                    {slot.start}–{slot.end}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>SESSION LENGTH</Text>
            <View style={styles.chipRow}>
              {DURATIONS.map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[styles.smallChip, duration === mins && styles.toggleChipSelected]}
                  onPress={() => setDuration(mins)}
                >
                  <Text style={styles.toggleChipText}>{mins} min</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 5 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Gym Location & Bio</Text>
            <Text style={styles.stepSubtitle}>Final details to activate matching.</Text>

            <Text style={styles.label}>WRITE A BRIEF BIO</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Looking for a partner to push limits on squats and deadlifts!"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              value={bio}
              onChangeText={setBio}
            />

            <Text style={styles.label}>YOUR GYM NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your gym name"
              placeholderTextColor={COLORS.textMuted}
              value={gymName}
              onChangeText={setGymName}
            />

            <Text style={styles.label}>GYM LOCATION</Text>
            <Text style={styles.hint}>
              Tap this while you're at your gym. Daily check-ins are verified against this spot, and
              you can only change it once a week.
            </Text>
            <TouchableOpacity
              style={[styles.locationButton, gymCoords && styles.locationButtonDone]}
              onPress={handleUseCurrentLocation}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.locationButtonText}>
                  {gymCoords
                    ? `✓ Location set${gymCoords.accuracy ? ` (±${gymCoords.accuracy} m)` : ''} · Tap to redo`
                    : '📍 Use my current location'}
                </Text>
              )}
            </TouchableOpacity>
            {locationError && <Text style={styles.locationError}>{locationError}</Text>}

            <Text style={styles.label}>GYM ADDRESS (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              placeholder="Street, area, city"
              placeholderTextColor={COLORS.textMuted}
              value={gymAddress}
              onChangeText={setGymAddress}
            />
          </View>
        )}
      </ScrollView>

      <View style={styles.navContainer}>
        {step > 1 ? (
          <TouchableOpacity style={styles.backButton} onPress={handleBackStep}>
            <Text style={styles.backButtonText}>BACK</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {step < 5 ? (
          <TouchableOpacity style={styles.nextButton} onPress={handleNextStep}>
            <Text style={styles.nextButtonText}>NEXT</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={handleCompleteOnboarding}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.completeButtonText}>COMPLETE</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 3,
    marginTop: SPACING.sm,
  },
  progressIndicator: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  errorContainer: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 8,
    padding: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.accent,
    fontSize: 14,
    textAlign: 'center',
  },
  scrollContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },
  stepContainer: {
    marginTop: SPACING.md,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  stepSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  optionCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceLight,
  },
  optionCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  optionCardDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  toggleChip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  },
  toggleChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleChipText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    color: COLORS.text,
    fontSize: 16,
    marginBottom: SPACING.md,
    textAlignVertical: 'top',
  },
  hint: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: SPACING.sm,
  },
  locationButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  locationButtonDone: {
    borderColor: COLORS.success,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  locationButtonText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 15,
  },
  locationError: {
    color: COLORS.accent,
    fontSize: 13,
    marginBottom: SPACING.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridChip: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  gridChipTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  gridChipSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  smallChip: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  navContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    padding: SPACING.lg,
    justifyContent: 'space-between',
  },
  backButton: {
    flex: 1,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  backButtonText: {
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  nextButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  nextButtonText: {
    color: COLORS.text,
    fontWeight: '800',
  },
  completeButton: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  completeButtonText: {
    color: COLORS.text,
    fontWeight: '800',
  },
});

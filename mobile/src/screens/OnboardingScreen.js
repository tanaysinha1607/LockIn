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

export default function OnboardingScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [bio, setBio] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState(FITNESS_LEVELS.BEGINNER);
  const [fitnessGoals, setFitnessGoals] = useState([]);
  const [workoutTypes, setWorkoutTypes] = useState([]);
  const [preferredDays, setPreferredDays] = useState([]);

  const [gymName, setGymName] = useState('Powerhouse Gym');
  const [gymAddress, setGymAddress] = useState('123 Cyber City, Sector 4');

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
    setErrorMsg(null);
    setStep(step + 1);
  };

  const handleBackStep = () => {
    setErrorMsg(null);
    setStep(step - 1);
  };

  const handleCompleteOnboarding = async () => {
    setLoading(true);
    setErrorMsg(null);

    const payload = {
      bio,
      fitnessLevel,
      commitmentType: COMMITMENT_TYPES.REGULAR,
      fitnessGoals,
      workoutTypes,
      preferredWorkoutDays: preferredDays,
      preferredWorkoutTime: {
        start: '07:00',
        end: '09:00',
      },
      workoutDuration: 90,
      gymLocation: {
        coordinates: [77.209, 28.6139],
      },
      gymName,
      gymAddress,
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

            <Text style={styles.label}>GYM ADDRESS</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter gym address"
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

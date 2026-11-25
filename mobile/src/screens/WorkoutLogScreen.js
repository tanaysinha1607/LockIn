import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, SPACING } from '../theme/theme';
import { workoutApi } from '../utils/api';
import { WORKOUT_TYPES, WORKOUT_TYPE_LABELS } from '../constants/fitnessConstants';

// Offered as quick picks until the user has their own history
const COMMON_EXERCISES = [
  'Bench Press',
  'Squat',
  'Deadlift',
  'Overhead Press',
  'Barbell Row',
  'Pull-ups',
  'Lat Pulldown',
  'Leg Press',
  'Bicep Curl',
  'Tricep Pushdown',
  'Lunges',
  'Plank',
];

const emptySet = () => ({ reps: '', weight: '' });
const emptyExercise = (name = '') => ({ name, sets: [emptySet()] });
const toNum = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export default function WorkoutLogScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [suggestions, setSuggestions] = useState(COMMON_EXERCISES);

  const [workoutType, setWorkoutType] = useState(null);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState([emptyExercise()]);

  useEffect(() => {
    (async () => {
      const [todayRes, exRes] = await Promise.all([workoutApi.today(), workoutApi.exercises()]);
      const existing = todayRes.success ? todayRes.data.workout : null;
      if (existing) {
        setIsEdit(true);
        setWorkoutType(existing.workoutType);
        setDuration(existing.durationMin ? String(existing.durationMin) : '');
        setNotes(existing.notes || '');
        setExercises(
          existing.exercises.map((ex) => ({
            name: ex.name,
            sets: ex.sets.map((s) => ({ reps: String(s.reps), weight: s.weight ? String(s.weight) : '' })),
          }))
        );
      }
      if (exRes.success && exRes.data.exercises.length) {
        const mine = exRes.data.exercises.map((e) => e.name);
        setSuggestions([...new Set([...mine, ...COMMON_EXERCISES])].slice(0, 16));
      }
      setLoading(false);
    })();
  }, []);

  const updateExercise = (i, patch) =>
    setExercises((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex)));

  const updateSet = (ei, si, patch) =>
    setExercises((prev) =>
      prev.map((ex, idx) =>
        idx === ei ? { ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : ex
      )
    );

  // New set copies the previous one, since most sets repeat the same weight
  const addSet = (ei) =>
    setExercises((prev) =>
      prev.map((ex, idx) => (idx === ei ? { ...ex, sets: [...ex.sets, { ...(ex.sets[ex.sets.length - 1] || emptySet()) }] } : ex))
    );

  const removeSet = (ei, si) =>
    setExercises((prev) =>
      prev.map((ex, idx) => (idx === ei ? { ...ex, sets: ex.sets.filter((_, j) => j !== si) } : ex))
    );

  const removeExercise = (ei) => setExercises((prev) => prev.filter((_, idx) => idx !== ei));

  const pickSuggestion = (name) => {
    const blank = exercises.findIndex((ex) => !ex.name.trim());
    if (blank >= 0) updateExercise(blank, { name });
    else setExercises((prev) => [...prev, emptyExercise(name)]);
  };

  const handleSave = async () => {
    setErrorMsg(null);
    const payload = exercises
      .map((ex) => ({
        name: ex.name.trim(),
        sets: ex.sets
          .map((s) => ({ reps: Math.round(toNum(s.reps)), weight: toNum(s.weight) }))
          .filter((s) => s.reps > 0),
      }))
      .filter((ex) => ex.name && ex.sets.length);

    if (!payload.length) {
      setErrorMsg('Add at least one exercise with reps.');
      return;
    }

    setSaving(true);
    const res = await workoutApi.save({
      workoutType: workoutType || null,
      durationMin: duration ? Math.round(toNum(duration)) || null : null,
      notes: notes.trim(),
      exercises: payload,
    });
    setSaving(false);

    if (res.success) navigation.goBack();
    else setErrorMsg(res.message || 'Could not save your workout.');
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? "Edit Today's Workout" : 'Log Workout'}</Text>
        <Text style={styles.subtitle}>Weights in kg. Leave weight empty for bodyweight moves.</Text>

        <Text style={styles.label}>TYPE</Text>
        <View style={styles.wrap}>
          {Object.values(WORKOUT_TYPES).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, workoutType === t && styles.chipOn]}
              onPress={() => setWorkoutType(workoutType === t ? null : t)}
            >
              <Text style={styles.chipText}>{WORKOUT_TYPE_LABELS[t] || t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>QUICK ADD</Text>
        <View style={styles.wrap}>
          {suggestions.map((name) => (
            <TouchableOpacity key={name} style={styles.smallChip} onPress={() => pickSuggestion(name)}>
              <Text style={styles.smallChipText}>+ {name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {exercises.map((ex, ei) => (
          <View key={ei} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <TextInput
                style={styles.exerciseName}
                value={ex.name}
                onChangeText={(name) => updateExercise(ei, { name })}
                placeholder="Exercise name"
                placeholderTextColor={COLORS.textMuted}
                maxLength={60}
              />
              {exercises.length > 1 && (
                <TouchableOpacity onPress={() => removeExercise(ei)}>
                  <Text style={styles.remove}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.setHeaderRow}>
              <Text style={[styles.setHeader, { width: 36 }]}>SET</Text>
              <Text style={[styles.setHeader, { flex: 1 }]}>KG</Text>
              <Text style={[styles.setHeader, { flex: 1 }]}>REPS</Text>
              <View style={{ width: 24 }} />
            </View>
            {ex.sets.map((s, si) => (
              <View key={si} style={styles.setRow}>
                <Text style={styles.setNum}>{si + 1}</Text>
                <TextInput
                  style={styles.setInput}
                  value={s.weight}
                  onChangeText={(weight) => updateSet(ei, si, { weight })}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={COLORS.textMuted}
                />
                <TextInput
                  style={styles.setInput}
                  value={s.reps}
                  onChangeText={(reps) => updateSet(ei, si, { reps })}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.textMuted}
                />
                <TouchableOpacity style={{ width: 24, alignItems: 'center' }} onPress={() => removeSet(ei, si)}>
                  {ex.sets.length > 1 && <Text style={styles.removeSmall}>−</Text>}
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => addSet(ei)}>
              <Text style={styles.addLink}>+ Add set</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addExercise} onPress={() => setExercises((prev) => [...prev, emptyExercise()])}>
          <Text style={styles.addExerciseText}>+ ADD EXERCISE</Text>
        </TouchableOpacity>

        <Text style={styles.label}>DURATION (MIN)</Text>
        <TextInput
          style={styles.input}
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          placeholder="e.g. 75"
          placeholderTextColor={COLORS.textMuted}
        />

        <Text style={styles.label}>NOTES</Text>
        <TextInput
          style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={500}
          placeholder="How did it feel?"
          placeholderTextColor={COLORS.textMuted}
        />

        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.saveText}>SAVE WORKOUT</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.lg, paddingTop: 60, paddingBottom: 120 },
  back: { color: COLORS.primary, fontSize: 14, fontWeight: '700', marginBottom: SPACING.sm },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: COLORS.textMuted, fontSize: 13, marginTop: SPACING.xs },
  label: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  chip: {
    borderColor: COLORS.border,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    margin: 3,
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  smallChip: { backgroundColor: COLORS.surfaceLight, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10, margin: 3 },
  smallChipText: { color: COLORS.secondary, fontSize: 12, fontWeight: '700' },
  exerciseCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  exerciseName: { flex: 1, color: COLORS.text, fontSize: 17, fontWeight: '800', paddingVertical: 4 },
  remove: { color: COLORS.accent, fontSize: 18, paddingHorizontal: SPACING.sm },
  setHeaderRow: { flexDirection: 'row', marginBottom: 4 },
  setHeader: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  setNum: { width: 36, color: COLORS.textMuted, textAlign: 'center', fontWeight: '700' },
  setInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    color: COLORS.text,
    textAlign: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    fontSize: 16,
  },
  removeSmall: { color: COLORS.accent, fontSize: 20, fontWeight: '700' },
  addLink: { color: COLORS.secondary, fontWeight: '700', marginTop: SPACING.xs },
  addExercise: {
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  addExerciseText: { color: COLORS.primary, fontWeight: '800', letterSpacing: 1 },
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
  error: { color: COLORS.accent, textAlign: 'center', marginTop: SPACING.md },
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
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: SPACING.md, alignItems: 'center' },
  saveText: { color: COLORS.text, fontWeight: '800', letterSpacing: 1 },
});

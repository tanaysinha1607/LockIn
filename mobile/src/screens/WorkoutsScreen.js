import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../theme/theme';
import { workoutApi } from '../utils/api';

const METRICS = [
  { key: 'maxWeight', label: 'Top weight', unit: 'kg' },
  { key: 'e1rm', label: 'Est. 1-rep max', unit: 'kg' },
  { key: 'volume', label: 'Volume', unit: 'kg' },
];

const shortDate = (d) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Simple bar chart drawn with Views (no chart library needed, works on web and phones).
 */
function BarChart({ points, metric }) {
  const values = points.map((p) => p[metric.key] || 0);
  const max = Math.max(1, ...values);
  return (
    <View style={styles.chart}>
      {points.map((p, i) => {
        const v = values[i];
        const isBest = v === max && v > 0;
        return (
          <View key={p.date} style={styles.barCol}>
            <Text style={styles.barValue}>{v || ''}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  { height: `${Math.max(4, (v / max) * 100)}%` },
                  isBest && { backgroundColor: COLORS.gold },
                ]}
              />
            </View>
            <Text style={styles.barLabel}>{shortDate(p.date)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function WorkoutsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState(null);
  const [metric, setMetric] = useState(METRICS[0]);
  const [points, setPoints] = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);

  const loadChart = async (name) => {
    setSelected(name);
    setLoadingChart(true);
    const res = await workoutApi.progress(name, 12);
    setLoadingChart(false);
    if (res.success) setPoints(res.data.points);
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [wRes, eRes] = await Promise.all([workoutApi.list(null, 20), workoutApi.exercises()]);
        setLoading(false);
        if (wRes.success) setWorkouts(wRes.data.workouts);
        if (eRes.success) {
          setExercises(eRes.data.exercises);
          const first = eRes.data.exercises[0]?.name;
          if (first) loadChart(selected || first);
        }
      })();
    }, [])
  );

  const best = points.length ? Math.max(...points.map((p) => p[metric.key] || 0)) : 0;
  const first = points[0]?.[metric.key] || 0;
  const last = points[points.length - 1]?.[metric.key] || 0;
  const change = points.length > 1 && first ? Math.round(((last - first) / first) * 100) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← BACK</Text>
      </TouchableOpacity>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Workouts</Text>
        <TouchableOpacity style={styles.logButton} onPress={() => navigation.navigate('WorkoutLog')}>
          <Text style={styles.logButtonText}>+ Log today</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />}

      {!loading && exercises.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyText}>
            No workouts logged yet. After you check in, log what you trained and your progress shows up here. Your
            AI coach uses it too.
          </Text>
        </View>
      )}

      {!loading && exercises.length > 0 && (
        <>
          <Text style={styles.section}>Progress</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.sm }}>
            {exercises.map((e) => (
              <TouchableOpacity
                key={e.key}
                style={[styles.chip, selected === e.name && styles.chipOn]}
                onPress={() => loadChart(e.name)}
              >
                <Text style={styles.chipText}>{e.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.metricRow}>
            {METRICS.map((m) => (
              <TouchableOpacity key={m.key} onPress={() => setMetric(m)}>
                <Text style={[styles.metric, metric.key === m.key && styles.metricOn]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.card}>
            {loadingChart ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : points.length ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summary}>
                    Best <Text style={styles.summaryNum}>{best}{metric.unit}</Text>
                  </Text>
                  {change !== null && (
                    <Text style={[styles.summary, { color: change >= 0 ? COLORS.success : COLORS.accent }]}>
                      {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% since {shortDate(points[0].date)}
                    </Text>
                  )}
                </View>
                <BarChart points={points} metric={metric} />
              </>
            ) : (
              <Text style={styles.emptyText}>No sets with weight logged for this exercise yet.</Text>
            )}
          </View>
        </>
      )}

      {workouts.length > 0 && (
        <>
          <Text style={styles.section}>History</Text>
          {workouts.map((w) => (
            <View key={w._id} style={styles.card}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyDate}>{shortDate(w.date)}</Text>
                <Text style={styles.historyMeta}>
                  {w.totalSets} sets{w.totalVolume ? ` · ${w.totalVolume}kg` : ''}
                  {w.durationMin ? ` · ${w.durationMin} min` : ''}
                </Text>
              </View>
              {w.exercises.map((ex) => {
                const top = ex.sets.reduce((b, s) => (!b || s.weight > b.weight ? s : b), null);
                return (
                  <Text key={ex.key || ex.name} style={styles.historyLine}>
                    {ex.name} — {ex.sets.length} × {top?.reps}
                    {top?.weight ? ` @ ${top.weight}kg` : ''}
                  </Text>
                );
              })}
              {w.notes ? <Text style={styles.historyNotes}>“{w.notes}”</Text> : null}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: 60, paddingBottom: SPACING.xxl },
  back: { color: COLORS.primary, fontSize: 14, fontWeight: '700', marginBottom: SPACING.sm },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '900' },
  logButton: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 6, paddingHorizontal: SPACING.md },
  logButtonText: { color: COLORS.text, fontWeight: '800' },
  section: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: SPACING.lg, marginBottom: SPACING.sm },
  chip: {
    borderColor: COLORS.border,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    marginRight: 6,
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  metricRow: { flexDirection: 'row', marginBottom: SPACING.sm },
  metric: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700', marginRight: SPACING.md },
  metricOn: { color: COLORS.secondary, textDecorationLine: 'underline' },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  summary: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700' },
  summaryNum: { color: COLORS.gold, fontSize: 15 },
  chart: { flexDirection: 'row', height: 170, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', height: '100%' },
  barValue: { color: COLORS.textMuted, fontSize: 9, marginBottom: 2 },
  barTrack: { flex: 1, width: '60%', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: COLORS.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel: { color: COLORS.textMuted, fontSize: 9, marginTop: 4 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  historyDate: { color: COLORS.text, fontWeight: '800' },
  historyMeta: { color: COLORS.textMuted, fontSize: 12 },
  historyLine: { color: COLORS.text, fontSize: 14, marginTop: 2 },
  historyNotes: { color: COLORS.textMuted, fontStyle: 'italic', fontSize: 13, marginTop: 4 },
  empty: { alignItems: 'center', marginTop: SPACING.xxl },
  emptyIcon: { fontSize: 40, marginBottom: SPACING.md },
  emptyText: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center' },
});

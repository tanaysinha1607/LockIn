import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../theme/theme';
import { recapApi } from '../utils/api';
import { shareViewAsImage } from '../utils/shareImage';

const DAY_SHORT = { monday: 'M', tuesday: 'T', wednesday: 'W', thursday: 'T', friday: 'F', saturday: 'S', sunday: 'S' };

const formatRange = (start, end) => {
  const fmt = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(start)} – ${fmt(end)}`;
};

const formatKg = (kg) => (kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${kg}kg`);

export default function WeeklyRecapScreen({ navigation, route }) {
  const [week, setWeek] = useState(route?.params?.week || 'current');
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [shareNote, setShareNote] = useState(null);
  const cardRef = useRef(null);

  const load = async (w) => {
    setLoading(true);
    setShareNote(null);
    const res = await recapApi.get(w);
    setLoading(false);
    if (res.success) {
      setRecap(res.data.recap);
      setErrorMsg(null);
    } else {
      setErrorMsg(res.message || 'Could not load your recap.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      load(week);
    }, [week])
  );

  const shareText = recap
    ? [
        `My LockIn week (${formatRange(recap.start, recap.end)}):`,
        `🏋️ ${recap.checkIns}${recap.planned ? `/${recap.planned}` : ''} gym check-ins`,
        `⚡ +${recap.xp} XP · 🔥 ${recap.streak}-day streak`,
        recap.lockIns ? `🔒 ${recap.lockIns} lock-in${recap.lockIns === 1 ? '' : 's'} with my buddies` : null,
        recap.workouts.count ? `📝 ${recap.workouts.sets} sets · ${formatKg(recap.workouts.volume)} lifted` : null,
        recap.buddyRank && recap.buddyRank.of > 1 ? `🥇 #${recap.buddyRank.rank} of ${recap.buddyRank.of} among my buddies` : null,
        '#LockIn',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const handleShare = async () => {
    const how = await shareViewAsImage(cardRef, shareText);
    if (how === 'copied') setShareNote('Copied to clipboard — paste it anywhere.');
    else if (how === 'unsupported') setShareNote('Sharing is not available in this browser.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← BACK</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Weekly Recap</Text>

      <View style={styles.toggleRow}>
        {[
          { key: 'current', label: 'This week' },
          { key: 'last', label: 'Last week' },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.toggle, week === opt.key && styles.toggleOn]}
            onPress={() => setWeek(opt.key)}
          >
            <Text style={styles.toggleText}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />}
      {!loading && errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      {!loading && recap && (
        <>
          {/* Everything inside this card is what gets shared as an image */}
          <View ref={cardRef} collapsable={false} style={styles.card}>
            <Text style={styles.brand}>
              LOCK<Text style={{ color: COLORS.primary }}>IN</Text>
            </Text>
            <Text style={styles.cardSub}>
              {recap.name ? `${recap.name}'s week · ` : ''}
              {formatRange(recap.start, recap.end)}
            </Text>

            <View style={styles.daysRow}>
              {recap.days.map((d) => (
                <View key={d.date} style={styles.dayCol}>
                  <View style={[styles.dayDot, d.checkedIn && styles.dayDotOn, d.future && styles.dayDotFuture]}>
                    <Text style={styles.dayDotText}>{d.checkedIn ? '✓' : ''}</Text>
                  </View>
                  <Text style={styles.dayLabel}>{DAY_SHORT[d.day]}</Text>
                </View>
              ))}
            </View>

            <View style={styles.bigRow}>
              <View style={styles.bigStat}>
                <Text style={styles.bigNum}>
                  {recap.checkIns}
                  {recap.planned ? <Text style={styles.bigOf}>/{recap.planned}</Text> : null}
                </Text>
                <Text style={styles.bigLbl}>check-ins</Text>
              </View>
              <View style={styles.bigStat}>
                <Text style={[styles.bigNum, { color: COLORS.gold }]}>+{recap.xp}</Text>
                <Text style={styles.bigLbl}>XP</Text>
              </View>
              <View style={styles.bigStat}>
                <Text style={[styles.bigNum, { color: COLORS.accent }]}>{recap.streak}</Text>
                <Text style={styles.bigLbl}>day streak</Text>
              </View>
            </View>

            <View style={styles.lines}>
              <Text style={styles.line}>🔒 {recap.lockIns} lock-in{recap.lockIns === 1 ? '' : 's'} with buddies</Text>
              {recap.workouts.count > 0 && (
                <Text style={styles.line}>
                  📝 {recap.workouts.count} workout{recap.workouts.count === 1 ? '' : 's'} logged · {recap.workouts.sets} sets ·{' '}
                  {formatKg(recap.workouts.volume)} lifted
                </Text>
              )}
              {recap.buddyRank && recap.buddyRank.of > 1 && (
                <Text style={styles.line}>
                  🥇 #{recap.buddyRank.rank} of {recap.buddyRank.of} among your buddies
                </Text>
              )}
              {recap.badges.map((b) => (
                <Text key={b.name} style={styles.line}>
                  {b.icon || '🏅'} Earned “{b.name}”
                </Text>
              ))}
              <Text style={styles.line}>⭐ Level {recap.level}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareText}>📤 SHARE MY WEEK</Text>
          </TouchableOpacity>
          {shareNote && <Text style={styles.note}>{shareNote}</Text>}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: 60, paddingBottom: SPACING.xxl },
  back: { color: COLORS.primary, fontSize: 14, fontWeight: '700', marginBottom: SPACING.sm },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '900' },
  toggleRow: { flexDirection: 'row', marginVertical: SPACING.md },
  toggle: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    marginHorizontal: 3,
  },
  toggleOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleText: { color: COLORS.text, fontWeight: '700' },
  error: { color: COLORS.accent, textAlign: 'center', marginTop: SPACING.lg },
  card: {
    backgroundColor: '#1E1B4B',
    borderRadius: 20,
    padding: SPACING.lg,
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  brand: { color: COLORS.text, fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  cardSub: { color: COLORS.textMuted, fontSize: 13, marginTop: 2, marginBottom: SPACING.lg },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.lg },
  dayCol: { alignItems: 'center' },
  dayDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotOn: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  dayDotFuture: { opacity: 0.35 },
  dayDotText: { color: COLORS.text, fontWeight: '900' },
  dayLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  bigRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.lg },
  bigStat: { alignItems: 'center', flex: 1 },
  bigNum: { color: COLORS.text, fontSize: 30, fontWeight: '900' },
  bigOf: { color: COLORS.textMuted, fontSize: 18 },
  bigLbl: { color: COLORS.textMuted, fontSize: 12 },
  lines: { borderTopColor: 'rgba(255,255,255,0.1)', borderTopWidth: 1, paddingTop: SPACING.md },
  line: { color: COLORS.text, fontSize: 14, marginBottom: 6 },
  shareButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  shareText: { color: COLORS.text, fontWeight: '800', letterSpacing: 1 },
  note: { color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.sm },
});

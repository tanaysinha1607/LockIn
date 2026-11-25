import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { COLORS, SPACING } from '../theme/theme';
import { userApi, notificationApi } from '../utils/api';
import { getPushStatus, registerForPushNotifications } from '../utils/push';

// Order and wording shown to the user. Keys match User.notificationPreferences on the server.
const OPTIONS = [
  {
    key: 'buddyRequests',
    title: 'Buddy requests',
    description: 'When someone wants to be your gym buddy, or accepts your request.',
  },
  {
    key: 'buddyActivity',
    title: 'Buddy check-ins & nudges',
    description: 'When a buddy checks in before you, or nudges you to get to the gym.',
  },
  {
    key: 'messages',
    title: 'Chat messages',
    description: 'New messages from your buddies while the app is closed.',
  },
  {
    key: 'checkInReminders',
    title: 'Check-in & streak reminders',
    description: 'A nudge at your usual workout time, and a warning before your streak resets.',
  },
  {
    key: 'weeklyRecap',
    title: 'Weekly recap',
    description: 'Sunday evening summary of your week: check-ins, XP and buddy ranking.',
  },
  {
    key: 'challengeUpdates',
    title: 'Challenge results',
    description: 'When you complete, win or lose a challenge.',
  },
];

export default function NotificationSettingsScreen({ navigation }) {
  const [prefs, setPrefs] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [push, setPush] = useState(getPushStatus());
  const [checkingPush, setCheckingPush] = useState(false);

  useEffect(() => {
    userApi.getMe().then((res) => {
      if (res.success) {
        const stored = res.data.user?.notificationPreferences || {};
        // Missing keys default to on, same as the server
        setPrefs(Object.fromEntries(OPTIONS.map((o) => [o.key, stored[o.key] !== false])));
      } else {
        setErrorMsg(res.message || 'Could not load your settings.');
      }
    });
  }, []);

  const toggle = async (key, value) => {
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value }); // optimistic
    setErrorMsg(null);
    const res = await notificationApi.updatePreferences({ [key]: value });
    if (!res.success) {
      setPrefs(previous);
      setErrorMsg(res.message || 'Could not save that change.');
    }
  };

  const recheckPush = async () => {
    setCheckingPush(true);
    await registerForPushNotifications();
    setPush(getPushStatus());
    setCheckingPush(false);
  };

  const pushOn = push.status === 'registered';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← BACK</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Notification Settings</Text>
      <Text style={styles.subtitle}>
        Choose what reaches your phone. Everything still shows in your 🔔 list in the app.
      </Text>

      {Platform.OS !== 'web' && (
        <View style={[styles.pushCard, pushOn ? styles.pushOn : styles.pushOff]}>
          <Text style={styles.pushTitle}>{pushOn ? '✓ Phone notifications are on' : 'Phone notifications are off'}</Text>
          {!pushOn && <Text style={styles.pushText}>{push.message}</Text>}
          {!pushOn && (
            <TouchableOpacity onPress={recheckPush} disabled={checkingPush}>
              <Text style={styles.pushLink}>{checkingPush ? 'Checking…' : 'Check again'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {!prefs && !errorMsg && <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />}

      {prefs &&
        OPTIONS.map((opt) => (
          <View key={opt.key} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{opt.title}</Text>
              <Text style={styles.rowDesc}>{opt.description}</Text>
            </View>
            <Switch
              value={prefs[opt.key]}
              onValueChange={(v) => toggle(opt.key, v)}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={COLORS.text}
            />
          </View>
        ))}

      <Text style={styles.footnote}>
        Session invites, lock-ins and badges always notify you — they're the core of LockIn.
      </Text>

      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingTop: 60, paddingBottom: SPACING.xxl },
  back: { color: COLORS.primary, fontSize: 14, fontWeight: '700', marginBottom: SPACING.sm },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: COLORS.textMuted, fontSize: 14, marginTop: SPACING.xs, marginBottom: SPACING.lg },
  pushCard: { borderWidth: 1, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.lg },
  pushOn: { borderColor: COLORS.success, backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  pushOff: { borderColor: COLORS.warning, backgroundColor: 'rgba(245, 158, 11, 0.1)' },
  pushTitle: { color: COLORS.text, fontWeight: '800', fontSize: 15 },
  pushText: { color: COLORS.textMuted, fontSize: 13, marginTop: SPACING.xs },
  pushLink: { color: COLORS.secondary, fontWeight: '700', fontSize: 13, marginTop: SPACING.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  rowText: { flex: 1, marginRight: SPACING.md },
  rowTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  rowDesc: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  footnote: { color: COLORS.textMuted, fontSize: 12, marginTop: SPACING.md, textAlign: 'center' },
  error: { color: COLORS.accent, fontSize: 14, textAlign: 'center', marginTop: SPACING.md },
});

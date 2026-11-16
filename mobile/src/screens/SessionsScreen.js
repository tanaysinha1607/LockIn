import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../theme/theme';
import { sessionApi, buddyApi } from '../utils/api';
import { WORKOUT_TYPES } from '../constants/fitnessConstants';

const TABS = {
  UPCOMING: 'upcoming',
  INVITES: 'invites',
  SCHEDULE: 'schedule',
  HISTORY: 'history',
};

const formatWorkoutType = (type) => {
  if (!type) return 'Gym Workout';
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
};

export default function SessionsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState(TABS.UPCOMING);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Data states
  const [sessions, setSessions] = useState([]);
  const [buddies, setBuddies] = useState([]);

  // Form states for scheduling
  const [selectedBuddyId, setSelectedBuddyId] = useState('');
  const [title, setTitle] = useState('');
  const [gymLocation, setGymLocation] = useState('');
  const [workoutType, setWorkoutType] = useState('weightlifting');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const [sessionsRes, buddiesRes] = await Promise.all([
      sessionApi.list(),
      buddyApi.getActiveMatches(),
    ]);

    if (showLoader) setLoading(false);
    setRefreshing(false);

    if (sessionsRes.success) {
      setSessions(sessionsRes.data?.sessions || []);
    } else {
      setErrorMsg(sessionsRes.message || 'Failed to load sessions.');
    }

    if (buddiesRes.success) {
      setBuddies(buddiesRes.data?.matches || []);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const handleRespond = async (sessionId, status) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const result = await sessionApi.respond(sessionId, status);
    if (result.success) {
      setSuccessMsg(status === 'confirmed' ? 'Session accepted!' : 'Session declined.');
      await loadData(false);
    } else {
      setErrorMsg(result.message);
    }
  };

  const handleCancel = async (sessionId) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const result = await sessionApi.cancel(sessionId);
    if (result.success) {
      setSuccessMsg('Session cancelled successfully.');
      await loadData(false);
    } else {
      setErrorMsg(result.message);
    }
  };

  const handleSchedule = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedBuddyId) {
      setErrorMsg('Please select a gym buddy.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Please enter a session title.');
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      setErrorMsg('Please enter date and time.');
      return;
    }

    // Combine date and time
    // Expected formats: date (YYYY-MM-DD), time (HH:MM)
    const isoString = `${scheduledDate}T${scheduledTime}:00`;
    const dateObj = new Date(isoString);
    if (isNaN(dateObj.getTime())) {
      setErrorMsg('Invalid date or time format. Use YYYY-MM-DD and HH:MM.');
      return;
    }

    if (dateObj <= new Date()) {
      setErrorMsg('Scheduled date/time must be in the future.');
      return;
    }

    // Find the match ID associated with the buddy
    const match = buddies.find(m => String(m.buddy?.user?._id) === String(selectedBuddyId));
    if (!match) {
      setErrorMsg('Could not establish buddy match connection.');
      return;
    }

    setSubmitting(true);
    const payload = {
      matchId: match.matchId,
      title: title.trim(),
      scheduledDate: dateObj.toISOString(),
      duration: parseInt(duration) || 60,
      workoutType,
      location: gymLocation.trim() || null,
      notes: notes.trim(),
    };

    const result = await sessionApi.create(payload);
    setSubmitting(false);

    if (result.success) {
      setSuccessMsg('Workout session scheduled successfully! Invitation sent.');
      // Reset form
      setSelectedBuddyId('');
      setTitle('');
      setGymLocation('');
      setScheduledDate('');
      setScheduledTime('');
      setNotes('');
      // Navigate to upcoming tab
      setActiveTab(TABS.UPCOMING);
      await loadData(false);
    } else {
      setErrorMsg(result.message);
    }
  };

  // Helper to partition sessions
  const getPartitionedSessions = () => {
    const now = new Date();
    const invites = [];
    const upcoming = [];
    const history = [];

    sessions.forEach(s => {
      // Is it a pending invite for the user?
      // Creator is confirmed, status is pending, current user is not creator
      const isInvite = s.status === 'pending' && s.confirmedBy.length === 1 && !s.confirmedBy.includes(String(s.creatorId === buddies[0]?.buddy?.user?._id)); // Wait, we can check creators vs confirmers or simply creatorId
      
      // Let's distinguish invite vs pending scheduled by user
      const amCreator = s.creatorId?._id ? String(s.creatorId._id) : String(s.creatorId);
      
      if (s.status === 'pending' && amCreator !== String(buddies[0]?.buddy?.user?._id && '')) {
        // Find if user did not confirm it yet
        // In session, participants = [creator, buddy]. If buddy hasn't accepted, confirmedBy only has creator.
        const hasAccepted = s.confirmedBy.some(id => String(id?._id || id) === String(s.creatorId?._id || s.creatorId));
        // Actually: if status is pending and creator is NOT the current user, it's an incoming invite!
        // Let's get current user's ID. We can infer it by finding who scheduled it.
      }
    });

    // Let's write a safer check. Since we don't have the user's ID stored directly in this component,
    // let's look at who accepted or creatorId.
    // If user's partner is in buddies, and creator is NOT partner, then creator is buddy!
    // So if session.creatorId is NOT in buddies userIds, then user created it.
    // Wait, the easiest way: a session is an invite if status === 'pending' and creatorId !== current user's ID.
    // Let's find current user ID. We can extract user._id from buddies[0]?.matchId? or we can get it from the user state in profile, but we can also just check if the session is created by the buddy.
    // If buddies has user whose id matches creatorId, then creator is buddy!
    const buddyIdsSet = new Set(buddies.map(m => String(m.buddy?.user?._id)));

    sessions.forEach(s => {
      const creatorIdStr = String(s.creatorId?._id || s.creatorId);
      const isCreatorBuddy = buddyIdsSet.has(creatorIdStr);

      if (s.status === 'pending' && isCreatorBuddy) {
        invites.push(s);
      } else if (['pending', 'confirmed'].includes(s.status)) {
        upcoming.push(s);
      } else {
        history.push(s);
      }
    });

    return { invites, upcoming, history };
  };

  const { invites, upcoming, history } = getPartitionedSessions();

  const renderSessionItem = ({ item }) => {
    const formattedDate = new Date(item.scheduledDate).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const formattedTime = new Date(item.scheduledDate).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isInvite = activeTab === TABS.INVITES;
    const isUpcoming = activeTab === TABS.UPCOMING;
    
    // Find buddy details
    // Participants contains user A and User B. Buddy is the one who isn't the creator (or isn't the current user).
    // Let's display the session creator or buddy name.
    const buddyName = item.participants?.map(p => p.firstName).join(' & ') || 'Workout Session';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.sessionTitle}>{item.title}</Text>
          <View style={[styles.statusTag, styles[`statusTag_${item.status}`]]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.sessionDetails}>
          📅 {formattedDate} at {formattedTime} ({item.duration} min)
        </Text>
        <Text style={styles.sessionDetails}>
          🏋️ {formatWorkoutType(item.workoutType)}
        </Text>
        <Text style={styles.sessionDetails}>
          📍 {item.location || 'Gym location not specified'}
        </Text>
        {item.notes ? (
          <Text style={styles.sessionNotes}>📝 {item.notes}</Text>
        ) : null}

        {isInvite && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.declineBtn]}
              onPress={() => handleRespond(item._id, 'cancelled')}
            >
              <Text style={styles.actionBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => handleRespond(item._id, 'confirmed')}
            >
              <Text style={styles.actionBtnText}>Accept Invite</Text>
            </TouchableOpacity>
          </View>
        )}

        {isUpcoming && item.status !== 'cancelled' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.cancelBtn, { marginTop: SPACING.sm }]}
            onPress={() => handleCancel(item._id)}
          >
            <Text style={styles.actionBtnText}>Cancel Session</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const getListData = () => {
    if (activeTab === TABS.UPCOMING) return upcoming;
    if (activeTab === TABS.INVITES) return invites;
    if (activeTab === TABS.HISTORY) return history;
    return [];
  };

  const renderScheduleTab = () => {
    if (buddies.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            You must have an active buddy match to schedule a workout. Match with someone first!
          </Text>
          <TouchableOpacity
            style={styles.navigateBtn}
            onPress={() => navigation.navigate('Buddy')}
          >
            <Text style={styles.navigateBtnText}>Find Gym Buddies</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.formLabel}>Select Gym Buddy</Text>
        <View style={styles.selectContainer}>
          {buddies.map(m => (
            <TouchableOpacity
              key={m.buddy?.user?._id}
              style={[
                styles.selectItem,
                selectedBuddyId === m.buddy?.user?._id && styles.selectItemActive,
              ]}
              onPress={() => setSelectedBuddyId(m.buddy?.user?._id)}
            >
              <Text
                style={[
                  styles.selectItemText,
                  selectedBuddyId === m.buddy?.user?._id && styles.selectItemTextActive,
                ]}
              >
                🤝 {m.buddy?.user?.firstName} {m.buddy?.user?.lastName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.formLabel}>Session Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Back & Biceps Blaster"
          placeholderTextColor={COLORS.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.formLabel}>Gym / Location</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Gold Gym Connaught Place"
          placeholderTextColor={COLORS.textMuted}
          value={gymLocation}
          onChangeText={setGymLocation}
        />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: SPACING.sm }}>
            <Text style={styles.formLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-06-20"
              placeholderTextColor={COLORS.textMuted}
              value={scheduledDate}
              onChangeText={setScheduledDate}
            />
          </View>
          <View style={{ flex: 1, marginLeft: SPACING.sm }}>
            <Text style={styles.formLabel}>Time (24h HH:MM)</Text>
            <TextInput
              style={styles.input}
              placeholder="08:30"
              placeholderTextColor={COLORS.textMuted}
              value={scheduledTime}
              onChangeText={setScheduledTime}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: SPACING.sm }}>
            <Text style={styles.formLabel}>Duration (mins)</Text>
            <TextInput
              style={styles.input}
              placeholder="60"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              value={duration}
              onChangeText={setDuration}
            />
          </View>
          <View style={{ flex: 1, marginLeft: SPACING.sm }}>
            <Text style={styles.formLabel}>Workout Type</Text>
            <View style={styles.typeSelector}>
              {['weightlifting', 'cardio', 'calisthenics'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeBtn,
                    workoutType === type && styles.typeBtnActive,
                  ]}
                  onPress={() => setWorkoutType(type)}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      workoutType === type && styles.typeBtnTextActive,
                    ]}
                  >
                    {type.substring(0, 6)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.formLabel}>Optional Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="e.g. Focus on compound movements. Warm up for 10 minutes."
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSchedule}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={styles.submitBtnText}>SCHEDULE WORKOUT</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Workout Sessions</Text>
        <Text style={styles.subtitle}>Schedule joint workouts & track check-ins.</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {[
          { key: TABS.UPCOMING, label: `Upcoming (${upcoming.length})` },
          { key: TABS.INVITES, label: `Invites (${invites.length})` },
          { key: TABS.SCHEDULE, label: 'Schedule' },
          { key: TABS.HISTORY, label: 'History' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {successMsg && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{successMsg}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : activeTab === TABS.SCHEDULE ? (
        renderScheduleTab()
      ) : (
        <FlatList
          data={getListData()}
          renderItem={renderSessionItem}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {activeTab === TABS.UPCOMING
                  ? 'No scheduled workouts. Create one in the Schedule tab!'
                  : activeTab === TABS.INVITES
                  ? 'No pending workout invitations.'
                  : 'No workout session history.'}
              </Text>
            </View>
          }
        />
      )}
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
    marginBottom: SPACING.sm,
  },
  backLink: {
    marginBottom: SPACING.sm,
  },
  backLinkText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: SPACING.xs,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  tabTextActive: {
    color: COLORS.text,
  },
  errorBanner: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderRadius: 8,
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
  errorText: {
    color: COLORS.accent,
    fontSize: 13,
    textAlign: 'center',
  },
  successBanner: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    borderColor: COLORS.success,
    borderWidth: 1,
  },
  successText: {
    color: COLORS.success,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 40,
    flexGrow: 1,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sessionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  statusTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusTag_pending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: COLORS.warning,
    borderWidth: 1,
  },
  statusTag_confirmed: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  statusTag_completed: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: COLORS.success,
    borderWidth: 1,
  },
  statusTag_cancelled: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
  statusTag_missed: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    borderColor: COLORS.textMuted,
    borderWidth: 1,
  },
  statusText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '800',
  },
  sessionDetails: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 4,
  },
  sessionNotes: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
    padding: SPACING.sm,
    borderRadius: 8,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  declineBtn: {
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  acceptBtn: {
    backgroundColor: COLORS.success,
  },
  cancelBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
  actionBtnText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 13,
  },
  formContainer: {
    paddingHorizontal: SPACING.lg,
    flex: 1,
  },
  formLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectItem: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  selectItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  selectItemText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  selectItemTextActive: {
    color: COLORS.primary,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: SPACING.sm + 2,
    color: COLORS.text,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  typeBtnActive: {
    borderColor: COLORS.secondary,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  typeBtnText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  typeBtnTextActive: {
    color: COLORS.secondary,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: 40,
  },
  submitBtnText: {
    color: COLORS.text,
    fontWeight: '850',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  navigateBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 10,
    marginTop: SPACING.md,
  },
  navigateBtnText: {
    color: COLORS.text,
    fontWeight: '800',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

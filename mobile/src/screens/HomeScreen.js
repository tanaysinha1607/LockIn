import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { COLORS, SPACING } from '../theme/theme';
import { userApi, authApi, checkInApi, notificationApi, getAccessToken } from '../utils/api';
import { connectSocket, registerSocketListener } from '../utils/socket';
import { registerForPushNotifications } from '../utils/push';
import { takePendingRoute } from '../utils/notificationRoutes';
import { getCurrentCoords } from '../utils/location';

export default function HomeScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [accountability, setAccountability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkInDone, setCheckInDone] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInVerified, setCheckInVerified] = useState(null); // true / false / null (unknown)
  const [checkInError, setCheckInError] = useState(null); // { message, code }
  const [lastPosition, setLastPosition] = useState(null); // position used for the last attempt

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUserData();

    // Live updates (new notifications) need the socket even if Chat was never opened
    const token = getAccessToken();
    if (token) connectSocket(token);
    registerForPushNotifications();

    // Open a push the user tapped while the app was starting
    const pending = takePendingRoute();
    if (pending) navigation.navigate(pending.name, pending.params);

    return registerSocketListener('notification:new', () => setUnreadCount((c) => c + 1));
  }, []);

  useFocusEffect(
    useCallback(() => {
      notificationApi.unreadCount().then((res) => {
        if (res.success) setUnreadCount(res.data.unreadCount);
      });
    }, [])
  );

  const fetchUserData = async () => {
    setLoading(true);
    const result = await userApi.getMe();
    setLoading(false);
    
    if (result.success && result.data) {
      setUser(result.data.user);
      setProfile(result.data.profile);
      setAccountability(result.data.accountability || null);
      setCheckInDone(Boolean(result.data.accountability?.todayCheckedIn));
    }
  };

  const submitCheckIn = async (position, locationErr) => {
    const result = await checkInApi.create(
      position ? { location: { coordinates: position.coordinates, accuracy: position.accuracy } } : {}
    );

    if (result.success && result.data) {
      setCheckInDone(true);
      setCheckInVerified(Boolean(result.data.checkIn?.isVerified));
      setCheckInError(null);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              xp: result.data.profile?.xp ?? prev.xp,
              level: result.data.profile?.level ?? prev.level,
              consistencyScore: result.data.profile?.consistencyScore ?? prev.consistencyScore,
            }
          : prev
      );
      setAccountability(result.data.summary || accountability);
      return;
    }

    if (result.code === 'LOCATION_REQUIRED' && locationErr) {
      // Server needs GPS; explain the device-side reason (permission off, timeout, ...)
      setCheckInError({ message: locationErr.message, code: result.code });
    } else if (result.code) {
      setCheckInError({ message: result.message, code: result.code });
    } else if (result.statusCode === 400 && /already checked in/i.test(result.message || '')) {
      await fetchUserData();
    } else {
      setCheckInError({ message: result.message || 'Check-in failed. Please try again.', code: null });
    }
  };

  const handleCheckIn = async () => {
    setCheckInLoading(true);
    setCheckInError(null);

    let position = null;
    let locationErr = null;
    try {
      position = await getCurrentCoords();
    } catch (err) {
      locationErr = err;
    }
    setLastPosition(position);

    await submitCheckIn(position, locationErr);
    setCheckInLoading(false);
  };

  // Shown after a TOO_FAR_FROM_GYM rejection: the user says they've switched gyms
  const handleMoveGymHere = async () => {
    if (!lastPosition) return;
    setCheckInLoading(true);
    const moved = await userApi.updateGymLocation({ coordinates: lastPosition.coordinates });
    if (moved.success) {
      setProfile((prev) => (prev ? { ...prev, gymLocation: moved.data?.profile?.gymLocation } : prev));
      await submitCheckIn(lastPosition, null);
    } else {
      setCheckInError({ message: moved.message, code: 'GYM_MOVE_FAILED' });
    }
    setCheckInLoading(false);
  };


  const handleLogout = async () => {
    await authApi.logout();
    navigation.replace('Login');
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const currentLevel = profile?.level || 1;
  const currentXP = profile?.xp || 0;
  const xpNeeded = currentLevel * 1000;
  const xpPercentage = Math.min((currentXP / xpNeeded) * 100, 100);
  const currentStreak = accountability?.streak?.currentStreak ?? 0;
  const weeklyPct = accountability?.metrics?.weeklyAttendancePct ?? 0;
  const monthlyPct = accountability?.metrics?.monthlyAttendancePct ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user?.firstName || 'Gym Buddy'}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel={`Notifications, ${unreadCount} unread`}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Level & Gamification Card */}
      <TouchableOpacity 
        style={styles.levelCard}
        onPress={() => navigation.navigate('Profile')}
        activeOpacity={0.8}
      >
        <View style={styles.levelHeader}>
          <Text style={styles.levelTitle}>LEVEL {currentLevel}</Text>
          <Text style={styles.xpText}>{currentXP} / {xpNeeded} XP</Text>
        </View>
        <View style={styles.xpBar}>
          <View style={[styles.xpIndicator, { width: `${xpPercentage}%` }]} />
        </View>
        <Text style={styles.levelGoal}>Gain {(xpNeeded - currentXP)} XP more to level up! (View Badges →)</Text>
      </TouchableOpacity>

      {/* Daily Accountability check-in */}
      <View style={styles.checkInCard}>
        <Text style={styles.sectionTitle}>Daily Accountability</Text>
        <Text style={styles.sectionDesc}>
          Check in from your gym to keep your streak alive — we confirm it with your location.
        </Text>
        
        {checkInDone ? (
          <View style={styles.checkInSuccess}>
            <Text style={styles.successText}>
              {checkInVerified === false ? '✓ Checked in (location not verified)' : '✓ Checked in at your gym'}
            </Text>
          </View>
        ) : (
          <>
          {checkInError && (
            <View style={styles.checkInErrorBox}>
              <Text style={styles.checkInErrorText}>{checkInError.message}</Text>
              {checkInError.code === 'TOO_FAR_FROM_GYM' && lastPosition && (
                <TouchableOpacity onPress={handleMoveGymHere} disabled={checkInLoading}>
                  <Text style={styles.checkInErrorLink}>
                    Switched gyms? Make this my gym and check in (once per week)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <TouchableOpacity 
            style={styles.checkInButton} 
            onPress={handleCheckIn}
            disabled={checkInLoading}
          >
            {checkInLoading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.checkInButtonText}>
                {checkInError ? 'TRY AGAIN' : 'CHECK-IN AT GYM'}
              </Text>
            )}
          </TouchableOpacity>
          </>
        )}
      </View>

      {/* Grid of options */}
      <View style={styles.grid}>
        <TouchableOpacity 
          style={[styles.gridItem, { borderColor: COLORS.primary, marginRight: 4, marginLeft: 0 }]}
          onPress={() => navigation.navigate('Buddy')}
        >
          <Text style={styles.gridEmoji}>🤝</Text>
          <Text style={styles.gridTitle}>Match</Text>
          <Text style={styles.gridDesc}>Find buddies.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.gridItem, { borderColor: COLORS.secondary, marginRight: 4, marginLeft: 4 }]}
          onPress={() => navigation.navigate('ChatList')}
        >
          <Text style={styles.gridEmoji}>💬</Text>
          <Text style={styles.gridTitle}>Chat</Text>
          <Text style={styles.gridDesc}>Message buddies.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.gridItem, { borderColor: COLORS.gold, marginRight: 0, marginLeft: 4 }]}
          onPress={() => navigation.navigate('AICoach')}
        >
          <Text style={styles.gridEmoji}>🤖</Text>
          <Text style={styles.gridTitle}>AI Coach</Text>
          <Text style={styles.gridDesc}>Workout plans.</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.grid, { marginTop: -4, marginBottom: SPACING.md }]}>
        <TouchableOpacity 
          style={[styles.gridItem, { borderColor: COLORS.primary, marginRight: 4, marginLeft: 0 }]}
          onPress={() => navigation.navigate('Sessions')}
        >
          <Text style={styles.gridEmoji}>📅</Text>
          <Text style={styles.gridTitle}>Sessions</Text>
          <Text style={styles.gridDesc}>Workout together.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.gridItem, { borderColor: COLORS.accent, marginRight: 4, marginLeft: 4 }]}
          onPress={() => navigation.navigate('Challenges')}
        >
          <Text style={styles.gridEmoji}>🏆</Text>
          <Text style={styles.gridTitle}>Challenges</Text>
          <Text style={styles.gridDesc}>Earn XP & badges.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.gridItem, { borderColor: COLORS.success, marginRight: 0, marginLeft: 4 }]}
          onPress={() => navigation.navigate('Leaderboard')}
        >
          <Text style={styles.gridEmoji}>🥇</Text>
          <Text style={styles.gridTitle}>Leaderboard</Text>
          <Text style={styles.gridDesc}>Compare ranks.</Text>
        </TouchableOpacity>
      </View>

      {/* Consistency Statistics */}
      <View style={styles.statsCard}>
        <Text style={styles.sectionTitle}>LockIn Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{profile?.consistencyScore || 0}%</Text>
            <Text style={styles.statLabel}>Consistency</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{currentStreak}</Text>
            <Text style={styles.statLabel}>Active Streak</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{profile?.gymName ? '1' : '0'}</Text>
            <Text style={styles.statLabel}>Gym Linked</Text>
          </View>
        </View>

        <View style={[styles.statsRow, { marginTop: SPACING.md }]}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{weeklyPct}%</Text>
            <Text style={styles.statLabel}>Weekly</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{monthlyPct}%</Text>
            <Text style={styles.statLabel}>Monthly</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingTop: 60,
    paddingBottom: 40,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  greeting: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  name: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '900',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellButton: {
    marginRight: SPACING.sm,
    padding: SPACING.xs,
  },
  bellIcon: {
    fontSize: 22,
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '800',
  },
  logoutButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
  },
  logoutText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  levelCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  levelTitle: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
  xpText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  xpBar: {
    height: 8,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 4,
    marginBottom: SPACING.sm,
  },
  xpIndicator: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  levelGoal: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  checkInCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  sectionDesc: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: SPACING.md,
  },
  checkInButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  checkInButtonText: {
    color: COLORS.text,
    fontWeight: '800',
    letterSpacing: 1,
  },
  checkInErrorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  checkInErrorText: {
    color: COLORS.text,
    fontSize: 14,
  },
  checkInErrorLink: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: SPACING.sm,
  },
  checkInSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: COLORS.success,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  successText: {
    color: COLORS.success,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  gridItem: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.md,
    marginRight: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  gridEmoji: {
    fontSize: 28,
    marginBottom: SPACING.sm,
  },
  gridTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  gridDesc: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  statsCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.sm,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    color: COLORS.secondary,
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
});

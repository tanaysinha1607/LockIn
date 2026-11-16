import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { COLORS, SPACING } from '../theme/theme';
import { userApi, authApi, checkInApi } from '../utils/api';

export default function HomeScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [accountability, setAccountability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkInDone, setCheckInDone] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

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

  const handleCheckIn = async () => {
    setCheckInLoading(true);
    const result = await checkInApi.create();
    setCheckInLoading(false);

    if (result.success && result.data) {
      setCheckInDone(true);
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
    } else if (!result.success) {
      // If backend rejects duplicate, reflect current state by reloading.
      await fetchUserData();
    }
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
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
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
        <Text style={styles.sectionDesc}>Verify your gym attendance today to keep your streak alive.</Text>
        
        {checkInDone ? (
          <View style={styles.checkInSuccess}>
            <Text style={styles.successText}>✓ Check-In Verified</Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.checkInButton} 
            onPress={handleCheckIn}
            disabled={checkInLoading}
          >
            {checkInLoading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.checkInButtonText}>CHECK-IN AT GYM</Text>
            )}
          </TouchableOpacity>
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

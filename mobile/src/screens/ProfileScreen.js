import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../theme/theme';
import { userApi, badgeApi } from '../utils/api';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [accountability, setAccountability] = useState(null);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const loadProfileData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setErrorMsg(null);

    const [userRes, badgesRes] = await Promise.all([
      userApi.getMe(),
      badgeApi.listAll(),
    ]);

    if (showLoader) setLoading(false);
    setRefreshing(false);

    if (userRes.success && userRes.data) {
      setUser(userRes.data.user);
      setProfile(userRes.data.profile);
      setAccountability(userRes.data.accountability || null);
    } else {
      setErrorMsg(userRes.message || 'Failed to load profile details');
    }

    if (badgesRes.success && badgesRes.data) {
      setBadges(badgesRes.data.badges || []);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProfileData(false);
  };

  const renderBadgeItem = ({ item }) => {
    const earnedDate = item.earnedAt
      ? new Date(item.earnedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: '2-digit',
        })
      : null;

    return (
      <View style={[styles.badgeCard, !item.isUnlocked && styles.badgeCardLocked]}>
        <View style={[styles.badgeIconBg, !item.isUnlocked && styles.badgeIconBgLocked]}>
          <Text style={[styles.badgeIcon, !item.isUnlocked && styles.badgeIconLocked]}>
            {item.icon || '🏅'}
          </Text>
        </View>
        <Text style={styles.badgeName}>{item.name}</Text>
        <Text style={styles.badgeDescription}>{item.description}</Text>
        <Text style={styles.badgeXp}>+{item.xpReward} XP</Text>
        
        {item.isUnlocked ? (
          <Text style={styles.badgeStatusEarned}>Earned {earnedDate}</Text>
        ) : (
          <Text style={styles.badgeStatusLocked}>Locked</Text>
        )}
      </View>
    );
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
  const totalCheckIns = accountability?.streak?.totalCheckIns ?? 0;
  const currentStreak = accountability?.streak?.currentStreak ?? 0;
  const longestStreak = accountability?.streak?.longestStreak ?? 0;

  const unlockedCount = badges.filter(b => b.isUnlocked).length;

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>Level, accomplishments, and achievements.</Text>
      </View>

      {errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* User Info Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarTextLarge}>{user?.firstName?.[0] || '?'}</Text>
        </View>
        <Text style={styles.profileName}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.profileBio}>{profile?.bio || 'No bio set. Write something in settings!'}</Text>
        <Text style={styles.profileGym}>📍 {profile?.gymName || 'No gym linked'}</Text>
      </View>

      {/* Level and XP */}
      <View style={styles.statsCard}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelTitle}>LEVEL {currentLevel}</Text>
          <Text style={styles.xpText}>{currentXP} / {xpNeeded} XP</Text>
        </View>
        <View style={styles.xpBar}>
          <View style={[styles.xpIndicator, { width: `${xpPercentage}%` }]} />
        </View>
        <Text style={styles.levelGoal}>Gain {(xpNeeded - currentXP)} XP to reach Level {currentLevel + 1}!</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{currentStreak} days</Text>
          <Text style={styles.statLbl}>Current Streak</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{longestStreak} days</Text>
          <Text style={styles.statLbl}>Longest Streak</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{totalCheckIns}</Text>
          <Text style={styles.statLbl}>Total Check-Ins</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{profile?.consistencyScore || 0}%</Text>
          <Text style={styles.statLbl}>Consistency</Text>
        </View>
      </View>

      {/* Badges Section */}
      <View style={styles.badgesSection}>
        <View style={styles.badgeHeaderRow}>
          <Text style={styles.sectionTitle}>Badges & Milestones</Text>
          <Text style={styles.badgeCountText}>
            {unlockedCount} / {badges.length} Unlocked
          </Text>
        </View>

        <FlatList
          data={badges}
          renderItem={renderBadgeItem}
          keyExtractor={(item) => String(item._id)}
          numColumns={2}
          scrollEnabled={false}
          columnWrapperStyle={styles.badgeRow}
        />
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
    marginBottom: SPACING.lg,
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
  errorBanner: {
    marginBottom: SPACING.md,
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
  profileCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: COLORS.primary,
    borderWidth: 2,
    marginBottom: SPACING.sm,
  },
  avatarTextLarge: {
    color: COLORS.primary,
    fontSize: 32,
    fontWeight: '800',
  },
  profileName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  profileBio: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  profileGym: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: SPACING.sm,
  },
  statsCard: {
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statVal: {
    color: COLORS.secondary,
    fontSize: 18,
    fontWeight: '900',
  },
  statLbl: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  badgesSection: {
    marginBottom: 20,
  },
  badgeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  badgeCountText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  badgeRow: {
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  badgeCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
    minHeight: 180,
  },
  badgeCardLocked: {
    opacity: 0.5,
    borderColor: COLORS.surfaceLight,
  },
  badgeIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: COLORS.gold,
    borderWidth: 1.5,
    marginBottom: SPACING.sm,
  },
  badgeIconBgLocked: {
    borderColor: COLORS.border,
    backgroundColor: 'rgba(25, 25, 35, 0.5)',
  },
  badgeIcon: {
    fontSize: 28,
  },
  badgeIconLocked: {
    opacity: 0.3,
  },
  badgeName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  badgeDescription: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    flex: 1,
  },
  badgeXp: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  badgeStatusEarned: {
    color: COLORS.success,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  badgeStatusLocked: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
});

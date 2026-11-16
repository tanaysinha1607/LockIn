import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../theme/theme';
import { leaderboardApi } from '../utils/api';

const FILTERS = {
  GLOBAL: 'global',
  BUDDY: 'buddy',
};

const SORT_OPTIONS = {
  XP: 'xp',
  STREAK: 'streak',
};

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen({ navigation }) {
  const [filter, setFilter] = useState(FILTERS.GLOBAL);
  const [sortBy, setSortBy] = useState(SORT_OPTIONS.XP);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const loadLeaderboard = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setErrorMsg(null);

    const result = await leaderboardApi.get(filter, sortBy);

    if (showLoader) setLoading(false);
    setRefreshing(false);

    if (result.success) {
      setLeaderboard(result.data?.leaderboard || []);
    } else {
      setErrorMsg(result.message || 'Failed to load leaderboard.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadLeaderboard();
    }, [filter, sortBy])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadLeaderboard(false);
  };

  const renderUserRow = ({ item, index }) => {
    const rank = index + 1;
    const isTop3 = rank <= 3;
    const medal = isTop3 ? MEDAL_EMOJIS[index] : null;

    return (
      <View style={[styles.rowCard, isTop3 && styles.rowCardTop3]}>
        {/* Rank */}
        <View style={[styles.rankContainer, isTop3 && styles.rankContainerTop3]}>
          {medal ? (
            <Text style={styles.medalEmoji}>{medal}</Text>
          ) : (
            <Text style={styles.rankNumber}>#{rank}</Text>
          )}
        </View>

        {/* Avatar */}
        <View style={[styles.avatar, isTop3 && styles.avatarTop3]}>
          <Text style={[styles.avatarText, isTop3 && styles.avatarTextTop3]}>
            {item.firstName?.[0] || '?'}
          </Text>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, isTop3 && styles.userNameTop3]}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={styles.userLevel}>Level {item.level}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsColumn}>
          <Text style={[styles.statPrimary, sortBy === SORT_OPTIONS.XP && styles.statHighlighted]}>
            {item.xp?.toLocaleString() || 0} XP
          </Text>
          <Text style={[styles.statSecondary, sortBy === SORT_OPTIONS.STREAK && styles.statHighlightedSecondary]}>
            🔥 {item.streak || 0} day{item.streak !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>See how you rank against the community.</Text>
      </View>

      {/* Filter Toggle */}
      <View style={styles.controlsRow}>
        <View style={styles.toggleGroup}>
          {[
            { key: FILTERS.GLOBAL, label: '🌍 Global' },
            { key: FILTERS.BUDDY, label: '🤝 Buddies' },
          ].map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.toggleBtn, filter === opt.key && styles.toggleBtnActive]}
              onPress={() => setFilter(opt.key)}
            >
              <Text style={[styles.toggleText, filter === opt.key && styles.toggleTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.toggleGroup}>
          {[
            { key: SORT_OPTIONS.XP, label: '✨ XP' },
            { key: SORT_OPTIONS.STREAK, label: '🔥 Streak' },
          ].map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortBtn, sortBy === opt.key && styles.sortBtnActive]}
              onPress={() => setSortBy(opt.key)}
            >
              <Text style={[styles.sortText, sortBy === opt.key && styles.sortTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          renderItem={renderUserRow}
          keyExtractor={(item, index) => String(item._id || index)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListHeaderComponent={
            leaderboard.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>
                  {filter === FILTERS.GLOBAL ? 'Top 100 Athletes' : 'Your Buddy Circle'}
                </Text>
                <Text style={styles.listHeaderCount}>
                  {leaderboard.length} {leaderboard.length === 1 ? 'athlete' : 'athletes'}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🏅</Text>
              <Text style={styles.emptyTitle}>
                {filter === FILTERS.BUDDY
                  ? 'No buddies yet'
                  : 'No one on the board yet'}
              </Text>
              <Text style={styles.emptyText}>
                {filter === FILTERS.BUDDY
                  ? 'Match with gym buddies to see them here!'
                  : 'Check in at the gym to be the first on the leaderboard.'}
              </Text>
              {filter === FILTERS.BUDDY && (
                <TouchableOpacity
                  style={styles.navigateBtn}
                  onPress={() => navigation.navigate('Buddy')}
                >
                  <Text style={styles.navigateBtnText}>Find Gym Buddies</Text>
                </TouchableOpacity>
              )}
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
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: COLORS.primary,
  },
  toggleText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: COLORS.primary,
  },
  sortBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  sortBtnActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: COLORS.secondary,
  },
  sortText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  sortTextActive: {
    color: COLORS.secondary,
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
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 40,
    flexGrow: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  listHeaderText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
  },
  listHeaderCount: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: SPACING.sm + 2,
    marginBottom: SPACING.sm,
  },
  rowCardTop3: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(251, 191, 36, 0.04)',
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankContainerTop3: {
    width: 36,
  },
  medalEmoji: {
    fontSize: 22,
  },
  rankNumber: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  avatarTop3: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  avatarText: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '800',
  },
  avatarTextTop3: {
    color: COLORS.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  userNameTop3: {
    color: COLORS.text,
    fontWeight: '900',
  },
  userLevel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  statsColumn: {
    alignItems: 'flex-end',
  },
  statPrimary: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },
  statHighlighted: {
    color: COLORS.secondary,
  },
  statSecondary: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  statHighlightedSecondary: {
    color: COLORS.warning,
  },
  empty: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  navigateBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.xl,
  },
  navigateBtnText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
  },
});

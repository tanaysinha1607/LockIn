import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../theme/theme';
import { challengeApi } from '../utils/api';

const TABS = {
  DISCOVER: 'discover',
  MY: 'my',
};

const formatChallengeType = (type) => {
  if (type === 'streak') return 'Solo Streak';
  if (type === 'check_in_count') return 'Consistency Count';
  if (type === 'lock_in_count') return 'Co-op Buddy Lock-In';
  if (type === 'buddy_vs_buddy') return 'Buddy VS Buddy';
  return type || 'General';
};

export default function ChallengesScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState(TABS.DISCOVER);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [discoverChallenges, setDiscoverChallenges] = useState([]);
  const [joinedChallenges, setJoinedChallenges] = useState([]);
  
  // Leaderboard Modal state
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const loadChallenges = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const [discoverRes, joinedRes] = await Promise.all([
      challengeApi.list(),
      challengeApi.listMy(),
    ]);

    if (showLoader) setLoading(false);
    setRefreshing(false);

    if (discoverRes.success) {
      // Filter out challenges already joined from discover
      const joinedIds = new Set((joinedRes.data?.participations || []).map(p => String(p.challengeId?._id || p.challengeId)));
      const unjoined = (discoverRes.data?.challenges || []).filter(c => !joinedIds.has(String(c.challenge?._id || c._id)));
      setDiscoverChallenges(unjoined);
    } else {
      setErrorMsg(discoverRes.message || 'Failed to load challenges.');
    }

    if (joinedRes.success) {
      setJoinedChallenges(joinedRes.data?.participations || []);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadChallenges(false);
  };

  const handleJoin = async (challengeId) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = await challengeApi.join(challengeId);
    if (result.success) {
      setSuccessMsg('Successfully joined challenge! Track your progress.');
      setActiveTab(TABS.MY);
      await loadChallenges(false);
    } else {
      setErrorMsg(result.message);
    }
  };

  const openLeaderboard = async (challenge) => {
    setSelectedChallenge(challenge);
    setLoadingLeaderboard(true);
    setLeaderboard([]);

    const challengeId = challenge._id || challenge.challengeId?._id || challenge.challengeId;
    const result = await challengeApi.getLeaderboard(challengeId);
    setLoadingLeaderboard(false);

    if (result.success) {
      setLeaderboard(result.data?.leaderboard || []);
    } else {
      setErrorMsg(result.message || 'Failed to load leaderboard.');
    }
  };

  const renderDiscoverItem = ({ item }) => {
    const chall = item.challenge || item;
    const start = new Date(chall.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = new Date(chall.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.challTitle}>{chall.title}</Text>
          <View style={styles.typeTag}>
            <Text style={styles.typeText}>{formatChallengeType(chall.type).toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.challDesc}>{chall.description}</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>⏱️ {chall.duration} Days ({start} - {end})</Text>
          <Text style={styles.infoText}>🎯 Target: {chall.target}</Text>
        </View>

        <View style={styles.rewardsBox}>
          <Text style={styles.rewardsTitle}>Completion Rewards:</Text>
          <Text style={styles.rewardsText}>✨ +{chall.rewards?.xp || 0} XP</Text>
          {chall.rewards?.badgeId?.name || chall.rewards?.badgeId ? (
            <Text style={styles.rewardsText}>🏅 Exclusive Badge Reward</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.joinBtn}
          onPress={() => handleJoin(chall._id)}
        >
          <Text style={styles.joinBtnText}>JOIN CHALLENGE</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderJoinedItem = ({ item }) => {
    const chall = item.challengeId || {};
    const start = new Date(chall.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = new Date(chall.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const progressPct = Math.min(Math.round((item.progress / item.target) * 100), 100);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.challTitle}>{chall.title || 'Challenge'}</Text>
          <View style={[styles.statusTag, styles[`statusTag_${item.status}`]]}>
            <Text style={styles.statusText}>{item.status.toUpperCase().replace('_', ' ')}</Text>
          </View>
        </View>

        <Text style={styles.challDesc}>{chall.description}</Text>

        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress: {item.progress} / {item.target}</Text>
            <Text style={styles.progressLabel}>{progressPct}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressIndicator, { width: `${progressPct}%` }]} />
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoText}>⏱️ {start} - {end}</Text>
          <Text style={styles.infoText}>✨ Rewards: +{chall.rewards?.xp || 0} XP</Text>
        </View>

        <TouchableOpacity
          style={[styles.joinBtn, { backgroundColor: COLORS.surfaceLight, borderColor: COLORS.border, borderWidth: 1 }]}
          onPress={() => openLeaderboard(item)}
        >
          <Text style={[styles.joinBtnText, { color: COLORS.secondary }]}>📊 VIEW LEADERBOARD</Text>
        </TouchableOpacity>
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
        <Text style={styles.title}>Challenges</Text>
        <Text style={styles.subtitle}>Test your consistency, earn rewards.</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {[
          { key: TABS.DISCOVER, label: `Discover (${discoverChallenges.length})` },
          { key: TABS.MY, label: `Joined (${joinedChallenges.length})` },
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
      ) : (
        <FlatList
          data={activeTab === TABS.DISCOVER ? discoverChallenges : joinedChallenges}
          renderItem={activeTab === TABS.DISCOVER ? renderDiscoverItem : renderJoinedItem}
          keyExtractor={(item) => String(item._id || item.challengeId?._id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {activeTab === TABS.DISCOVER
                  ? 'No new challenges available right now. Check back later!'
                  : 'You have not joined any challenges yet. Discover and join one!'}
              </Text>
            </View>
          }
        />
      )}

      {/* Leaderboard Modal */}
      <Modal
        visible={!!selectedChallenge}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedChallenge(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Challenge Scoreboard</Text>
              <TouchableOpacity onPress={() => setSelectedChallenge(null)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {selectedChallenge?.challengeId?.title || 'Challenge Rankings'}
            </Text>

            {loadingLeaderboard ? (
              <ActivityIndicator color={COLORS.primary} size="large" style={{ margin: 40 }} />
            ) : (
              <FlatList
                data={leaderboard}
                keyExtractor={(item, index) => String(item.userId?._id || index)}
                renderItem={({ item, index }) => (
                  <View style={styles.leaderRow}>
                    <Text style={styles.leaderRank}>#{index + 1}</Text>
                    <View style={styles.leaderUser}>
                      <Text style={styles.leaderName}>
                        {item.userId?.firstName} {item.userId?.lastName}
                      </Text>
                    </View>
                    <Text style={styles.leaderProgress}>
                      {item.progress} / {item.target}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyLeader}>No rankings available yet.</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>
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
    gap: 8,
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
    fontSize: 12,
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
    marginBottom: SPACING.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  challTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '850',
    flex: 1,
  },
  typeTag: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderColor: COLORS.secondary,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 5,
  },
  typeText: {
    color: COLORS.secondary,
    fontSize: 9,
    fontWeight: '800',
  },
  statusTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusTag_in_progress: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  statusTag_completed: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: COLORS.success,
    borderWidth: 1,
  },
  statusTag_failed: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
  statusText: {
    color: COLORS.text,
    fontSize: 9,
    fontWeight: '800',
  },
  challDesc: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  infoText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  rewardsBox: {
    backgroundColor: COLORS.surfaceLight,
    padding: SPACING.sm + 2,
    borderRadius: 8,
    marginBottom: SPACING.md,
  },
  rewardsTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  rewardsText: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  joinBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
  },
  joinBtnText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  progressContainer: {
    marginBottom: SPACING.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 4,
  },
  progressIndicator: {
    height: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    padding: SPACING.lg,
    borderColor: COLORS.border,
    borderTopWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
  },
  closeBtn: {
    color: COLORS.textMuted,
    fontSize: 18,
    fontWeight: '800',
    padding: 4,
  },
  modalSubtitle: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '750',
    marginBottom: SPACING.md,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  leaderRank: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: '900',
    width: 35,
  },
  leaderUser: {
    flex: 1,
  },
  leaderName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  leaderProgress: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyLeader: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    margin: SPACING.xl,
  },
});

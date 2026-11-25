import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../theme/theme';
import { matchApi, buddyApi } from '../utils/api';
import { FITNESS_LEVEL_LABELS, FITNESS_GOAL_LABELS } from '../constants/fitnessConstants';

const TABS = {
  DISCOVER: 'discover',
  REQUESTS: 'requests',
  BUDDIES: 'buddies',
};

const formatLevel = (level) =>
  FITNESS_LEVEL_LABELS[level] || (level ? level.charAt(0).toUpperCase() + level.slice(1) : '—');

const formatGoals = (goals = []) =>
  goals.slice(0, 3).map((g) => FITNESS_GOAL_LABELS[g] || g.replace(/_/g, ' '));

export default function BuddyScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState(TABS.DISCOVER);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [suggestions, setSuggestions] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [activeMatches, setActiveMatches] = useState([]);
  const [requestStatus, setRequestStatus] = useState({});
  const [respondingId, setRespondingId] = useState(null);

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setErrorMsg(null);

    const [suggestionsRes, incomingRes, activeRes] = await Promise.all([
      matchApi.getSuggestions(),
      buddyApi.getIncoming(),
      buddyApi.getActiveMatches(),
    ]);

    if (showLoader) setLoading(false);
    setRefreshing(false);

    if (suggestionsRes.success) {
      setSuggestions(suggestionsRes.data?.suggestions || []);
    } else if (activeTab === TABS.DISCOVER) {
      setErrorMsg(suggestionsRes.message);
    }

    if (incomingRes.success) {
      setIncoming(incomingRes.data?.requests || []);
    }

    if (activeRes.success) {
      setActiveMatches(activeRes.data?.matches || []);
    }

    if (!suggestionsRes.success && !incomingRes.success && !activeRes.success) {
      setErrorMsg(suggestionsRes.message || 'Failed to load buddy data');
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

  const handleConnect = async (receiverId) => {
    setRequestStatus((prev) => ({ ...prev, [receiverId]: 'sending' }));

    const result = await buddyApi.sendRequest(receiverId);

    if (result.success) {
      setRequestStatus((prev) => ({ ...prev, [receiverId]: 'sent' }));
      setSuggestions((prev) => prev.filter((s) => String(s.user._id) !== String(receiverId)));
    } else {
      setRequestStatus((prev) => ({ ...prev, [receiverId]: 'error' }));
      setErrorMsg(result.message);
    }
  };

  const handleRespond = async (requestId, status) => {
    setRespondingId(requestId);
    const result = await buddyApi.respondToRequest(requestId, status);
    setRespondingId(null);

    if (result.success) {
      await loadData(false);
    } else {
      setErrorMsg(result.message);
    }
  };

  const renderSuggestion = ({ item }) => {
    const userId = String(item.user._id);
    const status = requestStatus[userId];
    const name = `${item.user.firstName} ${item.user.lastName}`.trim();

    return (
      <View style={styles.card}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{item.compatibilityScore}% Match</Text>
        </View>

        <View style={styles.cardHeader}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{item.user.firstName?.[0] || '?'}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.buddyName}>{name}</Text>
            <Text style={styles.subtext}>
              {formatLevel(item.profile?.fitnessLevel)} • {item.distanceKm} km away
            </Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Gym:</Text>
            <Text style={styles.detailValue}>{item.profile?.gymName || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Consistency:</Text>
            <Text style={[styles.detailValue, { color: COLORS.success }]}>
              {item.profile?.consistencyScore ?? 0}%
            </Text>
          </View>
        </View>

        <View style={styles.goalsContainer}>
          {formatGoals(item.profile?.fitnessGoals).map((g, index) => (
            <View key={index} style={styles.goalTag}>
              <Text style={styles.goalText}>{g}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.connectButton,
            status === 'sending' && styles.connectButtonDisabled,
            status === 'sent' && styles.connectButtonSent,
            status === 'error' && styles.connectButtonError,
          ]}
          onPress={() => handleConnect(userId)}
          disabled={status === 'sending' || status === 'sent'}
        >
          {status === 'sending' ? (
            <ActivityIndicator color={COLORS.text} size="small" />
          ) : status === 'sent' ? (
            <Text style={styles.connectButtonText}>REQUEST SENT</Text>
          ) : status === 'error' ? (
            <Text style={styles.connectButtonText}>RETRY</Text>
          ) : (
            <Text style={styles.connectButtonText}>CONNECT BUDDY</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderIncoming = ({ item }) => {
    const sender = item.senderId;
    const name = sender ? `${sender.firstName} ${sender.lastName}`.trim() : 'Unknown';

    return (
      <View style={styles.card}>
        <Text style={styles.buddyName}>{name}</Text>
        <Text style={styles.subtext}>Wants to be your gym buddy</Text>
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRespond(item._id, 'rejected')}
            disabled={respondingId === item._id}
          >
            <Text style={styles.actionButtonText}>DECLINE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleRespond(item._id, 'accepted')}
            disabled={respondingId === item._id}
          >
            {respondingId === item._id ? (
              <ActivityIndicator color={COLORS.text} size="small" />
            ) : (
              <Text style={styles.actionButtonText}>ACCEPT</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderActiveMatch = ({ item }) => {
    const buddy = item.buddy?.user;
    const profile = item.buddy?.profile;
    const name = buddy ? `${buddy.firstName} ${buddy.lastName}`.trim() : 'Buddy';

    return (
      <View style={styles.card}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{item.compatibilityScore}% Match</Text>
        </View>
        <Text style={styles.buddyName}>{name}</Text>
        <Text style={styles.subtext}>{formatLevel(profile?.fitnessLevel)}</Text>
        <Text style={[styles.detailValue, { marginBottom: SPACING.sm, marginTop: 4 }]}>
          {profile?.gymName || 'Gym not set'}
        </Text>
        <Text style={styles.lockInLine}>
          🔒 {item.lockInStreak?.current || 0}-day LockIn streak · best {item.lockInStreak?.longest || 0} ·{' '}
          {item.lockInCount || 0} total
        </Text>
        {item.conversationId && (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() =>
              navigation.navigate('Chat', {
                conversationId: item.conversationId,
                buddyName: name,
                buddyId: buddy?._id,
                isOnline: false,
              })
            }
          >
            <Text style={styles.connectButtonText}>💬 CHAT BUDDY</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const listData =
    activeTab === TABS.DISCOVER
      ? suggestions
      : activeTab === TABS.REQUESTS
        ? incoming
        : activeMatches;

  const emptyMessage =
    activeTab === TABS.DISCOVER
      ? 'No buddy suggestions nearby. Complete your profile or check back later.'
      : activeTab === TABS.REQUESTS
        ? 'No pending requests.'
        : 'No active gym buddies yet. Connect with someone from Discover!';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Gym Buddies</Text>
        <Text style={styles.subtitle}>Matched by location, schedule, and goals.</Text>
      </View>

      <View style={styles.tabRow}>
        {[
          { key: TABS.DISCOVER, label: 'Discover' },
          { key: TABS.REQUESTS, label: `Requests${incoming.length ? ` (${incoming.length})` : ''}` },
          { key: TABS.BUDDIES, label: 'My Buddies' },
        ].map((tab) => (
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

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={listData}
          renderItem={
            activeTab === TABS.DISCOVER
              ? renderSuggestion
              : activeTab === TABS.REQUESTS
                ? renderIncoming
                : renderActiveMatch
          }
          keyExtractor={(item, index) =>
            String(item._id || item.user?._id || item.matchId || index)
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{emptyMessage}</Text>
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
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
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
    position: 'relative',
    overflow: 'hidden',
  },
  badgeContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderBottomLeftRadius: 12,
  },
  badgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    marginTop: SPACING.xs,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  avatarText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  headerInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  buddyName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtext: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  detailsContainer: {
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  detailLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  detailValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  goalsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.md,
  },
  goalTag: {
    backgroundColor: COLORS.surfaceLight,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  goalText: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  connectButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
  },
  connectButtonDisabled: {
    backgroundColor: COLORS.surfaceLight,
  },
  connectButtonSent: {
    backgroundColor: COLORS.success,
  },
  connectButtonError: {
    backgroundColor: COLORS.accent,
  },
  connectButtonText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  requestActions: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  rejectButton: {
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  acceptButton: {
    backgroundColor: COLORS.success,
  },
  actionButtonText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 13,
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
  },
  lockInLine: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
});

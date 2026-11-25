import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../theme/theme';
import { feedApi } from '../utils/api';

const DEFAULT_REACTIONS = ['🔥', '💪', '👏', '🔒', '😤'];
const PAGE = 30;

const timeAgo = (iso) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Icon + one-line description for each kind of activity.
 */
const describe = (item) => {
  const who = item.isMine ? 'You' : item.actor.firstName;
  const m = item.metadata || {};
  switch (item.action) {
    case 'check_in':
      return {
        icon: '🏋️',
        text: `${who} checked in at the gym`,
        sub: m.currentStreak > 1 ? `🔥 ${m.currentStreak}-day streak` : null,
      };
    case 'lock_in': {
      const other = item.buddyIsMe ? 'you' : item.buddyName;
      return {
        icon: '🔒',
        text: `${who} locked in with ${other || 'a buddy'}`,
        sub: m.lockInStreak > 1 ? `${m.lockInStreak}-day LockIn streak` : 'LockIn streak started',
      };
    }
    case 'badge_earned':
      return { icon: m.badgeIcon || '🏅', text: `${who} earned the “${m.badgeName}” badge`, sub: null };
    case 'challenge_completed':
      return { icon: '🏆', text: `${who} completed “${m.challengeTitle}”`, sub: null };
    case 'workout_logged': {
      const parts = [];
      if (m.totalSets) parts.push(`${m.totalSets} sets`);
      if (m.totalVolume) parts.push(`${m.totalVolume >= 1000 ? `${(m.totalVolume / 1000).toFixed(1)}t` : `${m.totalVolume}kg`} lifted`);
      if (m.durationMin) parts.push(`${m.durationMin} min`);
      return {
        icon: '📝',
        text: `${who} logged a workout${m.topExercises?.length ? `: ${m.topExercises.join(', ')}` : ''}`,
        sub: parts.join(' · ') || null,
      };
    }
    default:
      return { icon: '⚡', text: `${who} was active`, sub: null };
  }
};

export default function FeedScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [emojis, setEmojis] = useState(DEFAULT_REACTIONS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const load = async () => {
    const res = await feedApi.get(null, PAGE);
    setLoading(false);
    setRefreshing(false);
    if (res.success) {
      setItems(res.data.items);
      setHasMore(res.data.hasMore);
      if (res.data.reactions?.length) setEmojis(res.data.reactions);
      setErrorMsg(null);
    } else {
      setErrorMsg(res.message || 'Could not load the feed.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const loadMore = async () => {
    if (!hasMore || loadingMore || !items.length) return;
    setLoadingMore(true);
    const res = await feedApi.get(items[items.length - 1].createdAt, PAGE);
    setLoadingMore(false);
    if (res.success) {
      setItems((prev) => [...prev, ...res.data.items.filter((n) => !prev.some((p) => p._id === n._id))]);
      setHasMore(res.data.hasMore);
    }
  };

  const toggleReaction = async (item, emoji) => {
    const next = item.myReaction === emoji ? null : emoji;
    // Optimistic update
    setItems((prev) =>
      prev.map((it) => {
        if (it._id !== item._id) return it;
        const counts = { ...it.reactions };
        if (it.myReaction) counts[it.myReaction] = Math.max(0, (counts[it.myReaction] || 1) - 1);
        if (next) counts[next] = (counts[next] || 0) + 1;
        return { ...it, reactions: counts, myReaction: next };
      })
    );
    const res = await feedApi.react(item._id, next);
    if (res.success) {
      setItems((prev) =>
        prev.map((it) => (it._id === item._id ? { ...it, reactions: res.data.counts, myReaction: res.data.mine } : it))
      );
    } else {
      load(); // resync
    }
  };

  const renderItem = ({ item }) => {
    const d = describe(item);
    return (
      <View style={[styles.card, item.isMine && styles.cardMine]}>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.actor.firstName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.text}>
              <Text style={styles.icon}>{d.icon} </Text>
              {d.text}
            </Text>
            {d.sub && <Text style={styles.sub}>{d.sub}</Text>}
            <Text style={styles.time}>
              {timeAgo(item.createdAt)}
              {item.xp > 0 ? ` · +${item.xp} XP` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.reactionRow}>
          {emojis.map((e) => {
            const count = item.reactions?.[e] || 0;
            const mine = item.myReaction === e;
            return (
              <TouchableOpacity
                key={e}
                style={[styles.reaction, mine && styles.reactionMine]}
                onPress={() => toggleReaction(item, e)}
              >
                <Text style={styles.reactionText}>
                  {e}
                  {count > 0 ? ` ${count}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Buddy Feed</Text>
        <Text style={styles.subtitle}>Check-ins, lock-ins, workouts and wins from you and your buddies.</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, i) => String(it._id || i)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>
                {errorMsg || 'Nothing here yet. Check in, log a workout, or connect with a buddy to fill your feed.'}
              </Text>
              {!errorMsg && (
                <TouchableOpacity onPress={() => navigation.navigate('Buddy')}>
                  <Text style={styles.emptyLink}>Find a gym buddy →</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.primary} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingTop: 60, paddingBottom: SPACING.md },
  back: { color: COLORS.primary, fontSize: 14, fontWeight: '700', marginBottom: SPACING.sm },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: COLORS.textMuted, fontSize: 14, marginTop: SPACING.xs },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardMine: { borderColor: 'rgba(139, 92, 246, 0.4)' },
  row: { flexDirection: 'row' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceLight,
    borderColor: COLORS.primary,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: { color: COLORS.text, fontWeight: '800' },
  icon: { fontSize: 15 },
  text: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  sub: { color: COLORS.secondary, fontSize: 13, marginTop: 2 },
  time: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  reactionRow: { flexDirection: 'row', marginTop: SPACING.sm, flexWrap: 'wrap' },
  reaction: {
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 3,
    paddingHorizontal: 9,
    marginRight: 6,
    marginTop: 4,
  },
  reactionMine: { borderColor: COLORS.primary, backgroundColor: 'rgba(139, 92, 246, 0.2)' },
  reactionText: { color: COLORS.text, fontSize: 13 },
  empty: { alignItems: 'center', marginTop: SPACING.xxl, paddingHorizontal: SPACING.lg },
  emptyIcon: { fontSize: 40, marginBottom: SPACING.md },
  emptyText: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center' },
  emptyLink: { color: COLORS.secondary, fontWeight: '700', marginTop: SPACING.md },
});

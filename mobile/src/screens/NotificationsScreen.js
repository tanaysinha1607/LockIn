import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../theme/theme';
import { notificationApi } from '../utils/api';
import { registerSocketListener } from '../utils/socket';
import { routeForNotification, NOTIFICATION_ICONS } from '../utils/notificationRoutes';
import { getPushStatus, registerForPushNotifications } from '../utils/push';

const PAGE_SIZE = 30;

const timeAgo = (iso) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function NotificationsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [pushCheck, setPushCheck] = useState(null); // dev diagnostics result
  const [testing, setTesting] = useState(false);

  // Development only: re-register this device, ask the server to push to it, show the outcome
  const runPushTest = async () => {
    setTesting(true);
    await registerForPushNotifications();
    const device = getPushStatus();
    const res = await notificationApi.testPush();
    setTesting(false);
    const server = res.success
      ? res.data.sent > 0
        ? `Server: Expo accepted ${res.data.sent} of ${res.data.deviceCount} device(s). Lock your phone - a banner should arrive within a few seconds.`
        : `Server: ${res.data.deviceCount} device(s) registered, none accepted. ${(res.data.errors || []).join(' ')}`
      : `Server error: ${res.message}`;
    setPushCheck(`Phone: ${device.message}\n${server}`);
  };

  const load = async () => {
    const res = await notificationApi.list(null, PAGE_SIZE);
    if (res.success) {
      setItems(res.data.notifications);
      setUnread(res.data.unreadCount);
      setHasMore(res.data.notifications.length === PAGE_SIZE);
      setErrorMsg(null);
    } else {
      setErrorMsg(res.message || 'Could not load notifications.');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  // New notifications arrive live while this screen is open
  useEffect(
    () =>
      registerSocketListener('notification:new', (doc) => {
        setItems((prev) => (prev.some((n) => n._id === doc._id) ? prev : [doc, ...prev]));
        setUnread((u) => u + 1);
      }),
    []
  );

  const loadMore = async () => {
    if (!hasMore || loadingMore || items.length === 0) return;
    setLoadingMore(true);
    const res = await notificationApi.list(items[items.length - 1].createdAt, PAGE_SIZE);
    if (res.success) {
      setItems((prev) => [...prev, ...res.data.notifications]);
      setHasMore(res.data.notifications.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  };

  const open = async (item) => {
    if (!item.isRead) {
      setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
      notificationApi.markRead(item._id);
    }
    const route = routeForNotification(item.type, item.data);
    if (route) navigation.navigate(route.name, route.params);
  };

  const markAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    await notificationApi.markAllRead();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={[styles.item, !item.isRead && styles.itemUnread]} onPress={() => open(item)}>
      <Text style={styles.icon}>{NOTIFICATION_ICONS[item.type] || '🔔'}</Text>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemText}>{item.body}</Text>
        <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
      </View>
      {!item.isRead && <View style={styles.dot} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← BACK</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Notifications</Text>
          <TouchableOpacity onPress={() => navigation.navigate('NotificationSettings')} accessibilityLabel="Notification settings">
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
        {unread > 0 && (
          <TouchableOpacity onPress={markAll} style={styles.markAllRow}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
        {__DEV__ && (
          <View style={styles.devBox}>
            <TouchableOpacity onPress={runPushTest} disabled={testing}>
              <Text style={styles.devButton}>{testing ? 'Testing push…' : '🛠 Send me a test push'}</Text>
            </TouchableOpacity>
            {pushCheck && <Text style={styles.devText}>{pushCheck}</Text>}
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n._id)}
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
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>
                {errorMsg || 'Nothing yet. Buddy requests, session invites, badges and challenge results show up here.'}
              </Text>
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
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '900' },
  devBox: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  devButton: { color: COLORS.warning, fontWeight: '700', fontSize: 13 },
  devText: { color: COLORS.textMuted, fontSize: 12, marginTop: SPACING.xs },
  settingsIcon: { fontSize: 22 },
  markAllRow: { alignSelf: 'flex-end', marginTop: SPACING.xs },
  markAll: { color: COLORS.secondary, fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  itemUnread: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceLight },
  icon: { fontSize: 24, marginRight: SPACING.md },
  itemBody: { flex: 1 },
  itemTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  itemText: { color: COLORS.textMuted, fontSize: 14, marginTop: 2 },
  itemTime: { color: COLORS.textMuted, fontSize: 12, marginTop: SPACING.xs },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, marginLeft: SPACING.sm, marginTop: 6 },
  empty: { alignItems: 'center', marginTop: SPACING.xxl, paddingHorizontal: SPACING.lg },
  emptyIcon: { fontSize: 40, marginBottom: SPACING.md },
  emptyText: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center' },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING } from '../theme/theme';
import { chatApi } from '../utils/api';
import { connectSocket, registerSocketListener } from '../utils/socket';

export default function ChatListScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadCurrentUserId();
    loadConversations();
    let cleanupSocket;

    setupSocket().then((cleanup) => {
      cleanupSocket = cleanup;
    });

    const unsubscribeFocus = navigation.addListener('focus', () => {
      loadConversations();
    });

    return () => {
      unsubscribeFocus();
      if (typeof cleanupSocket === 'function') cleanupSocket();
    };
  }, []);

  const loadCurrentUserId = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const decoded = JSON.parse(jsonPayload);
      setCurrentUserId(decoded.userId);
    } catch (err) {
      console.warn('Failed to parse access token for userId:', err);
    }
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredConversations(conversations);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = conversations.filter((c) => {
        const fullName = `${c.buddy?.firstName || ''} ${c.buddy?.lastName || ''}`.toLowerCase();
        return fullName.includes(query);
      });
      setFilteredConversations(filtered);
    }
  }, [searchQuery, conversations]);

  const setupSocket = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      connectSocket(token);

      const removeMsgListener = registerSocketListener('chat:message', (message) => {
        updateConversationFromMessage(message);
      });

      const removePresenceListener = registerSocketListener('presence:update', ({ userId, status }) => {
        updateBuddyPresence(userId, status);
      });

      const removeReadListener = registerSocketListener('chat:read', ({ conversationId }) => {
        resetUnreadCount(conversationId);
      });

      return () => {
        removeMsgListener();
        removePresenceListener();
        removeReadListener();
      };
    } catch (err) {
      console.warn('Error setting up socket inside ChatListScreen:', err);
    }
  };

  const loadConversations = async (showRefresher = false) => {
    if (showRefresher) setRefreshing(true);
    else setLoading(true);

    const result = await chatApi.getConversations();
    
    if (showRefresher) setRefreshing(false);
    else setLoading(false);

    if (result.success && result.data) {
      // Sort conversations so that most recent messages are on top
      const sorted = result.data.sort((a, b) => {
        const dateA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp) : new Date(0);
        const dateB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp) : new Date(0);
        return dateB - dateA;
      });
      setConversations(sorted);
    }
  };

  const updateConversationFromMessage = (message) => {
    const senderId = String(message.senderId?._id || message.senderId);

    setConversations((prev) => {
      const updated = prev.map((conv) => {
        if (String(conv._id) === String(message.conversationId)) {
          const currentUnread = conv.unreadCount || 0;
          const isFromBuddy = senderId === String(conv.buddy?._id);
          const isFromMe = currentUserId && senderId === String(currentUserId);

          return {
            ...conv,
            lastMessage: {
              content: message.content,
              senderId: message.senderId?._id || message.senderId,
              timestamp: message.createdAt,
              type: message.type,
            },
            unreadCount: isFromBuddy && !isFromMe ? currentUnread + 1 : currentUnread,
          };
        }
        return conv;
      });

      // Re-sort conversations
      return [...updated].sort((a, b) => {
        const dateA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp) : new Date(0);
        const dateB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp) : new Date(0);
        return dateB - dateA;
      });
    });
  };

  const updateBuddyPresence = (userId, status) => {
    setConversations((prev) =>
      prev.map((conv) => {
        if (String(conv.buddy?._id) === String(userId)) {
          return {
            ...conv,
            buddy: {
              ...conv.buddy,
              lastActive: status === 'online' ? new Date() : conv.buddy?.lastActive,
            },
          };
        }
        return conv;
      })
    );
  };

  const resetUnreadCount = (conversationId) => {
    setConversations((prev) =>
      prev.map((conv) => {
        if (String(conv._id) === String(conversationId)) {
          return {
            ...conv,
            unreadCount: 0,
          };
        }
        return conv;
      })
    );
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    
    // Check if today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // Other date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderConversationItem = ({ item }) => {
    const buddy = item.buddy;
    const unread = item.unreadCount || 0;

    const lastActiveTime = buddy?.lastActive ? new Date(buddy.lastActive) : null;
    const isOnline = lastActiveTime && (new Date() - lastActiveTime < 5 * 60 * 1000);

    return (
      <TouchableOpacity
        style={styles.chatCard}
        onPress={() => {
          navigation.navigate('Chat', {
            conversationId: item._id,
            buddyName: `${buddy?.firstName || ''} ${buddy?.lastName || ''}`.trim(),
            buddyId: buddy?._id,
            isOnline,
          });
        }}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{buddy?.firstName?.[0] || '?'}</Text>
          </View>
          {isOnline && <View style={styles.onlineIndicator} />}
        </View>

        {/* Conversation details */}
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.buddyName} numberOfLines={1}>
              {buddy?.firstName} {buddy?.lastName}
            </Text>
            <Text style={styles.timestamp}>
              {formatTime(item.lastMessage?.timestamp)}
            </Text>
          </View>

          <View style={styles.chatBody}>
            <Text
              style={[
                styles.lastMsg,
                unread > 0 ? styles.lastMsgUnread : null
              ]}
              numberOfLines={1}
            >
              {item.lastMessage?.content || 'No messages yet. Send a greeting!'}
            </Text>
            
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Gym Buddies</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search matches..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item._id}
        renderItem={renderConversationItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadConversations(true)}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>No conversation history</Text>
            <Text style={styles.emptySubtext}>
              Once you accept a buddy request, you'll be able to chat and plan workouts here.
            </Text>
            <TouchableOpacity
              style={styles.findBuddyButton}
              onPress={() => navigation.navigate('Buddy')}
            >
              <Text style={styles.findBuddyButtonText}>FIND GYM BUDDIES</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: 10,
    borderColor: COLORS.border,
    borderWidth: 1,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  chatCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.surfaceLight,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  buddyName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    maxWidth: '70%',
  },
  timestamp: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  chatBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMsg: {
    color: COLORS.textMuted,
    fontSize: 13,
    maxWidth: '85%',
  },
  lastMsgUnread: {
    color: COLORS.text,
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: SPACING.xl,
  },
  emptyEmoji: {
    fontSize: 50,
    marginBottom: SPACING.md,
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  findBuddyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  findBuddyButtonText: {
    color: COLORS.text,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

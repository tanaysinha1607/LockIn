import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING } from '../theme/theme';
import { chatApi } from '../utils/api';
import {
  connectSocket,
  registerSocketListener,
  emitSocketEvent,
  getSocket,
} from '../utils/socket';

export default function ChatScreen({ route, navigation }) {
  const { conversationId, buddyName, buddyId, isOnline: initialOnline } = route.params;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isBuddyOnline, setIsBuddyOnline] = useState(initialOnline);
  const [isBuddyTyping, setIsBuddyTyping] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    initChat();
    setupSocket();

    return () => {
      // Mark read when leaving
      if (socketRef.current) {
        socketRef.current.emit('chat:read', { conversationId });
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const initChat = async () => {
    setLoading(true);
    // Find current user's ID from token or locally (for aligning messages)
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (token) {
        // Simple JWT decode to find userId
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
      }
    } catch (e) {
      console.warn('Failed to parse access token for userId:', e);
    }

    // Load initial messages
    const result = await chatApi.getMessages(conversationId);
    setLoading(false);
    
    if (result.success && result.data) {
      setMessages(result.data);
      if (result.data.length < 50) {
        setHasMore(false);
      }
      
      // Trigger mark as read
      await chatApi.markAsRead(conversationId);
    }
  };

  const setupSocket = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (token) {
        const socket = connectSocket(token);
        socketRef.current = socket;

        // Emit read on open
        socket.emit('chat:read', { conversationId });

        // Listen for new messages
        const removeMsgListener = registerSocketListener('chat:message', (message) => {
          if (String(message.conversationId) === String(conversationId)) {
            setMessages((prev) => {
              const messageId = String(message._id);
              if (prev.some((m) => String(m._id) === messageId)) {
                return prev;
              }
              return [message, ...prev];
            });

            socket.emit('chat:read', { conversationId });
          }
        });

        // Listen for typing indicator
        const removeTypingListener = registerSocketListener('chat:typing', (data) => {
          if (String(data.conversationId) === String(conversationId) && String(data.userId) === String(buddyId)) {
            setIsBuddyTyping(true);
          }
        });

        const removeStopTypingListener = registerSocketListener('chat:stop_typing', (data) => {
          if (String(data.conversationId) === String(conversationId) && String(data.userId) === String(buddyId)) {
            setIsBuddyTyping(false);
          }
        });

        // Listen for presence changes
        const removePresenceListener = registerSocketListener('presence:update', ({ userId, status }) => {
          if (String(userId) === String(buddyId)) {
            setIsBuddyOnline(status === 'online');
          }
        });

        // Fetch official online status directly on join
        socket.emit('presence:check', buddyId, (response) => {
          if (response && response.status) {
            setIsBuddyOnline(response.status === 'online');
          }
        });

        return () => {
          removeMsgListener();
          removeTypingListener();
          removeStopTypingListener();
          removePresenceListener();
        };
      }
    } catch (err) {
      console.warn('Error configuring socket in ChatScreen:', err);
    }
  };

  const loadMoreMessages = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;

    setLoadingMore(true);
    const oldestMessage = messages[messages.length - 1];
    const result = await chatApi.getMessages(conversationId, oldestMessage.createdAt);
    setLoadingMore(false);

    if (result.success && result.data) {
      if (result.data.length < 50) {
        setHasMore(false);
      }
      setMessages((prev) => [...prev, ...result.data]);
    }
  };

  const handleSend = () => {
    if (inputText.trim() === '') return;

    const content = inputText.trim();
    setInputText('');
    
    // Stop typing immediately
    sendStopTyping();

    // Send via socket.io
    emitSocketEvent('chat:send', { conversationId, content, type: 'text' }, (response) => {
      if (!response || !response.success) {
        console.warn('Failed to send message via socket, retrying via REST');
        // Fallback to REST API
        chatApi.sendMessage(conversationId, content);
      }
    });
  };

  const handleTextChange = (text) => {
    setInputText(text);

    // Handle typing events emission (throttled)
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      if (socketRef.current) {
        socketRef.current.emit('chat:typing', { conversationId });
      }
    }

    // Debounce stop typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendStopTyping();
    }, 3000);
  };

  const sendStopTyping = () => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      if (socketRef.current) {
        socketRef.current.emit('chat:stop_typing', { conversationId });
      }
    }
  };

  const formatMessageDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessageItem = ({ item, index }) => {
    const sender = item.senderId;
    const isMe = String(sender?._id || sender) === String(currentUserId);
    
    // Show dates dynamically between messages if they change days
    const showDateHeader = shouldShowDateHeader(item, index);

    return (
      <View>
        {showDateHeader && (
          <View style={styles.dateHeaderContainer}>
            <Text style={styles.dateHeaderText}>
              {getDateHeaderText(item.createdAt)}
            </Text>
          </View>
        )}
        <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowBuddy]}>
          <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleBuddy]}>
            <Text style={[styles.messageText, isMe ? styles.textMe : styles.textBuddy]}>
              {item.content}
            </Text>
            <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeBuddy]}>
              {formatMessageDate(item.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const shouldShowDateHeader = (item, index) => {
    if (index === messages.length - 1) return true; // Show date header for oldest message
    const nextMessage = messages[index + 1];
    if (!nextMessage) return false;

    const currentDate = new Date(item.createdAt).toDateString();
    const nextDate = new Date(nextMessage.createdAt).toDateString();
    return currentDate !== nextDate;
  };

  const getDateHeaderText = (createdAt) => {
    const date = new Date(createdAt);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) return 'Today';

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Chat Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.buddyNameText} numberOfLines={1}>
              {buddyName}
            </Text>
            <View style={styles.presenceContainer}>
              <View
                style={[
                  styles.presenceDot,
                  { backgroundColor: isBuddyOnline ? COLORS.success : COLORS.textMuted },
                ]}
              />
              <Text style={styles.presenceText}>
                {isBuddyOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        {/* Messages List */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessageItem}
          inverted
          contentContainerStyle={styles.messagesList}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.2}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 10 }} />
            ) : null
          }
        />

        {/* Typing Indicator */}
        {isBuddyTyping && (
          <View style={styles.typingIndicatorContainer}>
            <Text style={styles.typingIndicatorText}>{buddyName} is typing...</Text>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            maxHeight={100}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              inputText.trim() === '' ? styles.sendButtonDisabled : null
            ]}
            onPress={handleSend}
            disabled={inputText.trim() === ''}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    paddingRight: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flex: 1,
  },
  buddyNameText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  presenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  presenceText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  messagesList: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowBuddy: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 16,
    maxWidth: '75%',
  },
  bubbleMe: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 2,
  },
  bubbleBuddy: {
    backgroundColor: COLORS.surfaceLight,
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  textMe: {
    color: COLORS.text,
  },
  textBuddy: {
    color: COLORS.text,
  },
  msgTime: {
    fontSize: 9,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  msgTimeMe: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  msgTimeBuddy: {
    color: COLORS.textMuted,
  },
  dateHeaderContainer: {
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  dateHeaderText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
    overflow: 'hidden',
  },
  typingIndicatorContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  typingIndicatorText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 15,
    marginRight: SPACING.md,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 14,
  },
});

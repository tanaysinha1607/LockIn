/**
 * Where tapping a notification (in the list or a phone push) should take the user.
 * @returns {{ name: string, params?: object } | null}
 */
export const routeForNotification = (type, data = {}) => {
  switch (type) {
    case 'message':
    case 'buddy_accepted':
      if (data.conversationId) {
        return {
          name: 'Chat',
          params: {
            conversationId: String(data.conversationId),
            buddyId: data.buddyId ? String(data.buddyId) : undefined,
            buddyName: data.buddyName || 'Buddy',
          },
        };
      }
      return { name: 'ChatList' };
    case 'buddy_request':
      return { name: 'Buddy' };
    case 'buddy_check_in':
    case 'buddy_nudge':
      return { name: 'Home' };
    case 'weekly_recap':
      return { name: 'WeeklyRecap', params: { week: data.week || 'current' } };
    case 'session_reminder':
    case 'lock_in':
      return { name: 'Sessions' };
    case 'badge_earned':
      return { name: 'Profile' };
    case 'challenge_update':
      return { name: 'Challenges' };
    default:
      return null;
  }
};

// A push tapped before the user reached Home (cold start, still on Splash) is parked here
// and opened by Home once the session is ready.
let pendingRoute = null;
export const setPendingRoute = (route) => {
  pendingRoute = route;
};
export const takePendingRoute = () => {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
};

export const NOTIFICATION_ICONS = {
  buddy_request: '🤝',
  buddy_accepted: '🔒',
  message: '💬',
  session_reminder: '📅',
  lock_in: '🔥',
  badge_earned: '🏅',
  challenge_update: '🏆',
  check_in_reminder: '⏰',
  streak_alert: '⚡',
  motivation: '💪',
  buddy_check_in: '💪',
  buddy_nudge: '👊',
  weekly_recap: '📊',
};

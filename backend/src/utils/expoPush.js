const { logger } = require('./logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100; // Expo's per-request limit

const isExpoPushToken = (token) => typeof token === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(token);

/**
 * Sends push messages through Expo's push service (no SDK needed).
 * Never throws: push is best-effort and must not break the request that triggered it.
 *
 * @param {Array<{to: string, title: string, body: string, data?: object}>} messages
 * @returns {Promise<{ sent: number, invalidTokens: string[] }>} tokens Expo says are dead
 */
const sendExpoPush = async (messages, { fetchImpl = globalThis.fetch } = {}) => {
  const valid = messages.filter((m) => isExpoPushToken(m.to));
  const invalidTokens = [];
  let sent = 0;

  if (process.env.PUSH_ENABLED === 'false' || valid.length === 0) return { sent, invalidTokens };

  const headers = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
    ...(process.env.EXPO_ACCESS_TOKEN && { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }),
  };

  for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
    const chunk = valid.slice(i, i + CHUNK_SIZE).map((m) => ({ sound: 'default', ...m }));
    try {
      const res = await fetchImpl(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(chunk) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        logger.warn(`Expo push request failed (${res.status}): ${JSON.stringify(json.errors || json).slice(0, 300)}`);
        continue;
      }
      (json.data || []).forEach((ticket, idx) => {
        if (ticket.status === 'ok') sent += 1;
        else if (ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(chunk[idx].to);
        else logger.warn(`Expo push ticket error: ${ticket.message || ticket.details?.error}`);
      });
    } catch (err) {
      logger.warn(`Expo push send failed: ${err.message}`);
    }
  }

  return { sent, invalidTokens };
};

module.exports = { sendExpoPush, isExpoPushToken };

import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

/**
 * Snapshot a view as a PNG and open the share sheet (Instagram, WhatsApp, Photos...).
 * Falls back to sharing text if image sharing isn't available.
 * @returns {Promise<'image'|'text'>}
 */
export const shareViewAsImage = async (viewRef, fallbackText) => {
  try {
    const uri = await captureRef(viewRef, { format: 'png', quality: 1, result: 'tmpfile' });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your LockIn week' });
      return 'image';
    }
  } catch (err) {
    console.warn('Image share failed, sharing text instead:', err?.message || err);
  }
  await Share.share({ message: fallbackText });
  return 'text';
};

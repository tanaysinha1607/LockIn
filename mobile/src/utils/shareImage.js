// Web version (Metro uses shareImage.native.js on phones). Browsers can't reliably turn a
// React Native view into an image without extra libraries, so share or copy the text.
export const shareViewAsImage = async (_viewRef, fallbackText) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: 'My LockIn week', text: fallbackText });
      return 'text';
    }
  } catch {
    // user cancelled or not allowed; fall through to copy
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(fallbackText);
    return 'copied';
  }
  return 'unsupported';
};

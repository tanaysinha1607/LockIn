import { Platform } from 'react-native';
import * as Location from 'expo-location';

export class LocationError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new LocationError('Getting your location took too long.', 'TIMEOUT')), ms)
    ),
  ]);

/**
 * Asks for permission (if needed) and returns the device's position.
 * Works on iOS, Android and web (the browser shows its own permission prompt;
 * web needs https or localhost).
 *
 * @returns {Promise<{ coordinates: [number, number], accuracy: number|null }>} [longitude, latitude]
 * @throws {LocationError} with code SERVICES_OFF | PERMISSION_DENIED | TIMEOUT | UNAVAILABLE
 */
export const getCurrentCoords = async ({ timeoutMs = 15000 } = {}) => {
  if (Platform.OS !== 'web') {
    const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!enabled) {
      throw new LocationError('Location services are off. Turn them on in your phone settings.', 'SERVICES_OFF');
    }
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationError(
      Platform.OS === 'web'
        ? 'Location is blocked for this site. Allow it in your browser’s address bar, then try again.'
        : 'Location permission is off. Allow it for LockIn in your phone settings, then try again.',
      'PERMISSION_DENIED'
    );
  }

  let position;
  try {
    position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      timeoutMs
    );
  } catch (err) {
    // Indoors (e.g. inside a gym) a fresh fix can be slow; a fix from the last 2 minutes is fine
    if (Platform.OS !== 'web') {
      position = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000 }).catch(() => null);
    }
    if (!position) {
      throw err instanceof LocationError
        ? err
        : new LocationError('Couldn’t get your location. Move near a window and try again.', 'UNAVAILABLE');
    }
  }

  return {
    coordinates: [position.coords.longitude, position.coords.latitude],
    accuracy: Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null,
  };
};

/**
 * Best-effort street address for a point. Returns null on web or if lookup fails.
 */
export const describePlace = async ([longitude, latitude]) => {
  if (Platform.OS === 'web') return null;
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!place) return null;
    const parts = [place.name, place.street, place.district || place.subregion, place.city];
    return [...new Set(parts.filter(Boolean))].join(', ') || null;
  } catch {
    return null;
  }
};

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in metres between two [longitude, latitude] pairs.
 */
const distanceMeters = ([lon1, lat1], [lon2, lat2]) => {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isValidCoordinates = (coords) =>
  Array.isArray(coords) &&
  coords.length === 2 &&
  coords.every((n) => Number.isFinite(n)) &&
  Math.abs(coords[0]) <= 180 &&
  Math.abs(coords[1]) <= 90;

module.exports = { distanceMeters, isValidCoordinates };

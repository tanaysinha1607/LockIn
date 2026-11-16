const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Returns YYYY-MM-DD for the current day in UTC.
 */
const todayUTC = () => new Date().toISOString().slice(0, 10);

/**
 * Parses YYYY-MM-DD to a Date at UTC midnight.
 */
const parseUTCDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
};

/**
 * Formats a Date (assumed UTC) to YYYY-MM-DD.
 */
const formatUTCDate = (dt) => {
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
};

/**
 * Adds days to a YYYY-MM-DD string (in UTC) and returns YYYY-MM-DD.
 */
const addDaysUTC = (dateStr, days) => {
  const dt = parseUTCDate(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatUTCDate(dt);
};

/**
 * Difference in whole days between two YYYY-MM-DD strings (b - a).
 */
const diffDaysUTC = (a, b) => {
  const da = parseUTCDate(a);
  const db = parseUTCDate(b);
  const ms = db.getTime() - da.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
};

module.exports = {
  todayUTC,
  parseUTCDate,
  formatUTCDate,
  addDaysUTC,
  diffDaysUTC,
};

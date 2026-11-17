const Profile = require('../models/Profile');

const XP_PER_LEVEL = 1000;

/**
 * Level for a given XP total. Level N starts at (N - 1) * 1000 XP.
 * Never lowers an existing level.
 */
const calcLevel = (level, xp) => Math.max(Math.max(1, level || 1), Math.floor((xp || 0) / XP_PER_LEVEL) + 1);

/**
 * Atomically add XP to a user's profile and recompute their level in the same write.
 *
 * Read-modify-save (`profile.xp += n; profile.save()`) loses updates when two awards
 * land at the same time — e.g. a buddy's check-in completing a shared session while
 * you are checking in yourself. This uses a single pipeline update instead.
 *
 * @returns {Promise<Object|null>} the updated profile (lean), or null if no profile exists
 */
const awardXp = async (userId, amount) => {
  const inc = Number(amount) || 0;
  return Profile.findOneAndUpdate(
    { userId },
    [
      { $set: { xp: { $add: [{ $ifNull: ['$xp', 0] }, inc] } } },
      {
        $set: {
          level: {
            $max: [
              { $ifNull: ['$level', 1] },
              { $add: [{ $floor: { $divide: ['$xp', XP_PER_LEVEL] } }, 1] },
            ],
          },
        },
      },
    ],
    { new: true, lean: true }
  );
};

module.exports = {
  XP_PER_LEVEL,
  calcLevel,
  awardXp,
};

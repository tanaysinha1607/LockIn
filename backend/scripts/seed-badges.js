/**
 * Seeds only the system badges. `npm run seed` already does this;
 * kept for running it on its own: `npm run seed:badges`.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../src/config/database');
const badgeService = require('../src/services/badge.service');

async function run() {
  await connectDB();
  console.log('Connected to Database. Seeding badges...');
  const result = await badgeService.seedBadges();
  console.log(`Successfully seeded badges: ${result.seededCount} new badges created.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed to seed badges:', err);
  process.exit(1);
});

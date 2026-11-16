require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const connectDB = require('../src/config/database');
const badgeService = require('../src/services/badge.service');

async function run() {
  await connectDB();
  console.log('Connected to Database. Seeding badges...');
  const result = await badgeService.seedBadges();
  console.log(`Successfully seeded badges: ${result.seededCount} new badges created.`);
  process.exit(0);
}

run().catch(err => {
  console.error('Failed to seed badges:', err);
  process.exit(1);
});

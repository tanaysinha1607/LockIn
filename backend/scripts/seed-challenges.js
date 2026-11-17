/**
 * Seeds (or re-opens) only the default challenges. `npm run seed` already does this;
 * kept for running it on its own: `npm run seed:challenges`.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../src/config/database');
const { seedChallenges } = require('../src/jobs/seeders/challenges');

async function run() {
  await connectDB();
  console.log('Connected to Database. Seeding challenges...');
  const result = await seedChallenges();
  console.log(`Challenges: ${result.created} created, ${result.refreshed} re-opened.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed to seed challenges:', err);
  process.exit(1);
});

/**
 * Migration : convertit instruments de [String] vers [{ name, level }].
 * À lancer une fois après déploiement du nouveau schéma.
 *
 * Usage: node scripts/migrate-instruments-with-level.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Profile = require('../models/Profile');

const SKILL_LEVELS = ['Novice', 'Learner', 'Intermediate', 'Advanced', 'Master', 'Teacher'];

function normalizeInstruments(instruments) {
  if (!instruments || !Array.isArray(instruments)) return [];
  return instruments.map((item) => {
    if (typeof item === 'string') {
      return { name: item.trim(), level: 'Novice' };
    }
    if (item && typeof item === 'object' && item.name) {
      const level = SKILL_LEVELS.includes(item.level) ? item.level : 'Novice';
      return { name: String(item.name).trim(), level };
    }
    return null;
  }).filter((item) => item && item.name && item.name.trim());
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URL_DEV, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  const profiles = await Profile.find({});
  let updated = 0;
  for (const profile of profiles) {
    const raw = profile.toObject().instruments;
    if (!raw || !Array.isArray(raw)) continue;
    const hasOldFormat = raw.some((item) => typeof item === 'string');
    if (!hasOldFormat) continue;
    profile.instruments = normalizeInstruments(raw);
    await profile.save();
    updated++;
  }
  console.log(`Migrated ${updated} profile(s) (instruments with level).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

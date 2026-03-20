/**
 * Transfère / réconcilie tous les documents Match vers profile.matches.
 *
 * Usage :
 *   NODE_ENV=production node scripts/migrate-matches-into-profiles.js
 *   node scripts/migrate-matches-into-profiles.js
 *
 * Options :
 *   --orphans-only   Nettoie seulement les références orphelines sur les profils
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const {
  reconcileAllMatchesFromCollection,
  removeOrphanMatchRefsFromProfiles
} = require('../utils/matchProfileSync');

const orphansOnly = process.argv.includes('--orphans-only');

function getMongoUrl() {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && process.env.MONGODB_URL_PROD) return process.env.MONGODB_URL_PROD;
  if (!isProd && process.env.MONGODB_URL_DEV) return process.env.MONGODB_URL_DEV;
  return process.env.MONGODB_URL_PROD || process.env.MONGODB_URL_DEV;
}

async function run() {
  const mongoUrl = getMongoUrl();
  if (!mongoUrl) {
    console.error(
      'Aucune URL MongoDB : définir MONGODB_URL_PROD (et NODE_ENV=production) ou MONGODB_URL_DEV.'
    );
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  console.log('MongoDB connecté\n');

  if (!orphansOnly) {
    console.log('Synchronisation de tous les Match → profile.matches ...');
    const { processed, errors } = await reconcileAllMatchesFromCollection();
    console.log(`  → ${processed} match(s) traité(s).`);
    if (errors.length) {
      console.warn(`  → ${errors.length} erreur(s) :`);
      errors.slice(0, 20).forEach((e) => console.warn(`     - ${e.matchId}: ${e.message}`));
      if (errors.length > 20) console.warn(`     ... et ${errors.length - 20} autre(s).`);
    }
  } else {
    console.log('(--orphans-only) Sync Match ignorée.\n');
  }

  console.log('Nettoyage des références orphelines sur les profils ...');
  const { profilesUpdated, refsRemoved } = await removeOrphanMatchRefsFromProfiles();
  console.log(`  → ${profilesUpdated} profil(s) modifié(s), ${refsRemoved} référence(s) retirée(s).`);

  console.log('\nTerminé.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

const User = require('../models/User');
const { deleteUserCompletely } = require('../utils/deleteUserCompletely');

function getGraceMs() {
  const hours = Number.parseFloat(process.env.ONBOARDING_GRACE_HOURS, 10);
  const h = Number.isFinite(hours) && hours > 0 ? hours : 24;
  return h * 60 * 60 * 1000;
}

/**
 * Comptes dont l'onboarding n'est pas validé depuis plus longtemps que la fenêtre de grâce.
 */
async function findUsersToPurge() {
  const cutoff = new Date(Date.now() - getGraceMs());
  return User.find({
    onboardingValidated: { $ne: true },
    createdAt: { $lt: cutoff }
  })
    .select('_id')
    .lean();
}

/**
 * Supprime les comptes non validés après la durée configurée (défaut 24 h).
 * @returns {Promise<{ purged: number }>}
 */
async function runCleanupUnvalidatedUsers() {
  const users = await findUsersToPurge();
  let purged = 0;
  for (const u of users) {
    const { deleted } = await deleteUserCompletely(u._id);
    if (deleted) {
      purged += 1;
      console.log(`[cleanup] Compte non validé supprimé: ${u._id}`);
    }
  }
  if (purged > 0) {
    console.log(`[cleanup] Total comptes purgés: ${purged}`);
  }
  return { purged };
}

module.exports = {
  runCleanupUnvalidatedUsers,
  findUsersToPurge,
  getGraceMs
};

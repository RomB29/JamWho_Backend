const Profile = require('../models/Profile');
const Match = require('../models/Match');

/**
 * Copie un document Match dans profile.matches des deux utilisateurs
 * (matchId + otherUserId + dates). Idempotent.
 */
async function pushMatchToBothProfiles(match) {
  if (!match?._id || !match.users?.[1]) return;

  const [a, b] = match.users;
  const createdAt = match.createdAt || new Date();
  const lastMessageAt = match.lastMessageAt ?? createdAt;

  const upsert = async (userId, otherUserId) => {
    const p = await Profile.findOne({ userId });
    if (!p) return;

    const list = p.matches || [];
    const i = list.findIndex((x) => x.matchId?.toString() === match._id.toString());
    const row = { matchId: match._id, otherUserId, createdAt, lastMessageAt };

    if (i >= 0) list[i] = row;
    else list.push(row);

    p.matches = list;
    await p.save();
  };

  await upsert(a, b);
  await upsert(b, a);
}

async function pullMatchFromBothProfiles(matchId) {
  await Profile.updateMany(
    { 'matches.matchId': matchId },
    { $pull: { matches: { matchId } } }
  );
}

async function syncLastMessageAtOnProfiles(matchId, date = new Date()) {
  await Profile.updateMany(
    { 'matches.matchId': matchId },
    { $set: { 'matches.$[elem].lastMessageAt': date } },
    { arrayFilters: [{ 'elem.matchId': matchId }] }
  );
}

/** Migration : tous les Match → profils */
async function reconcileAllMatchesFromCollection() {
  const rows = await Match.find({}).lean();
  const errors = [];
  for (const m of rows) {
    try {
      await pushMatchToBothProfiles(m);
    } catch (e) {
      errors.push({ matchId: m._id, message: e.message });
    }
  }
  return { processed: rows.length, errors };
}

/** Supprime les entrées profil dont le Match n'existe plus */
async function removeOrphanMatchRefsFromProfiles() {
  const ok = new Set((await Match.find({}, { _id: 1 }).lean()).map((x) => x._id.toString()));
  let profilesUpdated = 0;
  let refsRemoved = 0;

  const profiles = await Profile.find({ 'matches.0': { $exists: true } });
  for (const p of profiles) {
    const before = p.matches.length;
    p.matches = p.matches.filter((e) => {
      const id = e.matchId?.toString();
      const keep = id && ok.has(id);
      if (!keep && id) refsRemoved += 1;
      return keep;
    });
    if (p.matches.length !== before) {
      await p.save();
      profilesUpdated += 1;
    }
  }
  return { profilesUpdated, refsRemoved };
}

module.exports = {
  pushMatchToBothProfiles,
  pullMatchFromBothProfiles,
  syncLastMessageAtOnProfiles,
  reconcileAllMatchesFromCollection,
  removeOrphanMatchRefsFromProfiles
};

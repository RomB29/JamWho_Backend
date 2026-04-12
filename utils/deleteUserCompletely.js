const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const User = require('../models/User');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Swipe = require('../models/Swipe');
const { pullMatchFromBothProfiles } = require('./matchProfileSync');

const PUBLIC_PROFILE_BASE = path.join(__dirname, '..', 'PUBLIC_UPLOAD', 'profile');


function removeUserUploadDir(userIdStr) {
  const dir = path.join(PUBLIC_PROFILE_BASE, userIdStr);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    console.error('[deleteUser] Fichiers:', dir, e.message);
  }
}

/**
 * Supprime un utilisateur et toutes ses données (profil, matchs, messages, notifs, fichiers, compte).
 * Retire aussi l'utilisateur des listes des autres profils (likes, blocages, etc.).
 *
 * @param {import('mongoose').Types.ObjectId | string} userId
 * @returns {Promise<{ deleted: boolean }>}
 */
async function deleteUserCompletely(userId) {
  const uid =
    userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(String(userId));
  const uidStr = uid.toString();

  const user = await User.findById(uid);
  if (!user) {
    return { deleted: false };
  }

  const matches = await Match.find({ users: uid }).select('_id').lean();
  for (const m of matches) {
    await pullMatchFromBothProfiles(m._id);
  }
  await Match.deleteMany({ users: uid });

  await Profile.updateMany(
    {},
    {
      $pull: {
        likedUsers: uid,
        whoLikedMe: uid,
        blockedUsers: uid
      }
    }
  );

  await Profile.updateMany(
    { 'dailyMessages.profiles.profileId': uid },
    { $pull: { 'dailyMessages.profiles': { profileId: uid } } }
  );

  await Profile.updateMany(
    { 'matches.otherUserId': uid },
    { $pull: { matches: { otherUserId: uid } } }
  );

  await Message.deleteMany({
    $or: [{ senderId: uid }, { receiverId: uid }]
  });

  await Notification.deleteMany({
    $or: [{ userId: uid }, { actorId: uid }]
  });

  await Swipe.deleteMany({
    $or: [{ userId: uid }, { targetUserId: uid }]
  });

  await Profile.deleteOne({ userId: uid });

  removeUserUploadDir(uidStr);

  await User.deleteOne({ _id: uid });

  return { deleted: true };
}

module.exports = {
  deleteUserCompletely,
  removeUserUploadDir
};
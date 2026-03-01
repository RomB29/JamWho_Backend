const Notification = require('../models/Notification');

/**
 * Crée une notification pour l'utilisateur cible.
 * Utilisé à l'envoi d'un message, d'un like ou d'un match (prêt pour push mobile plus tard).
 *
 * @param {Object} options
 * @param {import('mongoose').Types.ObjectId} options.userId - Utilisateur qui reçoit la notification
 * @param {import('mongoose').Types.ObjectId} options.actorId - Utilisateur à l'origine (expéditeur, liker, autre user du match)
 * @param {'message'|'like'|'match'} options.type - Type de notification
 * @param {import('mongoose').Types.ObjectId} [options.relatedId] - messageId, matchId, etc.
 * @param {string} [options.conversationId] - Pour type 'message'
 * @param {string} [options.title] - Titre pour push
 * @param {string} [options.body] - Corps pour push
 */
async function createNotification({ userId, actorId, type, relatedId = null, conversationId = null, title = null, body = null }) {
  let relatedModel = null;
  if (type === 'message' && relatedId) relatedModel = 'Message';
  if (type === 'match' && relatedId) relatedModel = 'Match';

  const notif = new Notification({
    userId,
    actorId,
    type,
    relatedId: relatedId || undefined,
    relatedModel: relatedModel || undefined,
    conversationId: conversationId || undefined,
    title: title || undefined,
    body: body || undefined
  });
  await notif.save();
  return notif;
}

module.exports = { createNotification };

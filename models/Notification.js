const mongoose = require('mongoose');

/**
 * Modèle de notification pour message, like et match.
 * Conçu pour afficher les notifs dans l'app et pour les push notifications mobiles plus tard.
 */
const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['message', 'like', 'match']
  },
  /** Utilisateur à l'origine de l'action (qui a envoyé le message, liké, ou avec qui c'est un match) */
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  /** ID lié selon le type: messageId (message), null (like), matchId (match) */
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedModel',
    default: null
  },
  relatedModel: {
    type: String,
    enum: ['Message', 'Match', null],
    default: null
  },
  /** Pour les messages: conversationId pour redirection */
  conversationId: {
    type: String,
    default: null
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  /** Titre optionnel pour push (ex: "Nouveau message") */
  title: {
    type: String,
    default: null
  },
  /** Corps optionnel pour push (ex: "Jean: Salut !") */
  body: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: false // Gardé pour compatibilité, mais conversationId est maintenant prioritaire
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index pour améliorer les performances
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ matchId: 1, createdAt: -1 }); // Gardé pour compatibilité
messageSchema.index({ receiverId: 1, read: 1 });
messageSchema.index({ conversationId: 1, receiverId: 1, read: 1 }); // Pour les requêtes optimisées

module.exports = mongoose.model('Message', messageSchema);


const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['like', 'dislike'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index composite pour éviter les doublons et améliorer les performances
swipeSchema.index({ userId: 1, targetUserId: 1 }, { unique: true });
swipeSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('Swipe', swipeSchema);


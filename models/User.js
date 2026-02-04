const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 4
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+$/, 'Email invalide']
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Le mot de passe n'est requis que si pas de connexion Google
    },
    minlength: 6
  },
  googleId: {
    type: String,
    sparse: true, // Permet plusieurs null mais un seul non-null
    unique: true
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  stripeCustomerId: {
    type: String,
    default: null
  },
  stripeSubscriptionId: {
    type: String,
    default: null
  },
  premiumExpiresAt: {
    type: Date,
    default: null
  },
  newLike: {
    type: Number,
    default: 0
  },
  messageUnread: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash le mot de passe avant de sauvegarder
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Synchronise le statut premium avec la date d'expiration.
 * Si isPremium est true mais premiumExpiresAt est dépassée, passe isPremium à false
 * et nettoie stripeSubscriptionId / premiumExpiresAt (stripeCustomerId conservé).
 * @param {import('mongoose').Document} user - Document utilisateur (doit avoir isPremium et premiumExpiresAt chargés)
 * @returns {Promise<boolean>} - true si l'utilisateur est premium actif, false sinon
 */
userSchema.statics.syncPremiumIfExpired = async function(user) {
  if (!user || !user.isPremium) return !!user?.isPremium;
  if (!user.premiumExpiresAt) return true; // pas de date = actif (renouvellement automatique)
  const now = new Date();
  if (user.premiumExpiresAt > now) return true; // pas encore expiré
  user.isPremium = false;
  user.stripeSubscriptionId = null;
  user.premiumExpiresAt = null;
  await user.save();
  return false;
};

module.exports = mongoose.model('User', userSchema);


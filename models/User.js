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
  premiumStartedAt: {
    type: Date,
    default: null
  },
  premiumPlanType: {
    type: String,
    default: null,
    enum: [null, 'weekly', 'monthly']
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
 * Vérifie la date de fin d'abonnement (premiumExpiresAt vs now).
 * Si la date de fin est dépassée, l'utilisateur perd le statut premium.
 * À appeler avant toute lecture de isPremium pour garantir un statut à jour.
 *
 * @param {import('mongoose').Document} user - Document utilisateur (doit avoir isPremium et premiumExpiresAt chargés)
 * @returns {Promise<boolean>} - true si l'utilisateur est premium actif, false sinon
 */
userSchema.statics.syncPremiumIfExpired = async function(user) {
  if (!user || !user.isPremium) return !!user?.isPremium;
  if (!user.premiumExpiresAt) return true; // pas de date = actif (renouvellement automatique)

  const now = new Date();
  // Date de fin vs now : si la date de fin est dépassée, on retire le premium
  if (user.premiumExpiresAt > now) return true;

  user.isPremium = false;
  user.stripeSubscriptionId = null;
  user.premiumExpiresAt = null;
  user.premiumStartedAt = null;
  user.premiumPlanType = null;
  await user.save();
  return false;
};

module.exports = mongoose.model('User', userSchema);


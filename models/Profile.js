const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['youtube', 'mp3', 'soundcloud'],
    required: true
  },
  url: {
    type: String,
    required: true
  },
  filename: {
    type: String,
    default: null // Nom original du fichier uploadé (null pour youtube/soundcloud)
  }
}, { _id: false });

const profileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  pseudo: {
    type: String,
    required: true,
    trim: true,
    minlength: [4, 'Le pseudo doit contenir entre 4 et 20 caractères'],
    maxlength: [20, 'Le pseudo doit contenir entre 4 et 20 caractères']
  },
  age: {
    type: Number,
    required: true,
    min: 18,
    max: 100
  },
  sexe: {
    type: String,
    enum: ['homme', 'femme', 'autre'],
    required: true
  },
  photos: [{
    type: String,
    required: true
  }],
  description: {
    type: String,
    default: '',
    maxlength: [400, 'La description ne peut pas dépasser 400 caractères']
  },
  instruments: [{
    name: { type: String, trim: true, required: true },
    level: {
      type: String,
      enum: ['Novice', 'Learner', 'Intermediate', 'Advanced', 'Master', 'Teacher'],
      default: 'Novice'
    }
  }],
  styles: [{
    type: String,
    trim: true
  }],
  maxDistance: {
    type: Number,
    default: 300,
    min: 1,
    max: 1000
  },
  media: [mediaSchema],
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [-4.481, 48.397] // X-coordinates longitude   Y-coordinates latitude
    }
  },
  /** Nom de la ville / lieu (affichage, ex: "Paris, Île-de-France, France") */
  locationName: {
    type: String,
    default: null,
    trim: true
  },
  likedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  whoLikedMe: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Tracking des limites pour utilisateurs non-premium
  dailySwipes: {
    count: {
      type: Number,
      default: 0
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  dailyMessages: {
    profiles: [{
      profileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      firstMessageAt: {
        type: Date,
        default: Date.now
      }
    }],
    resetDate: {
      type: Date,
      default: Date.now
    }
  },
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  /**
   * Matchs de l'utilisateur (miroir du document Match ; le modèle Match reste la source pour messages).
   */
  matches: [{
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true
    },
    otherUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    }
  }],
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index pour la recherche géographique (seulement si location.coordinates existe)
profileSchema.index({ location: '2dsphere' }, { sparse: true });

// Index pour les likes
profileSchema.index({ likedUsers: 1 });
profileSchema.index({ 'matches.matchId': 1 });
profileSchema.index({ 'matches.otherUserId': 1 });

// Méthodes virtuelles pour faciliter l'accès à latitude/longitude
profileSchema.virtual('latitude').get(function() {
  return this.location?.coordinates?.[1] || null;
});

profileSchema.virtual('longitude').get(function() {
  return this.location?.coordinates?.[0] || null;
});

// Inclure les virtuals dans le JSON
profileSchema.set('toJSON', { virtuals: true });
profileSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Profile', profileSchema);
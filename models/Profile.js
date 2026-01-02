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
    trim: true
  },
  photos: [{
    type: String,
    required: true
  }],
  description: {
    type: String,
    default: ''
  },
  instruments: [{
    type: String,
    trim: true
  }],
  styles: [{
    type: String,
    trim: true
  }],
  maxDistance: {
    type: Number,
    default: 50,
    min: 1,
    max: 1000
  },
  media: [mediaSchema],
  location: {
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    }
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index pour la recherche géographique
profileSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Profile', profileSchema);


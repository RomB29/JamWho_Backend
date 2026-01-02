const Profile = require('../models/Profile');
const User = require('../models/User');

// Charge le profil de l'utilisateur connecté
exports.getProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.user._id })
      .populate('userId', 'username email');

    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Met à jour le profil
exports.updateProfile = async (req, res) => {
  try {
    const {
      pseudo,
      photos,
      description,
      instruments,
      styles,
      maxDistance,
      media,
      location
    } = req.body;

    let profile = await Profile.findOne({ userId: req.user._id });

    if (!profile) {
      // Crée le profil s'il n'existe pas
      profile = new Profile({
        userId: req.user._id,
        pseudo: pseudo || req.user.username,
        photos: photos || ['https://i.pravatar.cc/300?img=12'],
        description: description || '',
        instruments: instruments || [],
        styles: styles || [],
        maxDistance: maxDistance || 50,
        media: media || []
      });
    } else {
      // Met à jour le profil
      if (pseudo !== undefined) profile.pseudo = pseudo;
      if (photos !== undefined) profile.photos = photos;
      if (description !== undefined) profile.description = description;
      if (instruments !== undefined) profile.instruments = instruments;
      if (styles !== undefined) profile.styles = styles;
      if (maxDistance !== undefined) profile.maxDistance = maxDistance;
      if (media !== undefined) profile.media = media;
      
      // Gère la localisation : convertit latitude/longitude en format GeoJSON
      if (location !== undefined) {
        if (location.latitude !== undefined && location.longitude !== undefined) {
          // Format avec latitude/longitude séparés
          if (location.latitude !== null && location.longitude !== null) {
            profile.location = {
              type: 'Point',
              coordinates: [location.longitude, location.latitude] // GeoJSON: [longitude, latitude]
            };
          } else {
            profile.location = {
              type: 'Point',
              coordinates: null
            };
          }
        } else if (location.coordinates) {
          // Format GeoJSON déjà correct
          profile.location = location;
        } else if (location === null) {
          profile.location = {
            type: 'Point',
            coordinates: null
          };
        }
      }
      
      profile.updatedAt = new Date();
    }

    await profile.save();

    res.json({
      success: true,
      profile
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil', error: error.message });
  }
};

// Récupère un profil par ID (pour la découverte)
exports.getProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await Profile.findOne({ userId: id })
      .populate('userId', 'username email');

    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};


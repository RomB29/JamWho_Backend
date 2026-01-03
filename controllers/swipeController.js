const mongoose = require('mongoose');
const Match = require('../models/Match');
const Profile = require('../models/Profile');

// Charge les profils disponibles pour le swipe
exports.getProfiles = async (req, res) => {
  try {
    const currentProfile = await Profile.findOne({ userId: req.user._id });

    if (!currentProfile) {
      return res.status(404).json({ message: 'Profil non trouvé. Veuillez compléter votre profil.' });
    }

    // Récupère les IDs des profils déjà likés (depuis likedUsers)
    const likedUserIds = currentProfile.likedUsers || [];

    // Récupère maxDistance (par défaut 50 km)
    const maxDistance = currentProfile.maxDistance || 50;

    // Vérifie si la localisation est valide
    const hasValidLocation = currentProfile.location && 
                             currentProfile.location.coordinates && 
                             currentProfile.location.coordinates.length === 2 &&
                             currentProfile.location.coordinates[0] !== null &&
                             currentProfile.location.coordinates[1] !== null &&
                             !isNaN(currentProfile.location.coordinates[0]) &&
                             !isNaN(currentProfile.location.coordinates[1]);

    if (!hasValidLocation) {
      // Si pas de localisation valide, on retourne tous les profils disponibles (sans filtre de distance)
      const profiles = await Profile.find({
        userId: { $ne: req.user._id, $nin: likedUserIds }
      })
      .populate('userId', 'username email')
      .limit(50);

      return res.json(profiles);
    }

    // Extrait les coordonnées
    const lon = parseFloat(currentProfile.location.coordinates[0]);
    const lat = parseFloat(currentProfile.location.coordinates[1]);
    const rad = parseFloat(maxDistance);

    // Convertit les IDs en ObjectId pour la requête
    const excludedUserIds = [req.user._id, ...likedUserIds]

    // Utilise $geoNear avec aggregate pour une meilleure performance
    const profiles = await Profile.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [lon, lat] // [longitude, latitude]
          },
          distanceField: 'distanceCalculated', // Ajoute la distance calculée en mètres
          maxDistance: rad * 1000, // Convertit les km en mètres
          spherical: true, // Utilise le calcul de distance sur une sphère (plus précis)
          query: {
            userId: { $nin: excludedUserIds } // Exclut l'utilisateur actuel et les profils déjà likés
          },
          key: 'location' // Le champ de localisation dans le modèle Profile
        }
      },
      {
        $lookup: {
          from: 'users', // Nom de la collection User dans MongoDB (Mongoose convertit User en 'users')
          localField: 'userId',
          foreignField: '_id',
          as: 'userId'
        }
      },
      {
        $unwind: {
          path: '$userId',
          preserveNullAndEmptyArrays: false // Exclut les profils sans utilisateur
        }
      },
      {
        $project: {
          pseudo: 1,
          photos: 1,
          description: 1,
          instruments: 1,
          styles: 1,
          maxDistance: 1,
          media: 1,
          location: 1,
          likedUsers: 1,
          distanceCalculated: 1, // Distance en mètres
          'userId._id': 1,
          'userId.pseudo': 1,
          'userId.email': 1
        }
      },
      {
        $limit: 100
      }
    ]);

    // Convertit distanceCalculated de mètres en km pour la réponse
    const profilesWithDistance = profiles.map(profile => ({
      ...profile,
      distanceCalculated: profile.distanceCalculated ? parseFloat((profile.distanceCalculated / 1000).toFixed(2)) : null, // En km avec 2 décimales
      userId: {
        _id: profile.userId._id,
        username: profile.userId.username,
        email: profile.userId.email
      }
    }));

    res.json(profilesWithDistance);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Like un profil
exports.likeProfile = async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'targetUserId requis' });
    }

    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous liker vous-même' });
    }

    // Récupère le profil de l'utilisateur actuel
    const currentProfile = await Profile.findOne({ userId: req.user._id });

    if (!currentProfile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    // Convertit targetUserId en ObjectId pour la comparaison
    const targetUserIdObj = new mongoose.Types.ObjectId(targetUserId._id);

    // Vérifie si déjà liké (convertit les IDs en string pour la comparaison)
    const likedUserIds = (currentProfile.likedUsers || []).map(id => id.toString());
    if (likedUserIds.includes(targetUserId._id)) {
      return res.status(400).json({ message: 'Profil déjà liké' });
    }

    // Ajoute l'utilisateur à la liste des likes
    if (!currentProfile.likedUsers) {
      currentProfile.likedUsers = [];
    }
    currentProfile.likedUsers.push(targetUserIdObj);
    await currentProfile.save();

    // Vérifie si c'est un match (l'autre utilisateur a aussi liké)
    const targetProfile = await Profile.findOne({ userId: targetUserIdObj });
    let match = null;
    let isMatch = false;

    if (targetProfile && targetProfile.likedUsers) {
      const targetLikedUserIds = targetProfile.likedUsers.map(id => id.toString());
      if (targetLikedUserIds.includes(req.user._id.toString())) {
        // C'est un match ! Vérifie si le match n'existe pas déjà
        const existingMatch = await Match.findOne({
          users: { $all: [req.user._id, targetUserIdObj] }
        });

        if (!existingMatch) {
          // Crée un match
          match = new Match({
            users: [req.user._id, targetUserIdObj]
          });
          await match.save();
        } else {
          match = existingMatch;
        }
        isMatch = true;
      }
    }

    res.json({
      success: true,
      isMatch,
      match: match ? {
        id: match._id,
        users: match.users
      } : null
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Récupère les profils likés
exports.getLikedProfiles = async (req, res) => {
  try {
    const currentProfile = await Profile.findOne({ userId: req.user._id });

    if (!currentProfile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    // Récupère les IDs des utilisateurs likés
    const likedUserIds = currentProfile.likedUsers || [];
    
    if (likedUserIds.length === 0) {
      return res.json([]);
    }

    // Récupère les profils des utilisateurs likés
    const profiles = await Profile.find({
      userId: { $in: likedUserIds }
    }).populate('userId', 'username email');

    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};



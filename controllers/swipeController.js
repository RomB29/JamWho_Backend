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

    // Récupère les profils disponibles
    let query = {
      userId: { $ne: req.user._id, $nin: likedUserIds }
    };

    // Filtre par distance si la localisation est disponible
    if (currentProfile.location && 
        currentProfile.location.coordinates && 
        currentProfile.location.coordinates.length === 2 &&
        currentProfile.location.coordinates[0] !== null &&
        currentProfile.location.coordinates[1] !== null) {
      const maxDistance = currentProfile.maxDistance || 50;
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: currentProfile.location.coordinates // [longitude, latitude]
          },
          $maxDistance: maxDistance * 1000 // Convertit en mètres
        }
      };
    }

    const profiles = await Profile.find(query)
      .populate('userId', 'username email')
      .limit(50);

    res.json(profiles);
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



const Swipe = require('../models/Swipe');
const Match = require('../models/Match');
const Profile = require('../models/Profile');

// Charge les profils disponibles pour le swipe
exports.getProfiles = async (req, res) => {
  try {
    const currentProfile = await Profile.findOne({ userId: req.user._id });

    if (!currentProfile) {
      return res.status(404).json({ message: 'Profil non trouvé. Veuillez compléter votre profil.' });
    }

    // Récupère les IDs des profils déjà swipés (likés ou dislikés)
    const swipedProfiles = await Swipe.find({ userId: req.user._id }).select('targetUserId');
    const swipedUserIds = swipedProfiles.map(s => s.targetUserId);

    // Récupère les profils disponibles
    let query = {
      userId: { $ne: req.user._id, $nin: swipedUserIds }
    };

    // Filtre par distance si la localisation est disponible
    if (currentProfile.location && 
        currentProfile.location.latitude && 
        currentProfile.location.longitude) {
      const maxDistance = currentProfile.maxDistance || 50;
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [
              currentProfile.location.longitude,
              currentProfile.location.latitude
            ]
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

    // Vérifie si déjà swipé
    const existingSwipe = await Swipe.findOne({
      userId: req.user._id,
      targetUserId
    });

    if (existingSwipe) {
      return res.status(400).json({ message: 'Profil déjà swipé' });
    }

    // Crée le swipe
    const swipe = new Swipe({
      userId: req.user._id,
      targetUserId,
      type: 'like'
    });
    await swipe.save();

    // Vérifie si c'est un match (l'autre utilisateur a aussi liké)
    const mutualLike = await Swipe.findOne({
      userId: targetUserId,
      targetUserId: req.user._id,
      type: 'like'
    });

    let match = null;
    if (mutualLike) {
      // Crée un match
      match = new Match({
        users: [req.user._id, targetUserId]
      });
      await match.save();
    }

    res.json({
      success: true,
      isMatch: !!match,
      match: match ? {
        id: match._id,
        users: match.users
      } : null
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Dislike un profil
exports.dislikeProfile = async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'targetUserId requis' });
    }

    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous disliker vous-même' });
    }

    // Vérifie si déjà swipé
    const existingSwipe = await Swipe.findOne({
      userId: req.user._id,
      targetUserId
    });

    if (existingSwipe) {
      return res.status(400).json({ message: 'Profil déjà swipé' });
    }

    // Crée le swipe
    const swipe = new Swipe({
      userId: req.user._id,
      targetUserId,
      type: 'dislike'
    });
    await swipe.save();

    res.json({
      success: true
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Récupère les profils likés
exports.getLikedProfiles = async (req, res) => {
  try {
    const likes = await Swipe.find({
      userId: req.user._id,
      type: 'like'
    }).populate({
      path: 'targetUserId',
      select: 'username email'
    });

    const profileIds = likes.map(like => like.targetUserId._id);
    const profiles = await Profile.find({
      userId: { $in: profileIds }
    }).populate('userId', 'username email');

    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};


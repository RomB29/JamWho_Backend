const Message = require('../models/Message');
const Match = require('../models/Match');
const Profile = require('../models/Profile');
const User = require('../models/User');

// Helper function pour vérifier et réinitialiser les limites journalières
function resetDailyLimitsIfNeeded(profile) {
  const now = new Date();
  const lastMessageDate = profile.dailyMessages?.resetDate ? new Date(profile.dailyMessages.resetDate) : null;
  
  // Réinitialise les messages si 24h se sont écoulées
  if (!lastMessageDate || (now - lastMessageDate) >= 24 * 60 * 60 * 1000) {
    profile.dailyMessages = {
      profiles: [],
      resetDate: now
    };
  }
  
  return profile;
}

// Récupère les messages d'un match
exports.getMessages = async (req, res) => {
  try {
    const { matchId } = req.params;

    // Vérifie que l'utilisateur fait partie du match
    const match = await Match.findOne({
      _id: matchId,
      users: req.user._id
    });

    if (!match) {
      return res.status(404).json({ message: 'Match non trouvé' });
    }

    const messages = await Message.find({ matchId })
      .sort({ createdAt: 1 })
      .populate('senderId', 'username')
      .populate('receiverId', 'username');

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Envoie un message
exports.sendMessage = async (req, res) => {
  try {
    const { matchId, content } = req.body;

    if (!matchId || !content || content.trim() === '') {
      return res.status(400).json({ message: 'matchId et content requis' });
    }

    // Vérifie que l'utilisateur fait partie du match
    const match = await Match.findOne({
      _id: matchId,
      users: req.user._id
    });

    if (!match) {
      return res.status(404).json({ message: 'Match non trouvé' });
    }

    // Trouve l'autre utilisateur
    const receiverId = match.users.find(
      userId => userId.toString() !== req.user._id.toString()
    );

    // Vérifie les limites pour les utilisateurs non-premium
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (!user.isPremium) {
      const profile = await Profile.findOne({ userId: req.user._id });
      if (!profile) {
        return res.status(404).json({ message: 'Profil non trouvé' });
      }

      // Réinitialise les limites si nécessaire
      resetDailyLimitsIfNeeded(profile);

      // Vérifie si c'est le premier message à ce profil
      const existingMessageProfile = profile.dailyMessages.profiles.find(
        p => p.profileId.toString() === receiverId.toString()
      );

      // Si c'est un nouveau profil (pas encore dans la liste), vérifie la limite
      if (!existingMessageProfile) {
        const MESSAGE_PROFILE_LIMIT = 2; // Maximum 2 profils différents par 24h
        if (profile.dailyMessages.profiles.length >= MESSAGE_PROFILE_LIMIT) {
          return res.status(403).json({ 
            message: `Limite de messages atteinte (${MESSAGE_PROFILE_LIMIT} profils différents par 24h). Passez Premium pour envoyer des messages sans limite !`,
            limit: MESSAGE_PROFILE_LIMIT,
            used: profile.dailyMessages.profiles.length,
            requiresPremium: true
          });
        }

        // Ajoute le profil à la liste des profils contactés aujourd'hui
        profile.dailyMessages.profiles.push({
          profileId: receiverId,
          firstMessageAt: new Date()
        });
        await profile.save();
      }
    }

    // Crée le message
    const message = new Message({
      matchId,
      senderId: req.user._id,
      receiverId,
      content: content.trim()
    });
    await message.save();

    // Met à jour lastMessageAt du match
    match.lastMessageAt = new Date();
    await match.save();

    await message.populate('senderId', 'username');
    await message.populate('receiverId', 'username');

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Marque les messages comme lus
exports.markAsRead = async (req, res) => {
  try {
    const { matchId } = req.params;

    // Vérifie que l'utilisateur fait partie du match
    const match = await Match.findOne({
      _id: matchId,
      users: req.user._id
    });

    if (!match) {
      return res.status(404).json({ message: 'Match non trouvé' });
    }

    // Marque tous les messages non lus comme lus
    await Message.updateMany(
      {
        matchId,
        receiverId: req.user._id,
        read: false
      },
      {
        read: true,
        readAt: new Date()
      }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};


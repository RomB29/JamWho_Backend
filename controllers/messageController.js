const Message = require('../models/Message');
const Match = require('../models/Match');
const Profile = require('../models/Profile');
const User = require('../models/User');
const mongoose = require('mongoose');

// Helper function pour générer un conversationId unique entre deux utilisateurs
// Le conversationId est déterministe : il sera toujours le même pour deux utilisateurs donnés
function generateConversationId(userId1, userId2) {
  // Convertit en string pour la comparaison
  const id1 = userId1.toString();
  const id2 = userId2.toString();
  
  // Trie les IDs pour garantir que le conversationId est toujours le même
  // peu importe l'ordre des paramètres
  const sortedIds = [id1, id2].sort();
  
  // Génère le conversationId en concaténant les IDs triés
  return `${sortedIds[0]}_${sortedIds[1]}`;
}

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

// Récupère les messages d'une conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId requis' });
    }

    // Vérifie que l'utilisateur fait partie de la conversation
    // Le conversationId contient les deux IDs triés, on vérifie que req.user._id est dedans
    const userIdStr = req.user._id.toString();
    const conversationParts = conversationId.split('_');
    
    if (conversationParts.length !== 2 || 
        !conversationParts.includes(userIdStr)) {
      return res.status(403).json({ message: 'Accès non autorisé à cette conversation' });
    }

    const messages = await Message.find({ conversationId })
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
    const { conversationId, content } = req.body;

    if (!conversationId || !content || content.trim() === '') {
      return res.status(400).json({ message: 'conversationId et content requis' });
    }

    // Vérifie que l'utilisateur fait partie de la conversation
    const userIdStr = req.user._id.toString();
    const conversationParts = conversationId.split('_');
    
    if (conversationParts.length !== 2 || 
        !conversationParts.includes(userIdStr)) {
      return res.status(403).json({ message: 'Accès non autorisé à cette conversation' });
    }

    // Trouve l'autre utilisateur (celui qui n'est pas l'utilisateur actuel)
    const receiverIdStr = conversationParts.find(id => id !== userIdStr);
    const receiverId = new mongoose.Types.ObjectId(receiverIdStr);
    
    // Vérifie que le match existe (pour compatibilité)
    const match = await Match.findOne({
      users: { $all: [req.user._id, receiverId] }
    });

    // Vérifie les limites pour les utilisateurs non-premium
    const user = await User.findById(req.user._id).select('isPremium premiumExpiresAt');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    const isPremium = await User.syncPremiumIfExpired(user);

    if (!isPremium) {
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

    // Crée le message avec conversationId
    const message = new Message({
      conversationId,
      matchId: match ? match._id : null, // Gardé pour compatibilité
      senderId: req.user._id,
      receiverId,
      content: content.trim()
    });
    await message.save();

    // Met à jour lastMessageAt du match si il existe
    if (match) {
      match.lastMessageAt = new Date();
      await match.save();
    }

    // Incrémente le compteur messageUnread du destinataire
    const receiverUser = await User.findById(receiverId);
    if (receiverUser) {
      receiverUser.messageUnread = (receiverUser.messageUnread || 0) + 1;
      await receiverUser.save();
    }

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
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId requis' });
    }

    // Vérifie que l'utilisateur fait partie de la conversation
    const userIdStr = req.user._id.toString();
    const conversationParts = conversationId.split('_');
    
    if (conversationParts.length !== 2 || 
        !conversationParts.includes(userIdStr)) {
      return res.status(403).json({ message: 'Accès non autorisé à cette conversation' });
    }

    // Compte les messages non lus avant de les marquer comme lus
    const unreadCount = await Message.countDocuments({
      conversationId,
      receiverId: req.user._id,
      read: false
    });

    // Marque tous les messages non lus comme lus
    await Message.updateMany(
      {
        conversationId,
        receiverId: req.user._id,
        read: false
      },
      {
        read: true,
        readAt: new Date()
      }
    );

    // Met à jour le compteur global messageUnread
    const user = await User.findById(req.user._id);
    if (user) {
      // Recalcule le nombre total de messages non lus
      const totalUnread = await Message.countDocuments({
        receiverId: req.user._id,
        read: false
      });
      user.messageUnread = totalUnread;
      await user.save();
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Récupère toutes les conversations de l'utilisateur avec le dernier message et le nombre de messages non lus
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Récupère tous les matches de l'utilisateur
    const matches = await Match.find({
      users: userId
    })
    .sort({ lastMessageAt: -1 })
    .populate('users', 'username email');

    // Pour chaque match, récupère le dernier message et le nombre de messages non lus
    const conversations = await Promise.all(
      matches.map(async (match) => {
        // Trouve l'autre utilisateur
        const otherUser = match.users.find(
          user => user._id.toString() !== userId.toString()
        );

        if (!otherUser) {
          return null;
        }

        // Récupère le profil de l'autre utilisateur
        const profile = await Profile.findOne({ userId: otherUser._id });

        // Génère le conversationId pour cette conversation
        const conversationId = generateConversationId(userId, otherUser._id);

        // Récupère le dernier message
        const lastMessage = await Message.findOne({ conversationId })
          .sort({ createdAt: -1 })
          .populate('senderId', 'username');

        // Compte les messages non lus
        const unreadCount = await Message.countDocuments({
          conversationId,
          receiverId: userId,
          read: false
        });

        return {
          conversationId,
          matchId: match._id.toString(), // Gardé pour compatibilité
          otherUser: {
            id: otherUser._id.toString(),
            username: otherUser.username,
            email: otherUser.email
          },
          profile: profile ? {
            id: profile._id.toString(),
            pseudo: profile.pseudo,
            photos: profile.photos || [],
            description: profile.description
          } : null,
          lastMessage: lastMessage ? {
            id: lastMessage._id.toString(),
            content: lastMessage.content,
            senderId: lastMessage.senderId._id ? lastMessage.senderId._id.toString() : lastMessage.senderId.toString(),
            senderUsername: lastMessage.senderId.username || 'Utilisateur',
            createdAt: lastMessage.createdAt,
            read: lastMessage.read
          } : null,
          unreadCount,
          createdAt: match.createdAt,
          lastMessageAt: match.lastMessageAt
        };
      })
    );

    // Filtre les conversations null
    const validConversations = conversations.filter(conv => conv !== null);

    res.json(validConversations);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};


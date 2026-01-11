const User = require('../models/User');
const Message = require('../models/Message');

// Récupère les notifications de l'utilisateur
exports.getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json({
      newLike: user.newLike || 0,
      messageUnread: user.messageUnread || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Réinitialise le compteur newLike
exports.resetNewLike = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    user.newLike = 0;
    await user.save();

    res.json({ success: true, newLike: 0 });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Réinitialise le compteur messageUnread pour une conversation spécifique
exports.resetMessageUnread = async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Vérifie que l'utilisateur fait partie de la conversation
    const userIdStr = req.user._id.toString();
    const conversationParts = conversationId.split('_');
    
    if (conversationParts.length !== 2 || 
        !conversationParts.includes(userIdStr)) {
      return res.status(403).json({ message: 'Accès non autorisé à cette conversation' });
    }

    // Marque les messages comme lus
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

    res.json({ success: true, messageUnread: user.messageUnread || 0 });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

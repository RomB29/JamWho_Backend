const User = require('../models/User');
const Message = require('../models/Message');
const Notification = require('../models/Notification');

// Récupère les notifications de l'utilisateur
exports.getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const notificationUnreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false
    });

    res.json({
      newLike: user.newLike || 0,
      messageUnread: user.messageUnread || 0,
      notificationUnreadCount
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

/** Liste paginée des notifications (message, like, match) */
exports.getNotificationList = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { userId: req.user._id, read: false };
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .populate('actorId', 'username')
        .lean(),
      Notification.countDocuments({ userId: req.user._id })
    ]);

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false
    });

    res.json({
      notifications: notifications.map(n => ({
        id: n._id,
        type: n.type,
        actorId: n.actorId?._id,
        actorUsername: n.actorId?.username,
        relatedId: n.relatedId,
        conversationId: n.conversationId,
        title: n.title,
        body: n.body,
        read: n.read,
        readAt: n.readAt,
        createdAt: n.createdAt
      })),
      pagination: { page, limit, total },
      unreadCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/** Marque une notification comme lue */
exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!notif) {
      return res.status(404).json({ message: 'Notification non trouvée' });
    }
    res.json({ success: true, notification: notif });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

/** Marque toutes les notifications comme lues */
exports.markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

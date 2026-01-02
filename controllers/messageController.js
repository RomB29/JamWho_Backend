const Message = require('../models/Message');
const Match = require('../models/Match');

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


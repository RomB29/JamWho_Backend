const Match = require('../models/Match');
const Profile = require('../models/Profile');

// Récupère tous les matches de l'utilisateur
exports.getMatches = async (req, res) => {
  try {
    const matches = await Match.find({
      users: req.user._id
    })
    .sort({ lastMessageAt: -1 })
    .populate('users', 'username email');

    // Pour chaque match, récupère le profil de l'autre utilisateur
    const matchesWithProfiles = await Promise.all(
      matches.map(async (match) => {
        // Trouve l'autre utilisateur (celui qui n'est pas l'utilisateur actuel)
        const otherUser = match.users.find(
          userId => userId._id.toString() !== req.user._id.toString()
        );

        // Vérifie qu'on a bien trouvé un autre utilisateur
        if (!otherUser) {
          console.error(`Match ${match._id} n'a pas d'autre utilisateur valide`);
          return null;
        }

        const otherUserId = otherUser._id;
        const profile = await Profile.findOne({ userId: otherUserId });

        return {
          id: match._id,
          user: otherUser,
          profile: profile || null,
          createdAt: match.createdAt,
          lastMessageAt: match.lastMessageAt
        };
      })
    );

    // Filtre les matches null (en cas d'erreur)
    const validMatches = matchesWithProfiles.filter(match => match !== null);

    res.json(validMatches);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Récupère un match spécifique
exports.getMatch = async (req, res) => {
  try {
    const { id } = req.params;

    const match = await Match.findOne({
      _id: id,
      users: req.user._id
    }).populate('users', 'username email');

    if (!match) {
      return res.status(404).json({ message: 'Match non trouvé' });
    }

    // Trouve l'autre utilisateur (celui qui n'est pas l'utilisateur actuel)
    const otherUser = match.users.find(
      userId => userId._id.toString() !== req.user._id.toString()
    );

    // Vérifie qu'on a bien trouvé un autre utilisateur
    if (!otherUser) {
      return res.status(500).json({ message: 'Match invalide : autre utilisateur non trouvé' });
    }

    const otherUserId = otherUser._id;
    const profile = await Profile.findOne({ userId: otherUserId });

    res.json({
      id: match._id,
      user: otherUser,
      profile: profile || null,
      createdAt: match.createdAt,
      lastMessageAt: match.lastMessageAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};


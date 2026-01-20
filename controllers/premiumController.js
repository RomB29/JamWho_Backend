const User = require('../models/User');
const Profile = require('../models/Profile');
const { SWIPE_LIMIT, MESSAGE_PROFILE_LIMIT } = require('../config/constants');
// Récupère les informations premium et les limites de l'utilisateur
exports.getPremiumInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('isPremium');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const profile = await Profile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    // Réinitialise les limites si nécessaire
    const now = new Date();
    const lastSwipeDate = profile.dailySwipes?.date ? new Date(profile.dailySwipes.date) : null;
    const lastMessageDate = profile.dailyMessages?.resetDate ? new Date(profile.dailyMessages.resetDate) : null;

    // Vérifie si on doit réinitialiser les swipes (nouveau jour)
    if (!lastSwipeDate || lastSwipeDate.toDateString() !== now.toDateString()) {
      profile.dailySwipes = {
        count: 0,
        date: now
      };
    }

    // Vérifie si on doit réinitialiser les messages (24h écoulées)
    if (!lastMessageDate || (now - lastMessageDate) >= 24 * 60 * 60 * 1000) {
      profile.dailyMessages = {
        profiles: profile.dailyMessages?.profiles || [],
        resetDate: now
      };
    }

    // Sauvegarde si des modifications ont été faites
    if (profile.isModified()) {
      await profile.save();
    }

    // Définit les limites selon le statut premium
    const MESSAGE_PROFILE_LIMIT = 2;

    // Calcule les statistiques
    const swipeCount = profile.dailySwipes?.count || 0;
    const messageProfileCount = profile.dailyMessages?.profiles?.length || 0;

    // Calcule le temps restant avant reset des messages (en millisecondes)
    let messagesResetIn = null;
    if (!user.isPremium && lastMessageDate) {
      const nextReset = new Date(lastMessageDate.getTime() + 24 * 60 * 60 * 1000);
      messagesResetIn = Math.max(0, nextReset - now);
    }

    // Calcule le prochain minuit pour les swipes
    let swipesResetAt = null;
    if (!user.isPremium && lastSwipeDate) {
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0); // Prochain minuit
      swipesResetAt = tomorrow;
    }

    res.json({
      isPremium: user.isPremium || false,
      limits: {
        swipes: {
          limit: SWIPE_LIMIT,
          used: swipeCount,
          remaining: user.isPremium ? Infinity : Math.max(0, SWIPE_LIMIT - swipeCount),
          resetAt: swipesResetAt
        },
        messages: {
          limit: MESSAGE_PROFILE_LIMIT,
          used: messageProfileCount,
          remaining: user.isPremium ? Infinity : Math.max(0, MESSAGE_PROFILE_LIMIT - messageProfileCount),
          resetIn: messagesResetIn, // En millisecondes
          resetAt: messagesResetIn ? new Date(now.getTime() + messagesResetIn) : null
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Récupère les limites de l'utilisateur (format compatible frontend)
exports.getLimits = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('isPremium');
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const profile = await Profile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    // Réinitialise les limites si nécessaire
    const now = new Date();
    const lastSwipeDate = profile.dailySwipes?.date ? new Date(profile.dailySwipes.date) : null;
    const lastMessageDate = profile.dailyMessages?.resetDate ? new Date(profile.dailyMessages.resetDate) : null;

    // Vérifie si on doit réinitialiser les swipes (nouveau jour)
    if (!lastSwipeDate || lastSwipeDate.toDateString() !== now.toDateString()) {
      profile.dailySwipes = {
        count: 0,
        date: now
      };
    }

    // Vérifie si on doit réinitialiser les messages (24h écoulées)
    if (!lastMessageDate || (now - lastMessageDate) >= 24 * 60 * 60 * 1000) {
      profile.dailyMessages = {
        profiles: [],
        resetDate: now
      };
    }

    // Sauvegarde si des modifications ont été faites
    if (profile.isModified()) {
      await profile.save();
    }

    // Définit les limites selon le statut premium

    // Calcule les statistiques
    const swipeCount = profile.dailySwipes?.count || 0;
    const messageProfileCount = profile.dailyMessages?.profiles?.length || 0;

    // Compter les photos et sons depuis le profil
    const photosCount = profile.photos?.length || 0;
    const songsCount = profile.media?.filter(m => m.type === 'mp3' || (m.url && m.url.toLowerCase().endsWith('.mp3')))?.length || 0;

    // Limites pour photos et sons
    const PHOTOS_LIMIT = user.isPremium ? Infinity : 3;
    const SONGS_LIMIT = user.isPremium ? Infinity : 1;

    // Retourne le format attendu par le frontend
    res.json({
      swipesToday: user.isPremium ? 0 : swipeCount,
      swipesLimit: user.isPremium ? Infinity : SWIPE_LIMIT,
      messagesToday: user.isPremium ? 0 : messageProfileCount,
      messagesLimit: user.isPremium ? Infinity : MESSAGE_PROFILE_LIMIT,
      photosCount: photosCount,
      photosLimit: PHOTOS_LIMIT,
      songsCount: songsCount,
      songsLimit: SONGS_LIMIT
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Met à jour le statut premium d'un utilisateur (pour admin ou système de paiement)
exports.updatePremiumStatus = async (req, res) => {
  try {
    const { isPremium } = req.body;

    if (typeof isPremium !== 'boolean') {
      return res.status(400).json({ message: 'isPremium doit être un boolean' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    user.isPremium = isPremium;
    await user.save();

    res.json({
      success: true,
      isPremium: user.isPremium,
      message: isPremium ? 'Statut Premium activé' : 'Statut Premium désactivé'
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Met à jour le nombre de swipes
// NOTE: Cette fonction n'est normalement pas nécessaire car l'incrémentation
// est déjà gérée dans swipeController.likeProfile. Elle est gardée pour d'éventuels cas d'usage.
exports.updateSwipes = async (req, res) => {

  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Si l'utilisateur est premium, pas besoin d'incrémenter
    if (user.isPremium) {
      return res.json({
        success: true,
        message: 'Utilisateur premium - pas de limite',
        swipes: 0
      });
    }

    const profile = await Profile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }


    // Réinitialise les limites si nécessaire (comme dans swipeController)
    const now = new Date();
    const lastSwipeDate = profile.dailySwipes?.date ? new Date(profile.dailySwipes.date) : null;
    
    if (!lastSwipeDate || lastSwipeDate.toDateString() !== now.toDateString()) {
      profile.dailySwipes = {
        count: 0,
        date: now
      };
    }

    // Incrémente le compteur
    const previousCount = profile.dailySwipes.count || 0;
    profile.dailySwipes.count = previousCount + 1;
    await profile.save();

    res.json({
      success: true,
      message: 'Nombre de swipes mis à jour',
      swipes: profile.dailySwipes.count
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur serveur', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

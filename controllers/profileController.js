const Profile = require('../models/Profile');
const User = require('../models/User');
const getServerBaseUrl = require('../utils/serverBaseUrl');
const {
  normalizeInstruments,
  transformPhotoUrls,
  serializeOwnProfile,
  serializePublicProfile
} = require('../utils/responseSerializers');
const {
  rejectForbiddenProfileKeys,
  validatePhotosArray,
  validateMediaArray,
  validateLocation,
  validateMaxDistance,
  validateStyles
} = require('../utils/profileUpdateValidation');
const fs = require('fs');
const path = require('path');

const MAX_INSTRUMENTS = 30;

// Charge le profil de l'utilisateur connecté
exports.getProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.user._id }).populate(
      'userId',
      'username'
    );

    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    const user = await User.findById(req.user._id).select('isPremium premiumExpiresAt');
    const isPremium = user ? await User.syncPremiumIfExpired(user) : false;

    res.json(serializeOwnProfile(profile, { isPremium }));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Met à jour le profil
exports.updateProfile = async (req, res) => {
  try {
    const keyCheck = rejectForbiddenProfileKeys(req.body);
    if (!keyCheck.ok) {
      return res.status(400).json({
        message: keyCheck.message,
        fields: keyCheck.fields
      });
    }

    const userForLimits = await User.findById(req.user._id).select('isPremium premiumExpiresAt');
    const isPremiumUser = userForLimits
      ? await User.syncPremiumIfExpired(userForLimits)
      : false;
    const maxPhotos = isPremiumUser ? 6 : 3;
    const maxMediaItems = isPremiumUser ? 20 : 2;

    const {
      age,
      sexe,
      photos,
      description,
      instruments,
      styles,
      maxDistance,
      media,
      location,
      locationName,
      city
    } = req.body;

    let profile = await Profile.findOne({ userId: req.user._id });

    if (!profile) {
      // Pseudo d’affichage = username du compte (pas modifiable via PUT — pas de champ client)
      const initialPseudo = String(req.user.username || '').trim();
      const initialDesc = description !== undefined ? String(description) : '';
      if (initialPseudo.length < 4 || initialPseudo.length > 20) {
        return res.status(400).json({ message: 'Le pseudo doit contenir entre 4 et 20 caractères' });
      }
      if (initialDesc.length > 400) {
        return res.status(400).json({ message: 'La description ne peut pas dépasser 400 caractères' });
      }

      const photosCheck = validatePhotosArray(photos, maxPhotos);
      if (!photosCheck.ok) {
        return res.status(400).json({ message: photosCheck.message });
      }
      const mediaCheck = validateMediaArray(media, maxMediaItems);
      if (!mediaCheck.ok) {
        return res.status(400).json({ message: mediaCheck.message });
      }
      const locCheck = validateLocation(location);
      if (!locCheck.ok) {
        return res.status(400).json({ message: locCheck.message });
      }
      const distCheck = validateMaxDistance(maxDistance);
      if (!distCheck.ok) {
        return res.status(400).json({ message: distCheck.message });
      }
      const stylesCheck = validateStyles(styles);
      if (!stylesCheck.ok) {
        return res.status(400).json({ message: stylesCheck.message });
      }

      const normalizedInstruments = normalizeInstruments(instruments);
      if (normalizedInstruments.length > MAX_INSTRUMENTS) {
        return res.status(400).json({ message: 'Trop d\'instruments' });
      }

      profile = new Profile({
        userId: req.user._id,
        pseudo: initialPseudo.trim(),
        age: age || 18,
        sexe: sexe || 'autre',
        photos: photosCheck.value !== undefined ? photosCheck.value : [],
        description: initialDesc,
        instruments: normalizedInstruments,
        styles: stylesCheck.value !== undefined ? stylesCheck.value : [],
        maxDistance: distCheck.value !== undefined ? distCheck.value : 300,
        media: mediaCheck.value !== undefined ? mediaCheck.value : [],
        locationName: locationName || city || null
      });
      if (locCheck.value !== undefined && locCheck.value !== null) {
        profile.location = locCheck.value;
      }
    } else {
      // pseudo : non modifiable via PUT (inchangé en base même si le client envoie profile.pseudo)
      if (age !== undefined) {
        const ageNum = parseInt(age, 10);
        if (!isNaN(ageNum) && ageNum >= 18 && ageNum <= 100) {
          profile.age = ageNum;
        } else {
          return res.status(400).json({ message: 'L\'âge doit être entre 18 et 100 ans' });
        }
      }
      if (sexe !== undefined) {
        if (['homme', 'femme', 'autre'].includes(sexe)) {
          profile.sexe = sexe;
        } else {
          return res.status(400).json({ message: 'Le sexe doit être "homme", "femme" ou "autre"' });
        }
      }
      if (photos !== undefined) {
        const photosCheck = validatePhotosArray(photos, maxPhotos);
        if (!photosCheck.ok) {
          return res.status(400).json({ message: photosCheck.message });
        }
        profile.photos = photosCheck.value;
      }
      if (description !== undefined) {
        const desc = String(description);
        if (desc.length > 400) {
          return res.status(400).json({ message: 'La description ne peut pas dépasser 400 caractères' });
        }
        profile.description = desc;
      }
      if (instruments !== undefined) {
        const normalizedInstruments = normalizeInstruments(instruments);
        if (normalizedInstruments.length > MAX_INSTRUMENTS) {
          return res.status(400).json({ message: 'Trop d\'instruments' });
        }
        profile.instruments = normalizedInstruments;
      }
      if (styles !== undefined) {
        const stylesCheck = validateStyles(styles);
        if (!stylesCheck.ok) {
          return res.status(400).json({ message: stylesCheck.message });
        }
        profile.styles = stylesCheck.value;
      }
      if (maxDistance !== undefined) {
        const distCheck = validateMaxDistance(maxDistance);
        if (!distCheck.ok) {
          return res.status(400).json({ message: distCheck.message });
        }
        profile.maxDistance = distCheck.value;
      }
      if (media !== undefined) {
        const mediaCheck = validateMediaArray(media, maxMediaItems);
        if (!mediaCheck.ok) {
          return res.status(400).json({ message: mediaCheck.message });
        }
        profile.media = mediaCheck.value;
      }

      if (location !== undefined) {
        const locCheck = validateLocation(location);
        if (!locCheck.ok) {
          return res.status(400).json({ message: locCheck.message });
        }
        if (locCheck.value !== undefined) {
          profile.location = locCheck.value;
        }
      }
      if (locationName !== undefined) {
        profile.locationName = locationName ? String(locationName).trim() : null;
      }
      if (city !== undefined && profile.locationName == null) {
        profile.locationName = city ? String(city).trim() : null;
      }

      profile.updatedAt = new Date();
    }

    await profile.save();
    await profile.populate('userId', 'username');

    res.json({
      success: true,
      profile: serializeOwnProfile(profile, { isPremium: isPremiumUser })
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil', error: error.message });
  }
};

// Récupère un profil par ID (pour la découverte)
exports.getProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await Profile.findOne({ userId: id }).populate('userId', 'username');

    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    res.json(serializePublicProfile(profile));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Upload d'une photo de profil (avatar)
exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier uploadé' });
    }

    // Récupère le profil de l'utilisateur
    let profile = await Profile.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    // Construit l'URL complète de l'image avec l'URL de base du serveur
    const userId = req.user._id.toString();
    const baseUrl = getServerBaseUrl();
    const imageUrl = `${baseUrl}/profile/${userId}/photo_uploads/${req.file.filename}`;

    // Ajoute la photo à la liste des photos du profil
    // Si c'est la première photo ou si photos est vide, on la met en première position
    if (!profile.photos || profile.photos.length === 0) {
      profile.photos = [imageUrl];
    } else {
      // Ajoute la nouvelle photo en première position (dernière uploadée)
      profile.photos.unshift(imageUrl);
      
      // Optionnel: Limiter le nombre de photos (par exemple, garder seulement les 6 dernières)
      if (profile.photos.length > 6) {
        profile.photos = profile.photos.slice(0, 6);
      }
    }

    profile.updatedAt = new Date();
    await profile.save();

    // Transforme toutes les URLs de photos en URLs complètes avant de retourner
    const photosUrls = transformPhotoUrls(profile.photos);

    res.json({
      success: true,
      message: 'Photo uploadée avec succès',
      photoUrl: imageUrl,
      photos: photosUrls
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de l\'upload de la photo', 
      error: error.message 
    });
  }
};

// Supprime une photo de profil
exports.deletePhoto = async (req, res) => {
  try {
    const { photoUrl } = req.body;

    if (!photoUrl) {
      return res.status(400).json({ message: 'URL de la photo requise' });
    }

    // Récupère le profil de l'utilisateur
    const profile = await Profile.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    // Vérifie que la photo existe dans le profil
    if (!profile.photos || !profile.photos.includes(photoUrl)) {
      // Normalise l'URL pour la comparaison (enlève le baseUrl si présent)
      const baseUrl = getServerBaseUrl();
      const normalizedPhotoUrl = photoUrl.replace(baseUrl, '');
      const normalizedPhotos = profile.photos.map(p => p.replace(baseUrl, ''));
      
      if (!normalizedPhotos.includes(normalizedPhotoUrl)) {
        return res.status(404).json({ message: 'Photo non trouvée dans le profil' });
      }
    }

    // Parse l'URL pour extraire le chemin relatif
    // Format attendu: http://domain/profile/{userId}/photo_uploads/{filename}
    // ou: /profile/{userId}/photo_uploads/{filename}
    let relativePath = photoUrl;
    const baseUrl = getServerBaseUrl();
    
    // Si c'est une URL complète, on extrait le chemin relatif
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      try {
        const url = new URL(photoUrl);
        relativePath = url.pathname;
      } catch (error) {
        // Si l'URL n'est pas valide, on essaie de la parser manuellement
        const match = photoUrl.match(/\/profile\/([^\/]+)\/photo_uploads\/(.+)$/);
        if (match) {
          relativePath = `/profile/${match[1]}/photo_uploads/${match[2]}`;
        }
      }
    }

    if (photoUrl.includes('googleusercontent.com')) {

      const normalizeGoogleUrl = (url) => {
        try {
          const urlObj = new URL(url);
          // Retourne l'URL sans les paramètres de requête
          return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
        } catch (e) {
          return url.split('?')[0]; // Enlève les paramètres manuellement
        }
      };
      
      const normalizedPhotoUrl = normalizeGoogleUrl(photoUrl);
      
      // Retire la photo de la liste du profil en comparant les URLs normalisées
      const initialLength = profile.photos.length;
      profile.photos = profile.photos.filter(p => {
        if (p.includes('googleusercontent.com')) {
          return normalizeGoogleUrl(p) !== normalizedPhotoUrl;
        }
        // Pour les autres photos, comparaison exacte
        return p !== photoUrl;
      });
      
      // Vérifie que la photo a bien été trouvée et supprimée
      if (profile.photos.length === initialLength) {
        return res.status(404).json({ message: 'Photo non trouvée dans le profil' });
      }
      
      // Vérifie qu'il reste au moins une photo
      if (profile.photos.length === 0) {
        return res.status(400).json({ message: 'Vous devez avoir au moins une photo' });
      }
      
      profile.updatedAt = new Date();
      await profile.save();
      
      // Transforme les URLs de photos en URLs complètes avant de retourner
      const photosUrls = transformPhotoUrls(profile.photos);
      
      return res.json({
        success: true,
        message: 'Photo supprimée avec succès',
        photos: photosUrls
      });
    }

    // Vérifie que le chemin correspond au format attendu
    const pathMatch = relativePath.match(/\/profile\/([^\/]+)\/photo_uploads\/(.+)$/);
    if (!pathMatch) {
      return res.status(400).json({ message: 'Format d\'URL de photo invalide' });
    }

    const [, photoUserId, filename] = pathMatch;
    const currentUserId = req.user._id.toString();

    // Vérifie que la photo appartient à l'utilisateur connecté
    if (photoUserId !== currentUserId) {
      return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres photos' });
    }

    // Construit le chemin du fichier physique
    const filePath = path.join(__dirname, '../PUBLIC_UPLOAD/profile', photoUserId, 'photo_uploads', filename);

    // Supprime le fichier physique s'il existe
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Erreur lors de la suppression du fichier:', error);
        // On continue même si la suppression du fichier échoue
      }
    }

    // Retire la photo de la liste du profil
    // Normalise les URLs pour la comparaison
    const baseUrlForComparison = getServerBaseUrl();
    profile.photos = profile.photos.filter(p => {
      const normalizedP = p.replace(baseUrlForComparison, '');
      const normalizedPhotoUrl = relativePath;
      return normalizedP !== normalizedPhotoUrl;
    });

    // Vérifie qu'il reste au moins une photo
    if (profile.photos.length === 0) {
      return res.status(400).json({ message: 'Vous devez avoir au moins une photo' });
    }

    profile.updatedAt = new Date();
    await profile.save();

    // Transforme les URLs de photos en URLs complètes avant de retourner
    const photosUrls = transformPhotoUrls(profile.photos);

    res.json({
      success: true,
      message: 'Photo supprimée avec succès',
      photos: photosUrls
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de la suppression de la photo', 
      error: error.message 
    });
  }
};

// Upload d'un fichier audio
exports.uploadSong = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier uploadé' });
    }

    // Récupère le profil de l'utilisateur
    let profile = await Profile.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    // Construit l'URL complète du fichier audio avec l'URL de base du serveur
    const userId = req.user._id.toString();
    const baseUrl = getServerBaseUrl();
    const songUrl = `${baseUrl}/song/${userId}/song_uploads/${req.file.filename}`;

    // Récupère le nom original du fichier uploadé
    const originalFilename = req.file.originalname || null;

    // Détermine le type de fichier depuis l'extension
    const fileExtension = req.file.filename.split('.').pop().toLowerCase();
    let mediaType = 'mp3'; // par défaut
    if (fileExtension === 'mp3' || fileExtension === 'mpeg') {
      mediaType = 'mp3';
    } else if (fileExtension === 'wav') {
      mediaType = 'mp3'; // On stocke aussi les WAV comme mp3 dans le modèle
    }

    // Crée l'objet média avec le nom original du fichier
    const newMedia = {
      type: mediaType,
      url: songUrl,
      filename: originalFilename // Stocke le nom original du fichier
    };

    // Ajoute le fichier audio à la liste des médias du profil
    if (!profile.media) {
      profile.media = [];
    }
    profile.media.push(newMedia);

    profile.updatedAt = new Date();
    await profile.save();

    // Récupère le dernier média ajouté (qui vient d'être sauvegardé)
    const savedMedia = profile.media[profile.media.length - 1];

    res.json({
      success: true,
      message: 'Fichier audio uploadé avec succès',
      songUrl: songUrl,
      url: songUrl, // Alias pour compatibilité frontend
      filename: originalFilename, // Nom original du fichier
      media: savedMedia // Retourne l'objet média complet avec filename
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de l\'upload du fichier audio', 
      error: error.message 
    });
  }
};

// Supprime un fichier audio
exports.deleteSong = async (req, res) => {
  try {
    const { songUrl } = req.body;

    if (!songUrl) {
      return res.status(400).json({ message: 'URL du fichier audio requise' });
    }

    // Récupère le profil de l'utilisateur
    const profile = await Profile.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    // Vérifie que le média existe dans le profil
    const mediaIndex = profile.media.findIndex(m => m.url === songUrl);
    if (mediaIndex === -1) {
      // Normalise l'URL pour la comparaison (enlève le baseUrl si présent)
      const baseUrl = getServerBaseUrl();
      const normalizedSongUrl = songUrl.replace(baseUrl, '');
      const normalizedMediaUrls = profile.media.map(m => m.url.replace(baseUrl, ''));
      const normalizedIndex = normalizedMediaUrls.findIndex(url => url === normalizedSongUrl);
      
      if (normalizedIndex === -1) {
        return res.status(404).json({ message: 'Fichier audio non trouvé dans le profil' });
      }
    }

    // Parse l'URL pour extraire le chemin relatif
    // Format attendu: http://domain/song/{userId}/song_uploads/{filename}
    // ou: /song/{userId}/song_uploads/{filename}
    let relativePath = songUrl;
    const baseUrl = getServerBaseUrl();
    
    // Si c'est une URL complète, on extrait le chemin relatif
    if (songUrl.startsWith('http://') || songUrl.startsWith('https://')) {
      try {
        const url = new URL(songUrl);
        relativePath = url.pathname;
      } catch (error) {
        // Si l'URL n'est pas valide, on essaie de la parser manuellement
        const match = songUrl.match(/\/song\/([^\/]+)\/song_uploads\/(.+)$/);
        if (match) {
          relativePath = `/song/${match[1]}/song_uploads/${match[2]}`;
        }
      }
    }

    // Vérifie que le chemin correspond au format attendu
    const pathMatch = relativePath.match(/\/song\/([^\/]+)\/song_uploads\/(.+)$/);
    if (!pathMatch) {
      return res.status(400).json({ message: 'Format d\'URL de fichier audio invalide' });
    }

    const [, songUserId, filename] = pathMatch;
    const currentUserId = req.user._id.toString();

    // Vérifie que le fichier audio appartient à l'utilisateur connecté
    if (songUserId !== currentUserId) {
      return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres fichiers audio' });
    }

    // Construit le chemin du fichier physique
    const filePath = path.join(__dirname, '../PUBLIC_UPLOAD/profile', songUserId, 'song_uploads', filename);

    // Supprime le fichier physique s'il existe
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Erreur lors de la suppression du fichier:', error);
        // On continue même si la suppression du fichier échoue
      }
    }

    // Retire le média de la liste du profil
    // Normalise les URLs pour la comparaison
    const baseUrlForComparison = getServerBaseUrl();
    profile.media = profile.media.filter(m => {
      const normalizedMUrl = m.url.replace(baseUrlForComparison, '');
      const normalizedSongUrl = relativePath;
      return normalizedMUrl !== normalizedSongUrl;
    });

    // Vérifie qu'il reste au moins un média
    if (profile.media.length === 0) {
      return res.status(400).json({ message: 'Vous devez avoir au moins un fichier audio' });
    }

    profile.updatedAt = new Date();
    await profile.save();

    res.json({
      success: true,
      message: 'Fichier audio supprimé avec succès',
      media: profile.media
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors de la suppression du fichier audio', 
      error: error.message 
    });
  }
};

// Block user
exports.blockUser = async (req, res) => {
  try {
    const raw = req.body.blockedUserId;
    const targetUserId =
      typeof raw === 'string' || raw instanceof String
        ? raw
        : raw && typeof raw === 'object'
          ? raw._id || raw.id
          : null;
    if (!targetUserId) {
      return res.status(400).json({ message: 'blockedUserId requis' });
    }
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous bloquer vous-même' });
    }
    const currentProfile = await Profile.findOne({ userId: req.user._id });
    if (!currentProfile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }
    if (currentProfile.blockedUsers.includes(targetUserId)) {
      return res.status(400).json({ message: 'Utilisateur déjà bloqué' });
    }
    currentProfile.blockedUsers.push(targetUserId);
    await currentProfile.save();
    res.json({
      success: true,
      message: 'Utilisateur bloqué avec succès'
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors du blocage de l\'utilisateur', 
      error: error.message 
    });
  }
};

// Unblock user
exports.unblockUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ message: 'targetUserId requis' });
    }
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous débloquer vous-même' });
    }
    const currentProfile = await Profile.findOne({ userId: req.user._id });
    if (!currentProfile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }
    if (!currentProfile.blockedUsers.includes(targetUserId)) {
      return res.status(400).json({ message: 'Utilisateur non bloqué' });
  }
  currentProfile.blockedUsers = currentProfile.blockedUsers.filter(id => id.toString() !== targetUserId.toString());
  await currentProfile.save();
  res.json({
    success: true,
    message: 'Utilisateur débloqué avec succès'
  });
  } catch (error) {
    res.status(500).json({ 
      message: 'Erreur lors du déblocage de l\'utilisateur', 
      error: error.message 
    });
  }
};

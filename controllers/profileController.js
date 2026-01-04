const Profile = require('../models/Profile');
const User = require('../models/User');
const getServerBaseUrl = require('../utils/serverBaseUrl');
const fs = require('fs');
const path = require('path');

// Helper function pour transformer les URLs de photos relatives en URLs complètes
function transformPhotoUrls(photos) {
  if (!photos || !Array.isArray(photos)) {
    return photos;
  }
  const baseUrl = getServerBaseUrl();
  return photos.map(photo => {
    // Si c'est déjà une URL complète (commence par http:// ou https://), on la garde telle quelle
    if (photo && (photo.startsWith('http://') || photo.startsWith('https://'))) {
      return photo;
    }
    // Sinon, on ajoute l'URL de base du serveur
    if (photo && photo.startsWith('/')) {
      return `${baseUrl}${photo}`;
    }
    return photo;
  });
}

// Charge le profil de l'utilisateur connecté
exports.getProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.user._id })
      .populate('userId', 'username email');

    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    // Transforme les URLs de photos en URLs complètes
    const profileObj = profile.toObject();
    if (profileObj.photos) {
      profileObj.photos = transformPhotoUrls(profileObj.photos);
    }

    res.json(profileObj);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Met à jour le profil
exports.updateProfile = async (req, res) => {
  try {
    const {
      pseudo,
      photos,
      description,
      instruments,
      styles,
      maxDistance,
      media,
      location
    } = req.body;

    let profile = await Profile.findOne({ userId: req.user._id });

    if (!profile) {
      // Crée le profil s'il n'existe pas
      profile = new Profile({
        userId: req.user._id,
        pseudo: pseudo || req.user.username,
        photos: photos || ['https://i.pravatar.cc/300?img=12'],
        description: description || '',
        instruments: instruments || [],
        styles: styles || [],
        maxDistance: maxDistance || 50,
        media: media || []
      });
    } else {
      // Met à jour le profil
      if (pseudo !== undefined) profile.pseudo = pseudo;
      if (photos !== undefined) profile.photos = photos;
      if (description !== undefined) profile.description = description;
      if (instruments !== undefined) profile.instruments = instruments;
      if (styles !== undefined) profile.styles = styles;
      if (maxDistance !== undefined) profile.maxDistance = maxDistance;
      if (media !== undefined) profile.media = media;
      
      // Gère la localisation : convertit latitude/longitude en format GeoJSON
      if (location !== undefined) {
        if (location.latitude !== undefined && location.longitude !== undefined) {
          // Format avec latitude/longitude séparés
          if (location.latitude !== null && location.longitude !== null) {
            profile.location = {
              type: 'Point',
              coordinates: [location.longitude, location.latitude] // GeoJSON: [longitude, latitude]
            };
          } else {
            profile.location = {
              type: 'Point',
              coordinates: null
            };
          }
        } else if (location.coordinates) {
          // Format GeoJSON déjà correct
          profile.location = location;
        } else if (location === null) {
          profile.location = {
            type: 'Point',
            coordinates: null
          };
        }
      }
      
      profile.updatedAt = new Date();
    }

    await profile.save();

    // Transforme les URLs de photos en URLs complètes avant de retourner
    const profileObj = profile.toObject();
    if (profileObj.photos) {
      profileObj.photos = transformPhotoUrls(profileObj.photos);
    }

    res.json({
      success: true,
      profile: profileObj
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil', error: error.message });
  }
};

// Récupère un profil par ID (pour la découverte)
exports.getProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await Profile.findOne({ userId: id })
      .populate('userId', 'username email');

    if (!profile) {
      return res.status(404).json({ message: 'Profil non trouvé' });
    }

    // Transforme les URLs de photos en URLs complètes
    const profileObj = profile.toObject();
    if (profileObj.photos) {
      profileObj.photos = transformPhotoUrls(profileObj.photos);
    }

    res.json(profileObj);
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

    // Détermine le type de fichier depuis l'extension
    const fileExtension = req.file.filename.split('.').pop().toLowerCase();
    let mediaType = 'mp3'; // par défaut
    if (fileExtension === 'mp3' || fileExtension === 'mpeg') {
      mediaType = 'mp3';
    } else if (fileExtension === 'wav') {
      mediaType = 'mp3'; // On stocke aussi les WAV comme mp3 dans le modèle
    }

    // Crée l'objet média
    const newMedia = {
      type: mediaType,
      url: songUrl
    };

    // Ajoute le fichier audio à la liste des médias du profil
    if (!profile.media) {
      profile.media = [];
    }
    profile.media.push(newMedia);

    profile.updatedAt = new Date();
    await profile.save();

    res.json({
      success: true,
      message: 'Fichier audio uploadé avec succès',
      songUrl: songUrl,
      media: profile.media
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


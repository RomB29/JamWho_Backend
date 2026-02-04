const User = require('../models/User');
const Profile = require('../models/Profile');
const jwt = require('jsonwebtoken');

// Génère un token JWT
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    { expiresIn: '30d' }
  );
};

// Vérifie si un utilisateur existe (par username ou email)
exports.checkUserExists = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.trim() === '') {
      return res.status(400).json({ message: 'Username requis' });
    }

    const user = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: username.trim().toLowerCase() }
      ]
    });

    res.json({ exists: !!user });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Inscription
exports.register = async (req, res) => {
  try {
    const { username, email, password, age, sexe } = req.body;

    // Vérifie si l'utilisateur existe déjà
    const existingUser = await User.findOne({
      $or: [
        { username },
        { email: email.toLowerCase() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'Username ou email déjà utilisé',
        field: existingUser.username === username ? 'username' : 'email'
      });
    }

    // Valide l'âge si fourni
    if (age !== undefined) {
      const ageNum = parseInt(age);
      if (isNaN(ageNum) || ageNum < 18 || ageNum > 100) {
        return res.status(400).json({ 
          message: 'L\'âge doit être entre 18 et 100 ans' 
        });
      }
    }

    // Valide le sexe si fourni
    if (sexe !== undefined && !['homme', 'femme', 'autre'].includes(sexe)) {
      return res.status(400).json({ 
        message: 'Le sexe doit être "homme", "femme" ou "autre"' 
      });
    }

    // Crée l'utilisateur
    const user = new User({
      username,
      email: email.toLowerCase(),
      password
    });

    await user.save();

    // Crée un profil avec les informations fournies
    const profileData = {
      userId: user._id,
      pseudo: username,
      photos: ['https://i.pravatar.cc/300?img=12'],
      description: '',
      instruments: [],
      styles: [],
      maxDistance: 50,
      media: []
    };

    // Ajoute l'âge et le sexe si fournis (sinon, ils seront requis et échoueront)
    if (age !== undefined) {
      profileData.age = parseInt(age);
    }
    if (sexe !== undefined) {
      profileData.sexe = sexe;
    }

    const profile = new Profile(profileData);
    await profile.save();

    // Génère le token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'inscription', error: error.message });
  }
};

// Connexion
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username et mot de passe requis' });
    }

    // Trouve l'utilisateur par username ou email
    const user = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: username.trim().toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }

    // Vérifie le mot de passe
    if (!user.password) {
      return res.status(401).json({ message: 'Compte créé avec Google. Utilisez la connexion Google.' });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }

    // Génère le token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la connexion', error: error.message });
  }
};

// Connexion avec Google
exports.loginWithGoogle = async (req, res) => {
  try {
    const { googleId, email, name, picture, accessToken } = req.body;

    if (!googleId || !email) {
      return res.status(400).json({ message: 'GoogleId et email requis' });
    }

    // TODO: Optionnel - Vérifier le token Google côté serveur pour plus de sécurité
    // if (accessToken) {
    //   const axios = require('axios');
    //   try {
    //     const response = await axios.get(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
    //     if (response.data.id !== googleId) {
    //       return res.status(401).json({ message: 'Token Google invalide' });
    //     }
    //   } catch (error) {
    //     return res.status(401).json({ message: 'Erreur lors de la vérification du token Google' });
    //   }
    // }

    // Cherche un utilisateur existant avec ce googleId
    let user = await User.findOne({ googleId });

    if (!user) {
      // Cherche par email
      user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        // Met à jour avec le googleId
        user.googleId = googleId;
        await user.save();
      } else {
        // Génère un username unique si nécessaire
        let username = name || email.split('@')[0];
        // Nettoie le username (enlève les caractères spéciaux)
        username = username.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        
        // Vérifie si le username existe déjà
        let existingUser = await User.findOne({ username });
        let counter = 1;
        const originalUsername = username;
        while (existingUser) {
          username = `${originalUsername}${counter}`;
          existingUser = await User.findOne({ username });
          counter++;
        }

        // Crée un nouvel utilisateur
        user = new User({
          username,
          email: email.toLowerCase(),
          googleId
        });
        await user.save();

        // Détermine la photo de profil (utilise la photo Google si disponible)
        const defaultPhoto = picture || 'https://i.pravatar.cc/300?img=12';

        // Crée un profil par défaut
        // Note: age et sexe sont requis - valeurs par défaut (l'utilisateur devra les modifier dans son profil)
        const profile = new Profile({
          userId: user._id,
          pseudo: name || user.username,
          age: 18, // Valeur par défaut (l'utilisateur devra le modifier dans son profil)
          sexe: 'autre', // Valeur par défaut (l'utilisateur devra le modifier dans son profil)
          photos: [defaultPhoto],
          description: '',
          instruments: [],
          styles: [],
          maxDistance: 50,
          media: []
        });
        await profile.save();
      }
    } else {
      // Si l'utilisateur existe déjà, met à jour le profil avec la photo Google si fournie
      if (picture) {
        const profile = await Profile.findOne({ userId: user._id });
        if (profile && (!profile.photos || profile.photos.length === 0 || profile.photos[0] === 'https://i.pravatar.cc/300?img=12')) {
          profile.photos[0] = picture;
          await profile.save();
        }
      }
    }

    // Génère le token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la connexion Google', error: error.message });
  }
};

// Vérifie l'authentification (endpoint pour vérifier le token)
exports.checkAuth = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    const isPremium = await User.syncPremiumIfExpired(user);
    res.json({
      isAuthenticated: true,
      userId: user._id,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isPremium: isPremium
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};


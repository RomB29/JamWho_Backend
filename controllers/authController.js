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
    const { username, email, password } = req.body;

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

    // Crée l'utilisateur
    const user = new User({
      username,
      email: email.toLowerCase(),
      password
    });

    await user.save();

    // Crée un profil par défaut
    const profile = new Profile({
      userId: user._id,
      pseudo: username,
      photos: ['https://i.pravatar.cc/300?img=12'],
      description: '',
      instruments: [],
      styles: [],
      maxDistance: 50,
      media: []
    });
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
    const { googleId, email, name } = req.body;

    if (!googleId || !email) {
      return res.status(400).json({ message: 'GoogleId et email requis' });
    }

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
        // Crée un nouvel utilisateur
        user = new User({
          username: name || email.split('@')[0],
          email: email.toLowerCase(),
          googleId
        });
        await user.save();

        // Crée un profil par défaut
        const profile = new Profile({
          userId: user._id,
          pseudo: name || user.username,
          photos: ['https://i.pravatar.cc/300?img=12'],
          description: '',
          instruments: [],
          styles: [],
          maxDistance: 50,
          media: []
        });
        await profile.save();
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
    res.json({
      isAuthenticated: true,
      userId: user._id,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isPremium: user.isPremium || false
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};


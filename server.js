const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// Charge les variables d'environnement
dotenv.config();

// Initialise Express
const app = express();

// Connexion à MongoDB
connectDB();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_ANDROID,
  process.env.FRONTEND_URL_PROD_MOBILE,
  process.env.FRONTEND_URL_PROD_WEB
]

// Middleware CORS personnalisé : permet l'accès public aux fichiers statiques
// et l'accès avec credentials pour les routes API
app.use((req, res, next) => {
  const isStaticFile = req.path.startsWith('/profile/') || req.path.startsWith('/song/');
  
  if (isStaticFile) {
    // Pour les fichiers statiques : accès public depuis n'importe quelle origine
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  } else {
    // Pour les routes API : accès depuis le frontend avec credentials
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Webhook Stripe : body brut obligatoire (doit être avant express.json())
const stripeController = require('./controllers/stripeController');
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  stripeController.handleWebhook
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Configuration des chemins statiques pour servir les fichiers uploadés
// Le dossier PUBLIC_UPLOAD doit être au même niveau que server.js
const staticDirectory = path.join(__dirname);
const PUBLIC_FOLDER_UPLOAD = 'PUBLIC_UPLOAD';

// Middleware pour servir les fichiers statiques AVANT toutes les autres routes
// Cette route doit être définie AVANT les routes API pour éviter les conflits

// Route statique pour servir les photos de profil (ACCÈS PUBLIC - pas d'authentification requise)
// Accès via: http://localhost:3000/profile/{userId}/photo_uploads/{filename}
const staticPhotoPath = path.join(staticDirectory, `${PUBLIC_FOLDER_UPLOAD}/profile/`);

app.use('/profile/', express.static(staticPhotoPath, {
  // Options pour améliorer les performances avec cache
  setHeaders: (res, filePath) => {
    // Cache les images pour améliorer les performances
    if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      res.set('Cache-Control', 'public, max-age=31536000'); // Cache 1 an
    }
  }
}));

// Route statique pour servir les fichiers audio (ACCÈS PUBLIC - pas d'authentification requise)
// Accès via: http://localhost:3000/song/{userId}/song_uploads/{filename}
const staticSongPath = path.join(staticDirectory, `${PUBLIC_FOLDER_UPLOAD}/profile/`);

app.use('/song/', express.static(staticSongPath, {
  // Options pour améliorer les performances avec cache
  setHeaders: (res, filePath) => {
    // Cache les fichiers audio pour améliorer les performances
    if (filePath.match(/\.mp3$/i)) {
      res.set('Content-Type', 'audio/mpeg');
      res.set('Cache-Control', 'public, max-age=31536000'); // Cache 1 an
    } else if (filePath.match(/\.wav$/i)) {
      res.set('Content-Type', 'audio/wav');
      res.set('Cache-Control', 'public, max-age=31536000');
    } else if (filePath.match(/\.ogg$/i)) {
      res.set('Content-Type', 'audio/ogg');
      res.set('Cache-Control', 'public, max-age=31536000');
    } else if (filePath.match(/\.m4a$/i)) {
      res.set('Content-Type', 'audio/mp4');
      res.set('Cache-Control', 'public, max-age=31536000');
    } else if (filePath.match(/\.webm$/i)) {
      res.set('Content-Type', 'audio/webm');
      res.set('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// Routes API (nécessitent authentification)
// IMPORTANT: Ces routes sont définies APRÈS la route statique /profile/
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/swipe', require('./routes/swipe'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/premium', require('./routes/premium'));
app.use('/api/stripe', require('./routes/stripe'));
app.use('/api/notifications', require('./routes/notifications'));

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'JamWho API is running',
    timestamp: new Date().toISOString()
  });
});

// Gestion des erreurs (doit être le dernier middleware)
app.use(errorHandler);

// Gestion des routes non trouvées
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

// Démarre le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📡 API disponible sur http://localhost:${PORT}/api`);
});


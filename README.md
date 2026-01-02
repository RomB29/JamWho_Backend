# JamWho Backend

Backend API pour JamWho - Application de rencontre pour musiciens

## 🚀 Installation

1. **Installer les dépendances**
   ```bash
   npm install
   ```

2. **Configurer les variables d'environnement**
   ```bash
   cp .env.example .env
   ```
   
   Puis éditez le fichier `.env` avec vos configurations :
   - `MONGODB_URI` : URL de connexion MongoDB
   - `JWT_SECRET` : Clé secrète pour les tokens JWT (changez-la en production)
   - `FRONTEND_URL` : URL du frontend pour CORS
   - `PORT` : Port du serveur (par défaut 3000)

3. **Démarrer MongoDB**
   
   Assurez-vous que MongoDB est installé et en cours d'exécution. Vous pouvez utiliser :
   - MongoDB local
   - MongoDB Atlas (cloud)
   - Docker : `docker run -d -p 27017:27017 mongo`

4. **Démarrer le serveur**
   
   Mode développement (avec nodemon) :
   ```bash
   npm run dev
   ```
   
   Mode production :
   ```bash
   npm start
   ```

## 📡 API Endpoints

### Authentification (`/api/auth`)

- `POST /api/auth/check-user` - Vérifie si un utilisateur existe
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `POST /api/auth/login/google` - Connexion avec Google
- `GET /api/auth/check` - Vérifie l'authentification (protégé)

### Profil (`/api/profile`)

- `GET /api/profile` - Récupère le profil de l'utilisateur connecté (protégé)
- `PUT /api/profile` - Met à jour le profil (protégé)
- `GET /api/profile/:id` - Récupère un profil par ID (protégé)

### Swipe (`/api/swipe`)

- `GET /api/swipe/profiles` - Récupère les profils disponibles pour le swipe (protégé)
- `POST /api/swipe/like` - Like un profil (protégé)
- `POST /api/swipe/dislike` - Dislike un profil (protégé)
- `GET /api/swipe/liked` - Récupère les profils likés (protégé)

### Matches (`/api/matches`)

- `GET /api/matches` - Récupère tous les matches (protégé)
- `GET /api/matches/:id` - Récupère un match spécifique (protégé)

### Messages (`/api/messages`)

- `GET /api/messages/:matchId` - Récupère les messages d'un match (protégé)
- `POST /api/messages` - Envoie un message (protégé)
- `PUT /api/messages/:matchId/read` - Marque les messages comme lus (protégé)

## 🔐 Authentification

Toutes les routes protégées nécessitent un token JWT dans le header :
```
Authorization: Bearer <token>
```

Le token est retourné lors de l'inscription ou de la connexion.

## 📦 Structure du projet

```
Backend/
├── config/
│   └── database.js          # Configuration MongoDB
├── controllers/
│   ├── authController.js    # Logique d'authentification
│   ├── profileController.js # Gestion des profils
│   ├── swipeController.js   # Gestion du swipe
│   ├── matchController.js   # Gestion des matches
│   └── messageController.js # Gestion des messages
├── middleware/
│   ├── auth.js              # Middleware d'authentification JWT
│   └── errorHandler.js      # Gestion des erreurs
├── models/
│   ├── User.js              # Modèle User
│   ├── Profile.js           # Modèle Profile
│   ├── Swipe.js             # Modèle Swipe
│   ├── Match.js             # Modèle Match
│   └── Message.js           # Modèle Message
├── routes/
│   ├── auth.js              # Routes d'authentification
│   ├── profile.js           # Routes de profil
│   ├── swipe.js             # Routes de swipe
│   ├── matches.js           # Routes de matches
│   └── messages.js          # Routes de messages
├── .env.example             # Exemple de configuration
├── package.json
├── README.md
└── server.js                # Point d'entrée
```

## 🗄️ Modèles de données

### User
- `username` (String, unique, required)
- `email` (String, unique, required)
- `password` (String, hashed)
- `googleId` (String, optional)
- `createdAt` (Date)

### Profile
- `userId` (ObjectId, ref: User, unique)
- `pseudo` (String, required)
- `photos` (Array of Strings)
- `description` (String)
- `instruments` (Array of Strings)
- `styles` (Array of Strings)
- `maxDistance` (Number, default: 50)
- `media` (Array of {type, url})
- `location` ({latitude, longitude})
- `updatedAt` (Date)

### Swipe
- `userId` (ObjectId, ref: User)
- `targetUserId` (ObjectId, ref: User)
- `type` (String, enum: ['like', 'dislike'])
- `createdAt` (Date)

### Match
- `users` (Array of ObjectId, ref: User)
- `createdAt` (Date)
- `lastMessageAt` (Date)

### Message
- `matchId` (ObjectId, ref: Match)
- `senderId` (ObjectId, ref: User)
- `receiverId` (ObjectId, ref: User)
- `content` (String, required)
- `read` (Boolean, default: false)
- `readAt` (Date)
- `createdAt` (Date)

## 🔧 Technologies utilisées

- **Express.js** - Framework web
- **MongoDB** - Base de données NoSQL
- **Mongoose** - ODM pour MongoDB
- **JWT** - Authentification par tokens
- **bcryptjs** - Hashage des mots de passe
- **CORS** - Gestion des requêtes cross-origin

## 📝 Notes

- Les mots de passe sont hashés avec bcrypt avant d'être stockés
- Les tokens JWT expirent après 30 jours
- La recherche géographique utilise les index 2dsphere de MongoDB
- Les matches sont créés automatiquement quand deux utilisateurs se likent mutuellement

## 🐛 Développement

Pour le développement, utilisez `npm run dev` qui utilise nodemon pour redémarrer automatiquement le serveur lors des modifications.


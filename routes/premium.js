const express = require('express');
const router = express.Router();
const premiumController = require('../controllers/premiumController');
const auth = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(auth);

// Récupère les informations premium et les limites
router.get('/info', premiumController.getPremiumInfo);

// Récupère les limites de l'utilisateur (format compatible frontend)
router.get('/limits', premiumController.getLimits);

// Met à jour le statut premium (pour système de paiement/admin)
router.put('/status', premiumController.updatePremiumStatus);

// Met à jour le nombre de swipes 
router.put('/incrementSwipes', (req, res, next) => {
  next();
}, premiumController.updateSwipes);


module.exports = router;


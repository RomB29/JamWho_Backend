const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const auth = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(auth);

router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);
router.get('/:id', profileController.getProfileById);

module.exports = router;


const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const auth = require('../middleware/auth');
const { uploadProfilePhoto } = require('../middleware/uploadPhoto');

// Toutes les routes nécessitent une authentification
router.use(auth);

router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);
router.get('/:id', profileController.getProfileById);

// Upload d'avatar (photo de profil)
// Le middleware auth doit être exécuté avant uploadProfilePhoto pour avoir req.user disponible
router.post('/photo', uploadProfilePhoto.single('photo'), profileController.uploadPhoto);
router.delete('/photo', profileController.deletePhoto);

module.exports = router;


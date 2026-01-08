const express = require('express');
const router = express.Router();
const swipeController = require('../controllers/swipeController');
const auth = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(auth);

router.get('/profiles', swipeController.getProfiles);
router.post('/like', swipeController.likeProfile);
router.get('/liked', swipeController.getLikedProfiles);
router.get('/who-liked-me', swipeController.getWhoLikedMe);
router.post('/remove-liked', swipeController.removeLike);

module.exports = router;


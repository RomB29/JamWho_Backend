const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(auth);

router.get('/:matchId', messageController.getMessages);
router.post('/', messageController.sendMessage);
router.put('/:matchId/read', messageController.markAsRead);

module.exports = router;


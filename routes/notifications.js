const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(auth);

router.get('/', notificationController.getNotifications);
router.get('/list', notificationController.getNotificationList);
router.put('/reset-new-like', notificationController.resetNewLike);
router.put('/reset-message-unread/:conversationId', notificationController.resetMessageUnread);
router.put('/:id/read', notificationController.markNotificationRead);
router.put('/read-all', notificationController.markAllNotificationsRead);

module.exports = router;


const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');
const auth = require('../middleware/auth');

// Routes protégées (auth)
router.get('/checkout-session/:sessionId', auth, stripeController.getCheckoutSessionStatus);
router.post('/create-portal-session', auth, stripeController.createPortalSession);

module.exports = router;

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Routes publiques
router.post('/check-user', authController.checkUserExists);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/login/google', authController.loginWithGoogle);

// Route protégée
router.get('/check', auth, authController.checkAuth);

router.post('/onboarding-validated', authController.onboardingValidated)

module.exports = router;


const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

router.get('/dashboard', auth, userController.getUserDashboard);
router.get('/bookmarks', auth, userController.getUserBookmarks);
router.put('/profile', auth, userController.updateUserProfile);

module.exports = router;

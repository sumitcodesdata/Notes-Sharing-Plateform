const User = require('../models/User');
const Note = require('../models/Note');

// @desc    Get dashboard metrics and uploaded notes for the user
// @route   GET /api/users/dashboard
// @access  Private
exports.getUserDashboard = async (req, res, next) => {
  try {
    const notes = await Note.find({ author: req.user.id }).sort({ createdAt: -1 });

    const totalDownloads = notes.reduce((sum, note) => sum + note.downloads, 0);
    const totalEarnings = notes.reduce((sum, note) => sum + (note.downloads * note.price * 0.70), 0);

    res.json({
      totalDownloads,
      totalEarnings,
      notes
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get saved/bookmarked notes of the user
// @route   GET /api/users/bookmarks
// @access  Private
exports.getUserBookmarks = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('savedNotes');
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    res.json(user.savedNotes);
  } catch (err) {
    next(err);
  }
};

// @desc    Update user profile details (name, email, password)
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res, next) => {
  const { name, email, password } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    if (email && email.toLowerCase() !== user.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        res.status(400);
        throw new Error('Email is already taken');
      }
      user.email = email.toLowerCase();
    }

    if (name) {
      user.name = name;
    }

    if (password) {
      // Direct assignment triggers mongoose pre-save hashing
      user.password = password;
    }

    await user.save();

    res.json({
      id: user.id,
      name: user.name,
      email: user.email
    });
  } catch (err) {
    next(err);
  }
};

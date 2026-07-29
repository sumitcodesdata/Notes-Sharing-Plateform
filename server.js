const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Create uploads folder if not exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF documents are allowed!'), false);
    }
  }
});

const User = require('./models/User');
const Note = require('./models/Note');
const auth = require('./middleware/auth');

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/notes_share')
  .then(() => {
    console.log('Successfully connected to MongoDB.');
    seedDatabase();
  })
  .catch((err) => {
    console.error('MongoDB database connection error:', err);
  });

// API Routes

// Auth Routes

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    user = new User({ name, email, password });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    // Create JWT token
    const payload = { user: { id: user.id } };
    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'supersecretkeyfornotesshare123',
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.status(201).json({
          token,
          user: { id: user.id, name: user.name, email: user.email }
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const payload = { user: { id: user.id } };
    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'supersecretkeyfornotesshare123',
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: { id: user.id, name: user.name, email: user.email }
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Notes Routes

app.get('/api/notes', async (req, res) => {
  const { search, category, university, price } = req.query;

  try {
    let query = {};

    if (category) {
      query.category = category.toLowerCase();
    }

    if (university) {
      query.university = { $regex: new RegExp(university, 'i') };
    }

    if (price) {
      if (price === 'free') {
        query.price = 0;
      } else if (price === 'paid') {
        query.price = { $gt: 0 };
      }
    }

    if (search) {
      query.$or = [
        { title: { $regex: new RegExp(search, 'i') } },
        { description: { $regex: new RegExp(search, 'i') } },
        { university: { $regex: new RegExp(search, 'i') } }
      ];
    }

    const notes = await Note.find(query).sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/notes/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.id || req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note document not found' });
    }
    res.json(note);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Note document not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/notes', auth, upload.single('pdf'), async (req, res) => {
  const { title, university, category, price, description, tags } = req.body;

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a PDF document' });
    }

    if (!title || !university || !category || !description) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Please fill in all required fields' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'User not found' });
    }

    const priceVal = parseFloat(price) || 0;
    const isFree = priceVal === 0;
    const tagsArray = tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];

    const note = new Note({
      title,
      description,
      category: category.toLowerCase(),
      university,
      author: req.user.id,
      authorName: user.name,
      price: priceVal,
      isFree,
      filePath: req.file.path,
      tags: tagsArray
    });

    await note.save();
    res.status(201).json(note);
  } catch (err) {
    console.error(err.message);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/notes/:id/reviews', auth, async (req, res) => {
  const { rating, text } = req.body;

  try {
    if (!rating || !text) {
      return res.status(400).json({ message: 'Rating and review comment text are required' });
    }

    const ratingVal = parseInt(rating);
    if (ratingVal < 1 || ratingVal > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5 stars' });
    }

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note document not found' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newReview = {
      authorName: user.name,
      rating: ratingVal,
      text
    };

    note.reviews.unshift(newReview);

    const totalRating = note.reviews.reduce((sum, rev) => sum + rev.rating, 0);
    note.rating = totalRating / note.reviews.length;

    await note.save();
    res.json(note);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/notes/:id/download', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note document not found' });
    }

    if (!fs.existsSync(note.filePath)) {
      return res.status(404).json({ message: 'Physical PDF file not found on server' });
    }

    note.downloads += 1;
    await note.save();

    const safeTitle = note.title.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
    res.download(note.filePath, safeTitle);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// User & Dashboard Routes

app.get('/api/users/dashboard', auth, async (req, res) => {
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
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users/bookmarks', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('savedNotes');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.savedNotes);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/notes/:id/bookmark', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const bookmarkIndex = user.savedNotes.indexOf(note.id);
    let saved = false;

    if (bookmarkIndex > -1) {
      user.savedNotes.splice(bookmarkIndex, 1);
    } else {
      user.savedNotes.push(note.id);
      saved = true;
    }

    await user.save();
    res.json({ saved });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/users/profile', auth, async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (email && email.toLowerCase() !== user.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ message: 'Email is already taken' });
      }
      user.email = email.toLowerCase();
    }

    if (name) {
      user.name = name;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    res.json({
      id: user.id,
      name: user.name,
      email: user.email
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Database Seeding
// ==========================================
async function seedDatabase() {
  try {
    const noteCount = await Note.countDocuments();
    if (noteCount > 0) {
      console.log('Database already contains records. Skipping seed logic.');
      return;
    }

    console.log('Note collection is empty. Executing seed database logic...');

    let creator = await User.findOne({ email: 'aarav@notesshare.com' });
    if (!creator) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      creator = new User({
        name: 'Aarav Sharma',
        email: 'aarav@notesshare.com',
        password: hashedPassword
      });
      await creator.save();
      console.log('Created default creator Aarav Sharma (aarav@notesshare.com)');
    }

    let creator2 = await User.findOne({ email: 'ananya@notesshare.com' });
    if (!creator2) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      creator2 = new User({
        name: 'Ananya Iyer',
        email: 'ananya@notesshare.com',
        password: hashedPassword
      });
      await creator2.save();
    }

    let creator3 = await User.findOne({ email: 'devansh@notesshare.com' });
    if (!creator3) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      creator3 = new User({
        name: 'Devansh Gupta',
        email: 'devansh@notesshare.com',
        password: hashedPassword
      });
      await creator3.save();
    }

    const seedFiles = [
      { name: 'seed-algorithms.pdf', text: 'NotesShare Seed PDF File Content: COL106 Algorithms Lecture Notes by Aarav Sharma' },
      { name: 'seed-ml.pdf', text: 'NotesShare Seed PDF File Content: EE769 Machine Learning Cheat Sheet by Ananya Iyer' },
      { name: 'seed-calculus.pdf', text: 'NotesShare Seed PDF File Content: MA201 Multivariable Calculus by Devansh Gupta' }
    ];

    const filePaths = {};
    seedFiles.forEach(sf => {
      const filePath = path.join(uploadsDir, sf.name);
      fs.writeFileSync(filePath, sf.text);
      filePaths[sf.name] = filePath;
      console.log(`Created seed file at ${filePath}`);
    });

    const defaultNotes = [
      {
        title: "Introduction to Algorithms (IIT Delhi COL106) - Lecture Notes",
        description: "Highly comprehensive lecture notes covering asymptotic notations, divide-and-conquer, recurrence relations, and heaps.",
        category: "computer science",
        university: "IIT Delhi",
        author: creator._id,
        authorName: creator.name,
        downloads: 342,
        rating: 4.8,
        price: 0,
        isFree: true,
        filePath: filePaths['seed-algorithms.pdf'],
        tags: ["algorithms", "dsa", "complexity", "heaps"],
        reviews: [
          { authorName: "Aditya Verma", rating: 5, text: "Extremely detailed lecture notes. The divide-and-conquer section was very clear!" },
          { authorName: "Riya Sen", rating: 4, text: "Really helpful summaries, but could include more recurrence graph examples." }
        ]
      },
      {
        title: "Machine Learning Cheat Sheet & Core Math Summaries (IIT Bombay)",
        description: "Ultimate cheat sheet summarizing Supervised Learning (Regression, SVMs, Decision Trees) and Unsupervised Learning (K-Means, PCA).",
        category: "computer science",
        university: "IIT Bombay",
        author: creator2._id,
        authorName: creator2.name,
        downloads: 1205,
        rating: 5.0,
        price: 0,
        isFree: true,
        filePath: filePaths['seed-ml.pdf'],
        tags: ["machine-learning", "cheat-sheet", "math", "classification"],
        reviews: [
          { authorName: "Karan Johar", rating: 5, text: "The perfect quick reference sheet for exam review. Absolutely stellar work!" }
        ]
      },
      {
        title: "Multivariable Calculus - Double Integrals & Stokes' Theorem",
        description: "Step-by-step calculus notes covering double integrals in polar coordinates, vector fields, and Green's/Stokes' Theorems.",
        category: "mathematics",
        university: "NIT Trichy",
        author: creator3._id,
        authorName: creator3.name,
        downloads: 189,
        rating: 4.7,
        price: 0,
        isFree: true,
        filePath: filePaths['seed-calculus.pdf'],
        tags: ["mathematics", "calculus", "integrals", "vectors"],
        reviews: [
          { authorName: "Sneha Reddy", rating: 4, text: "Good multivariable integration steps. The Stokes theorem diagrams were awesome." }
        ]
      }
    ];

    await Note.insertMany(defaultNotes);
    console.log('Successfully seeded database with default study notes.');
  } catch (err) {
    console.error('Error during database seeding:', err);
  }
}

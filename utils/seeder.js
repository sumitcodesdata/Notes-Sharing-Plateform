const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Note = require('../models/Note');

const uploadsDir = path.join(__dirname, '../uploads');

async function seedDatabase() {
  try {
    // Create uploads folder if not exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const noteCount = await Note.countDocuments();
    if (noteCount > 0) {
      console.log('Database already contains records. Skipping seed logic.');
      return;
    }

    console.log('Note collection is empty. Executing seed database logic...');

    // Seed Creator 1
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

    // Seed Creator 2
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
      console.log('Created default creator Ananya Iyer (ananya@notesshare.com)');
    }

    // Seed Creator 3
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
      console.log('Created default creator Devansh Gupta (devansh@notesshare.com)');
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

module.exports = seedDatabase;

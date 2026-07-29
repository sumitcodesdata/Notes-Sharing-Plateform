# NotesShare - Academic Notes Sharing Platform

NotesShare is a fullstack web application designed for students and educators in India to upload, share, search, preview, and monetize course-specific study notes. The platform supports secure user authentication, database-driven searches, interactive note bookmarks, ratings/reviews, and creator dashboards tracking downloads and earnings.

---

## 🚀 Tech Stack

- **Frontend:** HTML5, Vanilla CSS3 (responsive grid, CSS custom variables, custom animations), Vanilla JavaScript (ES6, Fetch API)
- **Backend:** Node.js, Express.js (REST API framework)
- **Database:** MongoDB (NoSQL database) with Mongoose ODM
- **Authentication:** JSON Web Tokens (JWT) & `bcryptjs` password hashing
- **File Handling:** `multer` (multipart form-data parsing for PDF document storage)
- **Security & Utilities:** `cors`, `dotenv` configuration manager

---

## 📂 Project Structure

```text
Notes_Sharing_Platform/
├── models/                 # Mongoose schemas for MongoDB
│   ├── User.js             # User profiles & bookmarks list
│   └── Note.js             # Notes metadata, ratings, & nested reviews
├── middleware/             # Express route guards
│   └── auth.js             # JWT verification middleware
├── public/                 # Static frontend files served by Express
│   ├── index.html          # Main HTML structure and UI modals
│   ├── style.css           # Styling rules & custom ambient themes
│   ├── app.js              # Client-side routing, API fetching, & DOM bindings
│   └── BGImage.png         # Ambient hero background image asset
├── uploads/                # Local storage directory for uploaded PDF documents
├── .env                    # Local environment variables (Port, secrets, DB connection)
├── .gitignore              # Files excluded from Git version control
├── package.json            # NPM scripts and project dependencies
├── server.js               # Express server configuration, API routes, & database seeder
└── README.md               # Onboarding and development instructions (This file)
```

---

## 🗄️ Database Architecture & Schemas

The application uses MongoDB to model two principal entities: **Users** and **Notes**.

### 1. User Schema (`models/User.js`)
Stores user profiles and referenced bookmarks.
```javascript
{
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Hashed using bcryptjs
  savedNotes: [{ type: Schema.Types.ObjectId, ref: 'Note' }], // Bookmarked notes references
  createdAt: { type: Date, default: Date.now }
}
```

### 2. Note Schema (`models/Note.js`)
Tracks note files, downloads, ratings, and feedback reviews.
```javascript
{
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  university: { type: String, required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  price: { type: Number, required: true, default: 0 },
  isFree: { type: Boolean, required: true, default: true },
  filePath: { type: String, required: true }, // Disk path of the PDF file
  tags: [{ type: String }],
  downloads: { type: Number, default: 0 },
  rating: { type: Number, default: 5.0 },
  reviews: [
    {
      authorName: { type: String, required: true },
      rating: { type: Number, required: true, min: 1, max: 5 },
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
}
```

---

## 🔌 API Endpoints Reference

### 1. Authentication API
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---|
| `POST` | `/api/auth/signup` | Registers a new user. Returns JWT and profile object. | No |
| `POST` | `/api/auth/login` | Validates credentials. Returns JWT and profile object. | No |
| `GET` | `/api/auth/me` | Decodes JWT token and returns user details. | Yes |

### 2. Notes API
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---|
| `GET` | `/api/notes` | Retrieves notes list. Supports filters: `search`, `category`, `university`, `price` (free/paid). | No |
| `GET` | `/api/notes/:id` | Returns details and reviews of a specific note. | No |
| `POST` | `/api/notes` | Uploads a new PDF note (handles multipart form data). | Yes |
| `POST` | `/api/notes/:id/reviews` | Posts review rating and comments to a note. Re-calculates note rating average. | Yes |
| `GET` | `/api/notes/:id/download` | Increments note download statistics and starts local PDF file download. | No |

### 3. User & Dashboard API
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---|
| `GET` | `/api/users/dashboard` | Returns uploaded notes list, total download counts, and user's 70% share of earnings. | Yes |
| `GET` | `/api/users/bookmarks` | Returns user's bookmarked notes. | Yes |
| `POST` | `/api/notes/:id/bookmark` | Toggles note inclusion inside `savedNotes` (bookmark). | Yes |
| `PUT` | `/api/users/profile` | Updates user details (name, email, password). | Yes |

---

## 🛠️ Local Development Setup

Follow these instructions to run the application locally on your machine:

### Prerequisites
- Install [Node.js](https://nodejs.org/) (v16+ recommended).
- Install and run [MongoDB Community Server](https://www.mongodb.com/try/download/community) locally.

### Steps
1. **Install Dependencies:**
   Navigate to the project root and run:
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory (based on `.env.example` values):
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/notes_share
   JWT_SECRET=add_your_secret_key_here
   ```

3. **Start the Application:**
   Start the Express server:
   ```bash
   npm start
   ```

4. **Verify Bootup:**
   The server will start on port `5000` (or the configured `PORT`). On launch:
   - It connects to your local MongoDB instance.
   - **Auto-Seeding:** If the database is empty, the server automatically registers three seed creator users, creates mock PDF documents inside the `/uploads` directory, and seeds the default notes into MongoDB.
   - Access the platform by opening **`http://localhost:5000`** in your browser.

---

## ☁️ Deployment Reference

When deploying the application to a cloud host (Render, Heroku, Railway, etc.):

1. **Host Environment Variables:** Set up environment variables inside your host dashboard:
   - Set `MONGODB_URI` to a cloud-hosted MongoDB Atlas URI string.
   - Set `JWT_SECRET` to a strong unique security string.
2. **Persistent Storage Volume:** Cloud deployment servers use ephemeral file systems. Because uploaded notes are saved to `/uploads` on the disk, you **must attach a persistent volume** mounted at `/uploads` on the server to prevent file deletion when the instance restarts.
3. **Build & Start commands:** Set compile scripts to:
   - Build: `npm install`
   - Start: `npm start`

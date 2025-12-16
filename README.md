# EduGuide

A lightweight career guidance web app that helps users explore careers, skills, and interests and provides personalized suggestions. This repository contains a Flask-based backend (API + seeding scripts) and a static frontend (HTML/CSS/JS) that together demonstrate a minimal career-path recommendation prototype.

**Status:** Development — the project includes DB seeding scripts, an ML-ready dataset, and a Flask API. You will need a running MongoDB instance (Atlas or local) and a `.env` file for the backend to run correctly.

**Table of contents**
- **Project**: What this repo contains
- **Tech Stack**: Languages and libraries used
- **Repository Structure**: Key files and folders
- **Setup**: Local setup, environment, and dependencies
- **Seeding the DB**: How to populate master collections
- **Run (development)**: How to start backend and frontend locally
- **Deployment**: Notes for deploying to a hosting provider
- **Troubleshooting**: Common issues and fixes (Mongo SRV/DNS)
- **Contributing** and **License**

**Project**

EduGuide is a small prototype for exploring career paths based on users' skills, interests, strengths, and weaknesses. It includes:

- A Flask backend (`backend/app.py`) that handles authentication, search endpoints, and recommendation-related routes.
- Seeding scripts (`backend/seed_master_skills_interests.py`, `backend/seed.py`) that populate MongoDB collections from the dataset.
- A static frontend under `frontend/` that implements the UI for adding skills/interests and viewing suggestions.
- A small ML dataset in `ml_data/final_dataset.csv` and model artifacts (if used) under `backend/models/`.

**Tech Stack**

- Backend: Python, Flask, PyMongo, python-dotenv
- Frontend: Vanilla HTML/CSS/JavaScript
- Data: CSV dataset in `ml_data/` and optional `joblib` model artifacts under `backend/models/`
- Recommended deployment: Render/Heroku for backend + MongoDB Atlas (production), or local Docker Mongo for development.

**Repository Structure (important files)**

- `backend/`
	- `app.py` — Flask application and API endpoints
	- `seed_master_skills_interests.py` — populates `master_skills` and `master_interests` from the CSV
	- `seed.py` — seeds `master_strengths` and `master_weaknesses`
	- `models/` — ML model artifacts and encoders (`*.joblib`)
	- `requirements.txt` — Python dependencies for the backend
- `frontend/`
	- `index.html`, `fullinfo.html`, `pathfinder.html` — static pages
	- `js/` — UI logic (`main.js`, `fullinfo.js`, `pathfinder.js`)
	- `css/styles.css` — styling
- `ml_data/` — `final_dataset.csv` (source data for seeding)

**Prerequisites**

- Python 3.10+ installed and on PATH
- Git (optional)
- A MongoDB instance reachable from your machine (MongoDB Atlas is recommended). Alternatively, run MongoDB locally (native or Docker).

If you plan to deploy the backend, you'll also need an account on a host (Render, Heroku, or similar) and a MongoDB Atlas cluster or other managed DB.

**Environment variables**

Create a `.env` file inside `backend/` (or set env vars in your host) with at least the following values:

```
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.example.mongodb.net/eduguide?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_here
# Optional for development
FLASK_ENV=development
```

Notes:
- If you encounter DNS or SRV resolution timeouts with `mongodb+srv://`, consider using the standard connection string (non-SRV) or run MongoDB locally via Docker. See Troubleshooting below.

**Setup (local development)**

1. Clone the repo and change into project root (if you haven't already):

```powershell
git clone https://github.com/<your-user>/eduguide.git
cd "career project"
```

2. Create and activate a virtual environment, then install backend dependencies:

```powershell
python -m venv venv
.\\venv\\Scripts\\Activate.ps1
pip install -r backend/requirements.txt
```

3. Add the `.env` file in `backend/` as described above.

4. Seed the database (optional but recommended):

```powershell
python backend/seed_master_skills_interests.py
python backend/seed.py
```

Seeding output will show counts of unique skills/interests and how many items were inserted or upserted.

**Run (development)**

- Start the backend (dev):

```powershell
# from project root
python backend/app.py
```

This runs the Flask dev server. The API defaults to `http://127.0.0.1:5000` or `http://0.0.0.0:5000` depending on config.

- Open the frontend:

You can open `frontend/index.html` directly in the browser, or serve the folder with a simple HTTP server (recommended for fetch/XHR to work properly):

```powershell
cd frontend
# Python built-in server (serves on port 8000)
python -m http.server 8000
```

Visit `http://127.0.0.1:8000` and use the UI, which talks to the backend API.

**Seeding details**

- `backend/seed_master_skills_interests.py` reads `ml_data/final_dataset.csv` and extracts unique skills and interests, then upserts them into `master_skills` and `master_interests` collections.
- `backend/seed.py` inserts pre-defined strengths/weaknesses lists into `master_strengths` and `master_weaknesses`.

Run the seed scripts after configuring `MONGO_URI`. If items already exist the scripts will upsert (update or insert) and you will see counts reported in the console.

**Deployment notes**

- For production, prefer a WSGI server such as Gunicorn and host the backend on a Linux-based host (Render, Heroku, or a VPS). Example Procfile / start command:

```
gunicorn --bind 0.0.0.0:$PORT app:app
```

- Ensure `MONGO_URI` points to your Atlas cluster (or production DB) and that your hosting environment has the environment variables set securely.
- For static frontend deployments, use Netlify, Vercel, or a static hosting service. Configure the frontend to call the production API URL.

**Troubleshooting**

- MongoDB SRV/DNS timeouts:
	- Error: `pymongo.errors.ConfigurationError: The DNS operation timed out` when connecting to a `mongodb+srv://` URI.
	- Fixes:
		- Confirm network/DNS allows SRV lookups. Some networks or Windows DNS configs can block SRV resolution.
		- Try the non-SRV connection string from Atlas (the one that starts with `mongodb://` and includes host:port entries) instead of `mongodb+srv://`.
		- Run a local MongoDB instance for development (Docker example):

```powershell
docker run --name eduguide-mongo -p 27017:27017 -d mongo:6
```

		- Update `.env` to use `mongodb://localhost:27017/eduguide` when using local Mongo.

- Password hashing / login failures:
	- If you previously used `bcrypt` to store byte-hashes and later switched to `werkzeug.security.generate_password_hash`, older records may need a migration or a login fallback. The backend includes guidance for using `check_password_hash`.

**Testing**

- There are no automated tests included at the moment. Manual checks:
	- Start backend and frontend and verify search endpoints: `GET /api/get-skills` and `GET /api/get-interests` should return lists.
	- Register a user with the API, then login.

**Contributing**

- Feel free to open issues or PRs. Typical improvements:
	- Add unit tests for API endpoints
	- Add CI for linting and tests
	- Improve frontend UX and accessibility

**License & Credits**

- This project is a personal/learning project. Add your preferred license if you wish to publish it publicly.

---

If you'd like, I can:
- push this README to the repository for you, or
- also add a short `CONTRIBUTING.md` and a minimal `Procfile` for deploying to Render/Heroku.

Tell me which next step you'd like.

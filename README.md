# 🚀 BountyAI - Space Cowboy Automation

> An AI-powered bounty assignment system for hackathons and team project management

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-Proprietary-red)
![Python](https://img.shields.io/badge/python-3.11+-green)
![FastAPI](https://img.shields.io/badge/fastapi-0.120.0-009688)

## 🎯 Project Overview

BountyAI is a hackathon project themed around "Space Cowboy automation" that automatically assigns project tasks ("bounties") to teams based on their skills, productivity rates, and current workload using AI/ML algorithms.

**Current Status**: ✅ **Backend Complete & Tested**

## ✨ Features

### 🤖 Intelligent Team Assignment
- **Skill-Based Matching** (50% weight) - Matches required skills with team capabilities
- **Productivity Aware** (30% weight) - Considers historical team performance
- **Workload Balanced** (20% weight) - Prevents over-allocation
- **Transparent Scoring** - Shows all scores and reasoning

### 📊 Comprehensive Analytics
- Team productivity metrics
- Capacity utilization tracking
- Assignment history
- Performance trends

### 🔐 Professional & Secure
- Full copyright protection
- Comprehensive API documentation
- CORS-enabled for frontend
- Production-ready code

## 🏗️ Project Structure

```
BountyAI/
├── backend/                    # FastAPI backend
│   ├── main.py                # API endpoints
│   ├── ml_model.py            # Team assignment algorithm
│   ├── requirements.txt        # Python dependencies
│   ├── data/
│   │   ├── teams.json         # 5 mock teams
│   │   └── projects.json      # 6 mock bounties
│   └── README.md              # Backend documentation
├── frontend/                   # React 19 + Vite frontend
│   ├── src/                   # Application source
│   ├── package.json           # Frontend dependencies
│   └── README.md              # Frontend documentation & Firebase setup
├── docs/                      # Architecture and integration guides
│   └── FirebaseDataModel.md   # Firestore schema blueprint
├── LICENSE                     # Copyright license
├── LICENSE.md                  # Detailed terms
├── QUICK_START.md             # Quick reference guide
└── BACKEND_COMPLETE.md        # Implementation details
```

## 🚀 Quick Start

### Backend Setup

```bash
cd backend
cp .env.example .env  # populate Firebase Admin credentials
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Server runs at `http://localhost:8000`.

> 🔐 The backend requires a Firebase service account with Firestore + Auth admin rights. Download it from the Firebase console and reference it via `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_BASE64` in `.env`.

### Frontend Setup

```bash
cd frontend
cp .env.example .env  # add Firebase web app credentials
npm install
npm run dev
```

The UI is served at `http://localhost:5173` and proxies API calls to the FastAPI backend.

### Cloudflare Worker (AI Copilot)

```bash
cd cloudflare
npm install
wrangler login  # once per machine
npm run deploy
```

The deploy step prints the Worker URL (for example `https://bountyai-launch-copilot.<account>.workers.dev`). Copy that into `frontend/.env` as `VITE_CLOUDFLARE_WORKER_URL`. If you configure a shared secret, store it in the Worker via `wrangler secret put WORKER_AUTH_TOKEN` and mirror the value in `VITE_CLOUDFLARE_WORKER_TOKEN` so the frontend is authorized.

### Firebase CLI (Optional but recommended)

```bash

#### Seed Firestore with the bundled fixtures

```bash
cd backend
python seed_firestore.py --tenant default --reset
```

The script copies `data/teams.json` and `data/projects.json` into Firestore so the API serves live data immediately.
firebase login
firebase init firestore hosting  # select your project
firebase emulators:start --only firestore,auth
```

`.firebaserc` and `firebase.json` remain untracked thanks to `.gitignore` rules.

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | API info |
| GET | `/health` | Health check |
| GET | `/get_teams` | List all teams |
| GET | `/get_projects` | List all bounties |
| POST | `/assign_bounty` | Assign bounty to best-fit team |
| GET | `/get_dashboard` | View analytics |

### Interactive API Docs

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 📊 Data Models

### Teams (5 Available)
- **Alpha Pilots** - Frontend specialists (React, UI/UX)
- **Beta Crew** - Backend specialists (Python, API, Database)
- **Gamma Squadron** - DevOps experts (Infrastructure)
- **Delta Force** - Full-stack developers
- **Echo Knights** - ML/Data Science specialists

### Bounties (6 Available)
- Space Dashboard UI Redesign ($5K)
- Asteroid Detection API ($8K)
- Deployment Pipeline Setup ($7K)
- User Authentication Module ($4.5K)
- Predictive Analytics Engine ($10K)
- Real-time Data Visualization ($6K)

## 🤖 AI Assignment Algorithm

The assignment engine scores teams using:

```
Score = (Skill Match × 0.50) + (Productivity × 0.30) + (Workload × 0.20)
```

**Example**: Assigning ML project → Echo Knights selected with 86.3/100 fit score

## 📦 Tech Stack

### Backend
- **Framework**: FastAPI 0.120.0
- **Server**: Uvicorn 0.38.0
- **Validation**: Pydantic 2.12.3
- **Python**: 3.11+

### Frontend (Coming Soon)
- **Framework**: React 19 + TypeScript
- **Build**: Vite
- **Animations**: Vanta.js, anime.js
- **Charts**: Chart.js

## 📝 API Example

### Assign a Bounty

```bash
curl -X POST http://localhost:8000/assign_bounty \
  -H "Content-Type: application/json" \
  -d '{"bounty_id": "bounty_001"}'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "assigned_team": {
      "name": "Alpha Pilots",
      "skills": ["frontend", "ui/ux", "react"],
      "productivity_rate": 0.85
    },
    "fit_score": 87.5,
    "reasoning": "Alpha Pilots selected based on: 3/3 required skills matched..."
  }
}
```

## 🔐 License

**Copyright © 2025 Luis Penson**

All rights reserved. This software is proprietary and may not be copied, modified, distributed, or used without explicit permission.

### Permitted Use
- Personal evaluation and testing
- Integration with authorized projects

### Prohibited Without Permission
- ❌ Commercial use
- ❌ Distribution
- ❌ Modification
- ❌ Reverse engineering

For licensing inquiries: **pensonluis57@gmail.com**

## 🎯 Roadmap

- [x] Backend API implementation
- [x] ML assignment algorithm
- [x] Mock data and documentation
- [x] Copyright protection
- [ ] React frontend
- [ ] Vanta.js space background
- [ ] anime.js transitions
- [ ] Chart.js analytics
- [ ] Database integration (PostgreSQL)
- [ ] Authentication (JWT/OAuth2)
- [ ] Deployment (Render + Vercel)

## 📖 Documentation

- **[Backend README](./backend/README.md)** - Technical documentation
- **[Quick Start Guide](./QUICK_START.md)** - Quick reference
- **[Implementation Summary](./BACKEND_COMPLETE.md)** - Complete details
- **[Firebase Data Model](./docs/FirebaseDataModel.md)** - Firestore schema & roles
- **[License Details](./LICENSE.md)** - Full terms and conditions

## 🤝 Contributing

This is a proprietary project. Contributions are not accepted without explicit permission.

For inquiries about development, licensing, or partnerships:
📧 **Email**: pensonluis57@gmail.com

## 📊 Project Status

| Component | Status |
|-----------|--------|
| Backend API | ✅ Complete |
| ML Algorithm | ✅ Working |
| Documentation | ✅ Comprehensive |
| Tests | ✅ All Passing |
| Copyright | ✅ Protected |
| Frontend | 🔄 Coming Soon |
| Database | 🔄 Planned |
| Deployment | 🔄 In Progress |

## 🎓 Technologies & Skills Demonstrated

✅ FastAPI framework & REST API design
✅ Machine learning & algorithm design
✅ Python development best practices
✅ CORS & middleware configuration
✅ Pydantic data validation
✅ JSON file handling
✅ Git & version control
✅ Professional documentation
✅ Copyright & licensing

## 📞 Contact

- **Email**: pensonluis57@gmail.com
- **GitHub**: [Gr3Ekk](https://github.com/Gr3Ekk)
- **Project**: [BountyAI](https://github.com/Gr3Ekk/BountyAI)

---

**Made with ❤️ for the Space Cowboy hackathon**

*Last Updated: October 23, 2025*

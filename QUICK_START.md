````markdown
# 🚀 BountyAI Quick Start Guide

**Copyright © 2025 Luis Penson. All rights reserved.**
*For licensing inquiries, contact: pensonluis57@gmail.com*

## Server Status
✅ **BACKEND IS RUNNING** on `http://localhost:8000`

## 📖 Quick Links

### API Documentation (Interactive)
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Main Endpoints
- `GET http://localhost:8000/` - API Info
- `GET http://localhost:8000/get_teams` - List all teams
- `GET http://localhost:8000/get_projects` - List all bounties
- `POST http://localhost:8000/assign_bounty` - Assign a bounty
- `GET http://localhost:8000/get_dashboard` - View metrics

---

## 🧪 Quick Test Commands

### 1. Health Check
```bash
curl http://localhost:8000/health
```

### 2. Get All Teams
```bash
curl http://localhost:8000/get_teams | python3 -m json.tool
```

### 3. Get All Projects
```bash
curl http://localhost:8000/get_projects | python3 -m json.tool
```

### 4. Assign a Bounty (Frontend-focused)
```bash
curl -X POST http://localhost:8000/assign_bounty \
  -H "Content-Type: application/json" \
  -d '{"bounty_id": "bounty_001"}'
```

### 5. Get Dashboard Metrics
```bash
curl http://localhost:8000/get_dashboard | python3 -m json.tool
```

---

## 📁 Backend File Structure

```
backend/
├── main.py              # FastAPI app (6 endpoints, CORS enabled)
├── ml_model.py          # AI team assignment algorithm
├── requirements.txt     # Python dependencies
├── README.md            # Full documentation
├── start.sh             # Startup script
├── .gitignore           # Git ignore rules
├── data/
│   ├── teams.json       # 5 mock teams
│   └── projects.json    # 6 mock bounties
└── venv/                # Python virtual environment
```

---

## 🤖 Teams Available (5 Teams)

| Team | ID | Specialty | Productivity | Workload |
|------|-------|-----------|-------------|----------|
| 🎨 Alpha Pilots | team_alpha | Frontend/React | 85% | 2/5 |
| ⚙️ Beta Crew | team_beta | Backend/Python | 92% | 1/5 |
| 🛠️ Gamma Squadron | team_gamma | DevOps | 78% | 3/5 |
| 🌐 Delta Force | team_delta | Full-stack | 88% | 1/5 |
| 🤖 Echo Knights | team_echo | ML/Data Science | 81% | 2/5 |

---

## 🎯 Bounties Available (6 Projects)

| ID | Name | Difficulty | Type | Reward |
|----|------|-----------|------|--------|
| bounty_001 | Dashboard UI Redesign | Medium | Frontend | $5,000 |
| bounty_002 | Asteroid Detection API | Hard | Backend | $8,000 |
| bounty_003 | Deployment Pipeline | Hard | DevOps | $7,000 |
| bounty_004 | Auth Module | Medium | Backend | $4,500 |
| bounty_005 | Predictive Analytics | Hard | ML | $10,000 |
| bounty_006 | Real-time Visualization | Medium | Frontend | $6,000 |

---

## 🔄 Assignment Algorithm

**How team assignment works:**

1. **Skill Match** (50%): How many required skills the team has
2. **Productivity** (30%): Historical team performance rate
3. **Workload** (20%): Available capacity to take on new work

All scores are calculated, ranked, and the top team is recommended.

---

## 💡 Example: Assign Bounty

**Request**: Assign "bounty_005" (Predictive Analytics - requires ML skills)

```bash
curl -X POST http://localhost:8000/assign_bounty \
  -H "Content-Type: application/json" \
  -d '{"bounty_id": "bounty_005"}'
```

**Response Preview**:
```json
{
  "assigned_team": {
    "name": "Echo Knights",
    "skills": ["ai/ml", "data-science", "python", "backend"],
    "productivity_rate": 0.81
  },
  "fit_score": 86.3,
  "reasoning": "Echo Knights selected based on: 3/3 required skills matched..."
}
```

---

## 🔧 Backend Startup

### Option 1: Using Start Script
```bash
cd /Users/luispenson/Desktop/BountyAi/backend
chmod +x start.sh
./start.sh
```

### Option 2: Manual Start
```bash
cd /Users/luispenson/Desktop/BountyAi/backend
source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Option 3: Already Running ✅
Server is already running in the background on `http://localhost:8000`

---

## � Firebase Setup Snapshot

1. Duplicate the example environment files and add Firebase credentials:

```bash
cd backend && cp .env.example .env
cd ../frontend && cp .env.example .env
```

2. Backend `.env` requires either `GOOGLE_APPLICATION_CREDENTIALS` pointing to your service account JSON file or `FIREBASE_SERVICE_ACCOUNT_BASE64` with the encoded JSON. The service account needs Firestore + Auth admin scopes. Set `FIREBASE_DEFAULT_TENANT_ID` to the tenant document you want to target (defaults to `default`).

3. Frontend `.env` expects the Firebase web app config (`apiKey`, `authDomain`, `projectId`, etc.).

4. (Optional) For emulators:

```bash
firebase login
firebase emulators:start --only firestore,auth
```

With emulators running set `FIRESTORE_EMULATOR_HOST=localhost:8080` in `backend/.env` and `VITE_FIREBASE_USE_EMULATOR=true` in `frontend/.env`.

5. Load the starter data into Firestore:

```bash
cd backend
python seed_firestore.py --tenant default --reset
```

Skip `--reset` if you want to preserve existing documents.

---

## �📊 Dashboard Metrics

The `/get_dashboard` endpoint provides:
- Total teams and bounties count
- Average team productivity
- Capacity utilization
- Team workload breakdown
- Bounty difficulty distribution
- Top performer rankings
- Timestamp of data

---

## 🛡️ CORS Configuration

✅ **Currently enabled** for frontend communication
- Allows requests from any origin
- Ready for React frontend integration
- Production-ready security config in README.md

---

## 📝 Python Version Requirement

✅ Python 3.11+ (Currently using 3.13)

Installed packages:
- FastAPI 0.120.0
- Uvicorn 0.38.0
- Pydantic 2.12.3
- python-multipart 0.0.6

---

## 🚨 Troubleshooting

### Server not starting?
```bash
# Kill any existing process on port 8000
lsof -i :8000
kill -9 <PID>

# Or use a different port
python -m uvicorn main:app --port 8001
```

### Can't import modules?
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### Want to stop the server?
```bash
# Find and kill the process
ps aux | grep uvicorn
kill <PID>

# Or press Ctrl+C if running in foreground
```

---

## 📚 Documentation

- **Full Docs**: `/backend/README.md`
- **Implementation Summary**: `/BACKEND_COMPLETE.md`
- **API Interactive Docs**: http://localhost:8000/docs

---

## 🎉 You're All Set!

The BountyAI backend is **fully operational** and ready for:
- ✅ Testing API endpoints
- ✅ Frontend integration
- ✅ Building the React application
- ✅ Adding Vanta.js space backgrounds
- ✅ Implementing anime.js transitions
- ✅ Integrating Chart.js analytics

**Next Steps**: Build the React frontend!

---

## 📞 Quick Reference Commands

```bash
# Check server status
curl http://localhost:8000/health

# View all teams in terminal
curl http://localhost:8000/get_teams | python3 -m json.tool

# View all bounties
curl http://localhost:8000/get_projects | python3 -m json.tool

# Assign a bounty and see AI selection
curl -X POST http://localhost:8000/assign_bounty \
  -H "Content-Type: application/json" \
  -d '{"bounty_id": "bounty_001"}' | python3 -m json.tool

# Get dashboard analytics
curl http://localhost:8000/get_dashboard | python3 -m json.tool

# Open API documentation
open http://localhost:8000/docs
```

---

**Status**: ✅ **READY FOR PRODUCTION** (or frontend development)

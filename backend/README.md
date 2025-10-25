# BountyAI Backend

FastAPI-based backend for the Space Cowboy automation system. This service handles bounty assignment, team management, and productivity analytics.

**Copyright © 2025 Luis Penson. All rights reserved.**
*This software may not be copied, modified, distributed, or used without explicit permission.*

## 🚀 Getting Started

### Prerequisites
- Python 3.11 or higher
- pip (Python package manager)

### Installation

1. **Create a virtual environment**:
```bash
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate     # On Windows
```

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

3. **Configure Firebase credentials**

  Copy the example environment file and provide your Firebase details:

  ```bash
  cp .env.example .env
  ```

  | Variable | Purpose |
  | --- | --- |
  | `FIREBASE_PROJECT_ID` | Firebase project identifier |
  | `FIREBASE_DEFAULT_TENANT_ID` | Tenant document ID under `tenants/{tenantId}` (defaults to `default`) |
  | `GOOGLE_APPLICATION_CREDENTIALS` | Path to the service account JSON file (relative or absolute) |
  | `FIREBASE_SERVICE_ACCOUNT_BASE64` | Optional base64 encoded service account JSON (overrides the file path) |
  | `FIRESTORE_EMULATOR_HOST` | Point to emulator host (e.g. `localhost:8080`) during local development |

  The service account must have permissions for **Firestore Admin** and **Firebase Authentication Admin**. Download it from the Firebase console: **Project Settings → Service Accounts → Generate new private key**.

  > 🚫 **Never commit the service account file.** `.gitignore` already excludes common filenames.

### Running the Server

Start the FastAPI server:
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Or with auto-reload (development):
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The server will start at `http://localhost:8000`

### API Documentation

Interactive API documentation (Swagger UI):
```
http://localhost:8000/docs
```

Alternative API documentation (ReDoc):
```
http://localhost:8000/redoc
```

## 📁 Project Structure

```
backend/
├── main.py              # FastAPI app with all endpoints
├── ml_model.py          # ML scoring algorithm for team assignment
├── firebase_client.py   # Firebase Admin initialization helpers
├── requirements.txt     # Python dependencies
├── data/
│   ├── teams.json       # Mock team data
│   └── projects.json    # Mock bounty/project data
├── .gitignore           # Git ignore rules
└── venv/                # Virtual environment (generated)
```

## 🔌 API Endpoints

### 1. **GET /health**
Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-23T12:00:00.000000"
}
```

---

### 2. **GET /get_teams**
Retrieve all teams with their skills, productivity rates, and workload.

**Response**:
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "team_alpha",
      "name": "Alpha Pilots",
      "skills": ["frontend", "ui/ux", "react"],
      "productivity_rate": 0.85,
      "current_workload": 2,
      "max_capacity": 5,
      "description": "Expert front-end developers..."
    },
    ...
  ]
}
```

---

### 3. **GET /get_projects**
Retrieve all available bounties/projects.

**Response**:
```json
{
  "success": true,
  "count": 6,
  "data": [
    {
      "id": "bounty_001",
      "name": "Space Dashboard UI Redesign",
      "description": "Redesign the mission control dashboard...",
      "difficulty": "medium",
      "required_skills": ["frontend", "react", "ui/ux"],
      "estimated_hours": 40,
      "reward": 5000,
      "deadline": "2025-11-15"
    },
    ...
  ]
}
```

---

### 4. **POST /assign_bounty**
Assign a bounty to the best-fit team using the ML scoring algorithm.

**Request**:
```json
{
  "bounty_id": "bounty_001"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "assigned_team": {
      "id": "team_alpha",
      "name": "Alpha Pilots",
      "skills": ["frontend", "ui/ux", "react"],
      "productivity_rate": 0.85,
      "current_workload": 2,
      "max_capacity": 5,
      "description": "Expert front-end developers..."
    },
    "fit_score": 87.5,
    "reasoning": "Alpha Pilots selected based on: 3/3 required skills matched (frontend, ui/ux, react), 85% productivity rate, and 3 available slots.",
    "all_scores": [
      {
        "team_id": "team_alpha",
        "team_name": "Alpha Pilots",
        "score": 87.5,
        "skill_match": 100.0,
        "productivity": 85.0,
        "workload_score": 60.0
      },
      ...
    ]
  }
}
```

---

### 5. **GET /get_dashboard**
Get productivity dashboard metrics and team statistics.

**Response**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_teams": 5,
      "total_bounties": 6,
      "avg_team_productivity": 84.8,
      "total_capacity_used": 9,
      "total_capacity": 25,
      "overall_utilization": 36.0
    },
    "team_workload": [
      {
        "team_id": "team_alpha",
        "team_name": "Alpha Pilots",
        "workload": 2,
        "capacity": 5,
        "utilization": 40.0,
        "productivity_rate": 0.85
      },
      ...
    ],
    "bounty_difficulty": {
      "medium": 3,
      "hard": 3
    },
    "top_performers": [
      {
        "name": "Beta Crew",
        "productivity": 0.92
      },
      ...
    ],
    "timestamp": "2025-10-23T12:00:00.000000"
  }
}
```

---

## 🤖 AI Assignment Algorithm

The ML model scores teams based on three weighted factors:

1. **Skill Match (50%)** - How many required skills the team possesses
2. **Productivity Rate (30%)** - Historical productivity percentage
3. **Workload Capacity (20%)** - Available capacity / max capacity

### Example Calculation:
```
Team Score = (Skill Match × 0.50) + (Productivity × 0.30) + (Workload Score × 0.20)
            = (1.0 × 0.50) + (0.85 × 0.30) + (0.6 × 0.20)
            = 0.5 + 0.255 + 0.12
            = 0.875 → 87.5/100
```

The team with the highest score is automatically assigned the bounty.

---

## 📊 Mock Data

### Teams (teams.json)
- **Alpha Pilots**: Frontend specialists (React, UI/UX)
- **Beta Crew**: Backend specialists (Python, API, Database)
- **Gamma Squadron**: DevOps and Infrastructure
- **Delta Force**: Full-stack developers
- **Echo Knights**: ML/Data Science specialists

### Bounties (projects.json)
- Dashboard UI redesign (medium, frontend)
- Asteroid Detection API (hard, backend)
- Deployment Pipeline (hard, devops)
- User Authentication (medium, backend)
- Predictive Analytics (hard, ML)
- Real-time Data Visualization (medium, frontend)

---

## 🔧 Configuration

### CORS Settings
Currently allows all origins. For production, update in `main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # Specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Firebase Admin Helper
- `firebase_client.py` centralizes initialization of the Firebase Admin SDK.
- Call `get_firestore_client()` anywhere in the backend once your environment variables are configured.
- Supports local emulators via `FIRESTORE_EMULATOR_HOST`.

### Seeding Firestore with sample data

Load the bundled JSON fixtures into Firestore with the helper script:

```bash
python seed_firestore.py --tenant default --reset
```

- `--tenant` corresponds to the document under `tenants/{tenant}` (defaults to `FIREBASE_DEFAULT_TENANT_ID`).
- `--reset` removes existing docs in each collection before seeding.
- Override `--data-dir` if you keep fixtures elsewhere.
> **Note:** Firebase requires the Cloud Firestore API to be enabled in your project before this script can write data. Visit the [Firestore API dashboard](https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=bountyai-4770b) and enable it for your project first.

- Run this script again whenever you tweak the fixtures (for example, after updating demo profiles like `developer@bountyai.dev`) so Firestore stays in sync.

---

## 📦 Dependencies

- **FastAPI** (0.120.0) - Modern Python web framework
- **Uvicorn** (0.38.0) - ASGI server
- **Pydantic** (2.12.3) - Data validation
- **python-multipart** (0.0.6) - Form data parsing

---

## 🚀 Deployment

### Local Testing
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Production (using Gunicorn + Uvicorn)
```bash
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```

### Docker (Optional)
Create a `Dockerfile` for containerization:
```dockerfile
FROM python:3.11
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0"]
```

---

## 🧪 Testing the API

### Test with curl:
```bash
# Get teams
curl http://localhost:8000/get_teams

# Get projects
curl http://localhost:8000/get_projects

# Assign a bounty
curl -X POST http://localhost:8000/assign_bounty \
  -H "Content-Type: application/json" \
  -d '{"bounty_id": "bounty_001"}'

# Get dashboard
curl http://localhost:8000/get_dashboard
```

### Test with Python:
```python
import requests

# Get teams
response = requests.get('http://localhost:8000/get_teams')
print(response.json())

# Assign bounty
response = requests.post('http://localhost:8000/assign_bounty', 
                        json={'bounty_id': 'bounty_001'})
print(response.json())
```

---

## 📝 Next Steps

1. **Build the React Frontend** - Create components for Bounty Board, Teams Dashboard, and Analytics
2. **Add Database Integration** - Replace mock JSON data with a real database (PostgreSQL)
3. **Implement Authentication** - Add JWT-based user authentication
4. **Add Real ML Model** - Integrate more sophisticated team assignment logic
5. **Create Admin Panel** - Allow managers to create new bounties and manage teams

---

## 📄 License

**Copyright © 2025 Luis Penson. All rights reserved.**

This software and associated files may not be copied, modified, distributed, or used for any purpose without explicit permission from the copyright owner.

For permission requests, please contact: **pensonluis57@gmail.com**

Part of the BountyAI hackathon project (Space Cowboy Automation Theme)

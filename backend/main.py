"""
BountyAI FastAPI Backend

Core API for the Space Cowboy automation system.
Handles bounty assignment, team management, and analytics.

Copyright (c) 2025 Luis Penson. All rights reserved.
This software may not be copied, modified, distributed, or used without explicit permission.
"""

import asyncio
import json
import logging
import os
import random
import string
from datetime import datetime
from typing import Dict, List, Optional, Set

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import firestore as admin_firestore
from google.cloud import exceptions
from pydantic import BaseModel

# Import the ML model for bounty assignment
from ml_model import assign_bounty as ml_assign_bounty
from firebase_client import (
    FirebaseInitializationError,
    get_firestore_client,
)

# ============================================================================
# FastAPI App Initialization
# ============================================================================

app = FastAPI(
    title="BountyAI Backend",
    description="AI-powered bounty assignment system for teams",
    version="0.1.0"
)

# ============================================================================
# CORS Middleware Configuration
# ============================================================================
# Allow frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Data Models (Pydantic)
# ============================================================================

class AssignmentRequest(BaseModel):
    """Request body for bounty assignment"""
    bounty_id: str


class AssignmentResponse(BaseModel):
    """Response for bounty assignment"""
    assigned_team: Dict
    fit_score: float
    reasoning: str
    all_scores: List[Dict]


class TeamCreateRequest(BaseModel):
    tenantId: str
    name: str
    description: Optional[str] = None
    skills: List[str]
    leadUid: str
    maxCapacity: Optional[int] = None


class TeamCreateResponse(BaseModel):
    success: bool
    teamId: str
    joinCode: str


# ============================================================================
# Helper Functions
# ============================================================================

def load_json_file(file_path: str) -> List[Dict]:
    """Load JSON data from a file."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Data file not found: {file_path}")
    with open(file_path, 'r') as f:
        return json.load(f)


def save_json_file(file_path: str, data: List[Dict]) -> None:
    """Save JSON data to a file."""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)


# Firestore helpers ----------------------------------------------------------

logger = logging.getLogger(__name__)

DEFAULT_TENANT_ID = os.getenv("FIREBASE_DEFAULT_TENANT_ID", "default")


def _ensure_document_id(data: Dict, document_id: str) -> Dict:
    if "id" not in data:
        data = {**data, "id": document_id}
    return data


async def _fetch_tenant_collection(collection_name: str) -> List[Dict]:
    """Retrieve a collection under the tenant document from Firestore."""

    def _fetch() -> List[Dict]:
        db = get_firestore_client()
        collection_ref = (
            db.collection("tenants")
            .document(DEFAULT_TENANT_ID)
            .collection(collection_name)
        )
        documents = collection_ref.stream()
        return [
            _ensure_document_id(doc.to_dict() or {}, doc.id)
            for doc in documents
        ]

    return await asyncio.to_thread(_fetch)


async def load_dataset(collection_name: str, json_path: str) -> List[Dict]:
    """Attempt to load dataset from Firestore, falling back to local JSON."""
    try:
        records = await _fetch_tenant_collection(collection_name)
        if records:
            return records
        logger.info(
            "Firestore collection '%s' is empty for tenant '%s', falling back to JSON", 
            collection_name,
            DEFAULT_TENANT_ID,
        )
    except FirebaseInitializationError as exc:
        logger.warning("Firebase not initialized: %s", exc)
    except exceptions.GoogleCloudError as exc:
        logger.error("Firestore error retrieving %s: %s", collection_name, exc)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Unexpected error retrieving %s: %s", collection_name, exc)

    return load_json_file(json_path)


async def load_teams() -> List[Dict]:
    return await load_dataset("teams", "data/teams.json")


async def load_projects() -> List[Dict]:
    return await load_dataset("projects", "data/projects.json")


async def _fetch_existing_join_codes(tenant_id: str) -> Set[str]:
    def _fetch() -> Set[str]:
        db = get_firestore_client()
        teams_ref = (
            db.collection("tenants")
            .document(tenant_id)
            .collection("teams")
        )
        codes: Set[str] = set()
        for doc in teams_ref.stream():
            payload = doc.to_dict() or {}
            code = payload.get("joinCode")
            if isinstance(code, str):
                codes.add(code.upper())
        return codes

    return await asyncio.to_thread(_fetch)


def _generate_candidate_prefix(team_name: str) -> str:
    letters = "".join(ch for ch in team_name.upper() if ch.isalpha())
    if not letters:
        letters = "SQUAD"
    if len(letters) < 5:
        letters = (letters + "ABCDE")[:5]
    return letters[:5]


async def generate_unique_join_code(tenant_id: str, team_name: str) -> str:
    existing_codes = await _fetch_existing_join_codes(tenant_id)
    prefix = _generate_candidate_prefix(team_name)

    for _ in range(50):
        numeric = random.randint(100, 999)
        suffix = random.choice(string.ascii_uppercase)
        candidate = f"{prefix}-{numeric}{suffix}"
        if candidate not in existing_codes:
            return candidate

    raise RuntimeError("Unable to generate a unique join code. Try again.")


async def persist_assignment_result(bounty_id: str, assignment: Dict) -> None:
    """Persist assignment outcome back into Firestore when available."""

    def _persist() -> None:
        db = get_firestore_client()
        tenant_ref = db.collection("tenants").document(DEFAULT_TENANT_ID)

        team_id = assignment.get("assigned_team", {}).get("id")
        if not team_id:
            logger.info("Assignment missing team id; skipping Firestore persistence")
            return

        now = admin_firestore.SERVER_TIMESTAMP

        # Update project document
        project_ref = tenant_ref.collection("projects").document(bounty_id)
        project_ref.set(
            {
                "status": "assigned",
                "assignedTeamId": team_id,
                "updatedAt": now,
            },
            merge=True,
        )

        assignment_payload = {
            "teamId": team_id,
            "fitScore": assignment.get("fit_score"),
            "reasoning": assignment.get("reasoning"),
            "createdAt": now,
            "allScores": assignment.get("all_scores", []),
        }
        project_ref.collection("assignments").add(assignment_payload)

        # Increment team workload
        team_ref = tenant_ref.collection("teams").document(team_id)
        team_ref.set(
            {
                "current_workload": admin_firestore.Increment(1),
                "updatedAt": now,
            },
            merge=True,
        )

    try:
        await asyncio.to_thread(_persist)
    except FirebaseInitializationError:
        logger.debug("Firebase not configured; skipping assignment persistence")
    except exceptions.GoogleCloudError as exc:
        logger.warning("Firestore error while persisting assignment: %s", exc)
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("Unexpected error persisting assignment: %s", exc)


# ============================================================================
# API Routes
# ============================================================================

@app.get("/")
async def root():
    """
    Root endpoint - returns API info
    """
    return {
        "app": "BountyAI Backend",
        "version": "0.1.0",
        "description": "AI-powered bounty assignment system",
        "endpoints": {
            "GET /get_teams": "Returns list of all teams",
            "GET /get_projects": "Returns list of all available bounties",
            "POST /assign_bounty": "Assigns a bounty to the best-fit team",
            "GET /get_dashboard": "Returns productivity dashboard metrics",
            "POST /teams": "Creates a new squad and generates a join code",
            "GET /health": "Health check endpoint"
        }
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/get_teams")
async def get_teams():
    """
    Retrieve all teams from teams.json
    
    Returns:
        List of team objects with their skills, productivity, and workload info
    """
    try:
        teams = await load_teams()
        return {
            "success": True,
            "count": len(teams),
            "data": teams
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading teams: {str(e)}")


@app.get("/get_projects")
async def get_projects():
    """
    Retrieve all projects/bounties from projects.json
    
    Returns:
        List of bounty objects with descriptions, difficulty, and required skills
    """
    try:
        projects = await load_projects()
        return {
            "success": True,
            "count": len(projects),
            "data": projects
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading projects: {str(e)}")


@app.post("/assign_bounty")
async def assign_bounty(request: AssignmentRequest):
    """
    Assign a bounty to the best-fit team using ML scoring algorithm
    
    Algorithm:
    - Scores each team based on: skill match (50%), productivity (30%), workload (20%)
    - Returns the highest-scoring team with detailed reasoning
    
    Args:
        request: AssignmentRequest with bounty_id
    
    Returns:
        Assignment result with team, fit score, and reasoning
    """
    try:
        teams, projects = await asyncio.gather(load_teams(), load_projects())
        result = ml_assign_bounty(
            request.bounty_id,
            teams_data_path="data/teams.json",
            projects_data_path="data/projects.json",
            teams_data=teams,
            projects_data=projects,
        )
        
        # Check for errors from ML model
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        await persist_assignment_result(request.bounty_id, result)

        return {
            "success": True,
            "data": result
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error during bounty assignment: {str(e)}"
        )


@app.get("/get_dashboard")
async def get_dashboard():
    """
    Get productivity dashboard metrics
    
    Provides:
    - Team productivity statistics
    - Assignment history summary
    - Workload distribution
    - Performance trends (mocked for MVP)
    
    Returns:
        Dashboard data with metrics and visualizations
    """
    try:
        teams, projects = await asyncio.gather(load_teams(), load_projects())
        
        # Calculate metrics
        total_teams = len(teams)
        total_projects = len(projects)
        avg_productivity = (
            sum(float(t.get("productivity_rate", 0)) for t in teams) / total_teams
            if teams
            else 0
        )
        total_capacity_used = sum(int(t.get("current_workload", 0)) for t in teams)
        total_capacity = sum(int(t.get("max_capacity", 0)) for t in teams)
        
        # Team workload breakdown
        team_workload = [
            {
                "team_id": t.get("id"),
                "team_name": t.get("name", "Unnamed Team"),
                "workload": int(t.get("current_workload", 0)),
                "capacity": int(t.get("max_capacity", 0)),
                "utilization": (
                    (int(t.get("current_workload", 0)) / int(t.get("max_capacity", 0))) * 100
                    if int(t.get("max_capacity", 0)) > 0
                    else 0
                ),
                "productivity_rate": float(t.get("productivity_rate", 0)),
            }
            for t in teams
        ]
        
        # Difficulty breakdown of projects
        difficulty_counts = {}
        for project in projects:
            diff = project.get("difficulty", "unknown")
            difficulty_counts[diff] = difficulty_counts.get(diff, 0) + 1
        
        return {
            "success": True,
            "data": {
                "summary": {
                    "total_teams": total_teams,
                    "total_bounties": total_projects,
                    "avg_team_productivity": round(avg_productivity * 100, 2),
                    "total_capacity_used": total_capacity_used,
                    "total_capacity": total_capacity,
                    "overall_utilization": round((total_capacity_used / total_capacity) * 100, 2) if total_capacity > 0 else 0
                },
                "team_workload": team_workload,
                "bounty_difficulty": difficulty_counts,
                "top_performers": sorted(
                    [
                        {
                            "name": t.get("name", "Unnamed Team"),
                            "productivity": float(t.get("productivity_rate", 0)),
                        }
                        for t in teams
                    ],
                    key=lambda x: x["productivity"],
                    reverse=True
                )[:3],
                "timestamp": datetime.now().isoformat()
            }
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating dashboard: {str(e)}"
        )


@app.post("/teams", response_model=TeamCreateResponse)
async def create_team(request: TeamCreateRequest):
    tenant_id = request.tenantId.strip() or DEFAULT_TENANT_ID
    name = request.name.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Team name is required.")

    try:
        join_code = await generate_unique_join_code(tenant_id, name)
    except FirebaseInitializationError as exc:
        raise HTTPException(status_code=503, detail="Firebase not configured.") from exc
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    def _create() -> str:
        db = get_firestore_client()
        tenant_ref = db.collection("tenants").document(tenant_id)
        teams_ref = tenant_ref.collection("teams")
        doc_ref = teams_ref.document()

        now = admin_firestore.SERVER_TIMESTAMP
        payload = {
            "name": name,
            "description": request.description,
            "skills": request.skills,
            "joinCode": join_code,
            "leadUid": request.leadUid,
            "active": True,
            "createdAt": now,
            "updatedAt": now,
            "currentWorkload": 0,
            "maxCapacity": request.maxCapacity or 5,
            "productivityScore": 0.75,
        }

        doc_ref.set(payload)
        return doc_ref.id

    try:
        team_id = await asyncio.to_thread(_create)
    except FirebaseInitializationError as exc:
        raise HTTPException(status_code=503, detail="Firebase not configured.") from exc
    except exceptions.GoogleCloudError as exc:
        raise HTTPException(status_code=500, detail=f"Firestore error: {exc}") from exc

    return TeamCreateResponse(success=True, teamId=team_id, joinCode=join_code)


# ============================================================================
# Server Start Configuration
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    print("""
    ╔════════════════════════════════════════════╗
    ║          🚀 BountyAI Backend 🚀            ║
    ║     AI-Powered Bounty Assignment System     ║
    ╚════════════════════════════════════════════╝
    
    Starting server on http://localhost:8000
    API documentation available at http://localhost:8000/docs
    """)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=True
    )

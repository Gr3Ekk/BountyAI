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

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import firestore as admin_firestore
from google.cloud import exceptions
from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv()

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


class DirectAssignmentRequest(BaseModel):
    """Request body for directly assigning a project to a team"""
    projectId: str
    teamId: str
    reasoning: Optional[str] = None


class TaskDetail(BaseModel):
    """Individual task within a project"""
    id: str
    title: str
    description: str
    assignedTo: Optional[str] = None  # developer ID
    assignedToName: Optional[str] = None  # developer name
    estimatedHours: float
    skills: List[str]
    status: str = "pending"
    type: str = "team-assignment"  # NEW: "team-assignment" or "bounty"
    priority: Optional[str] = "medium"  # NEW: "low", "medium", "high", "urgent"


class DirectAssignmentResponse(BaseModel):
    """Response for direct assignment with timeline"""
    success: bool
    assignmentId: str
    projectId: str
    teamId: str
    teamName: str
    tasks: List[TaskDetail]
    message: str


class BountyCreateRequest(BaseModel):
    """Request body for creating a new bounty"""
    title: str
    description: str
    estimatedHours: float
    skills: List[str]
    priority: Optional[str] = "medium"
    linkedProjectId: Optional[str] = None
    reward: Optional[float] = None
    deadline: Optional[str] = None


class BountyResponse(BaseModel):
    """Response for bounty operations"""
    id: str
    title: str
    description: str
    estimatedHours: float
    skills: List[str]
    status: str
    priority: str
    createdBy: Optional[str] = "system"
    createdAt: int
    claimedBy: Optional[str] = None
    claimedByName: Optional[str] = None
    claimedAt: Optional[int] = None
    linkedProjectId: Optional[str] = None
    reward: Optional[float] = None
    deadline: Optional[str] = None


class BountyListResponse(BaseModel):
    """Response for listing bounties"""
    bounties: List[BountyResponse]
    total: int


class BountyClaimRequest(BaseModel):
    """Request body for claiming a bounty"""
    developerId: str
    developerName: str


class FinalizeTaskDetail(BaseModel):
    """Task detail for finalization"""
    id: str
    title: str
    description: str
    estimatedHours: float
    skills: List[str]
    type: str  # "team-assignment" or "bounty"
    priority: Optional[str] = "medium"
    assignedToId: Optional[str] = None
    assignedToName: Optional[str] = None
    status: Optional[str] = None


class FinalizeAssignmentRequest(BaseModel):
    """Request body for finalizing an assignment"""
    assignmentId: str
    projectId: str
    teamId: str
    teamTasks: List[FinalizeTaskDetail]
    bountyTasks: List[FinalizeTaskDetail]


class FinalizeAssignmentResponse(BaseModel):
    """Response for finalization"""
    success: bool
    assignmentId: str
    teamTasksCount: int
    bountiesCreated: int
    message: str


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
    current_id = data.get("id")
    if current_id == document_id:
        return data

    if current_id and current_id != document_id:
        logger.debug(
            "Firestore document id mismatch detected; overriding stale id (doc=%s, stale=%s)",
            document_id,
            current_id,
        )

    return {**data, "id": document_id}


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


async def load_developers() -> List[Dict]:
    return await load_dataset("developers", "data/developers.json")


def generate_initial_tasks(project: Dict, team: Dict, developers: List[Dict]) -> List[Dict]:
    """Generate initial task breakdown based on project requirements and team composition
    
    Automatically classifies tasks as either 'team-assignment' or 'bounty' based on:
    - Estimated hours (< 4 = bounty candidate)
    - Required skills (1-2 skills = bounty, multiple = team)
    - Task complexity (self-contained = bounty)
    """
    team_members = [dev for dev in developers if dev.get("primaryTeamId") == team.get("id")]
    
    if not team_members:
        # Fallback: create generic tasks
        return []
    
    estimated_hours = project.get("estimatedHours") or project.get("estimated_hours") or 40
    required_skills = project.get("required_skills") or project.get("skillsRequired") or []
    
    tasks = []
    task_templates = {
        "frontend": [
            {"title": "UI Component Development", "pct": 0.35, "desc": "Build and style user interface components", "complexity": "high"},
            {"title": "Frontend Integration", "pct": 0.25, "desc": "Integrate frontend with backend APIs", "complexity": "high"},
            {"title": "Testing & Polish", "pct": 0.15, "desc": "Test UI across devices and polish interactions", "complexity": "medium"},
            {"title": "Fix UI Bugs", "pct": 0.05, "desc": "Fix reported UI bugs and styling issues", "complexity": "low"},
        ],
        "backend": [
            {"title": "API Development", "pct": 0.30, "desc": "Design and implement RESTful API endpoints", "complexity": "high"},
            {"title": "Database Schema", "pct": 0.20, "desc": "Design and implement database models", "complexity": "high"},
            {"title": "Business Logic", "pct": 0.25, "desc": "Implement core business logic and validation", "complexity": "high"},
            {"title": "Write Unit Tests", "pct": 0.08, "desc": "Add unit tests for API endpoints", "complexity": "low"},
        ],
        "fullstack": [
            {"title": "Full-Stack Integration", "pct": 0.35, "desc": "End-to-end feature implementation", "complexity": "high"},
            {"title": "API & Database", "pct": 0.30, "desc": "Backend services and data layer", "complexity": "high"},
        ],
        "devops": [
            {"title": "Infrastructure Setup", "pct": 0.30, "desc": "Configure deployment infrastructure", "complexity": "high"},
            {"title": "CI/CD Pipeline", "pct": 0.25, "desc": "Set up continuous integration and deployment", "complexity": "high"},
            {"title": "Update Config", "pct": 0.05, "desc": "Update deployment configuration files", "complexity": "low"},
        ],
        "ai/ml": [
            {"title": "Model Development", "pct": 0.35, "desc": "Design and train machine learning model", "complexity": "high"},
            {"title": "Data Pipeline", "pct": 0.25, "desc": "Build data processing and feature engineering pipeline", "complexity": "high"},
        ],
        "database": [
            {"title": "Schema Design", "pct": 0.25, "desc": "Design optimized database schema", "complexity": "high"},
            {"title": "Query Optimization", "pct": 0.20, "desc": "Optimize queries and indexes", "complexity": "medium"},
        ],
    }
    
    # Determine which templates to use based on required skills
    selected_templates = []
    for skill in required_skills:
        if skill in task_templates:
            selected_templates.extend(task_templates[skill])
    
    # Fallback to generic tasks if no matches
    if not selected_templates:
        selected_templates = [
            {"title": "Planning & Design", "pct": 0.20, "desc": "Project planning and technical design", "complexity": "medium"},
            {"title": "Core Development", "pct": 0.45, "desc": "Implement core functionality", "complexity": "high"},
            {"title": "Testing & QA", "pct": 0.20, "desc": "Test and quality assurance", "complexity": "medium"},
            {"title": "Documentation", "pct": 0.15, "desc": "Write technical documentation", "complexity": "low"},
        ]
    
    # Assign tasks to team members based on skill match
    for idx, template in enumerate(selected_templates[:7]):  # Max 7 tasks (allow for some bounties)
        task_hours = estimated_hours * template["pct"]
        task_skills = [s for s in required_skills if s in template["title"].lower() or s in template["desc"].lower()]
        if not task_skills and required_skills:
            task_skills = [required_skills[0]]
        
        # Determine task type based on complexity
        complexity = template.get("complexity", "medium")
        is_bounty = (
            task_hours < 4 and  # Less than 4 hours
            len(task_skills) <= 2 and  # Single or dual skill requirement
            complexity == "low"  # Low complexity
        )
        
        task_type = "bounty" if is_bounty else "team-assignment"
        priority = "low" if is_bounty else "medium"
        
        # Find best developer for this task
        best_dev = team_members[0]  # Default to first
        best_match = 0
        for dev in team_members:
            dev_skills = set(dev.get("skills", []))
            task_skill_set = set(task_skills)
            match_score = len(dev_skills & task_skill_set)
            if match_score > best_match:
                best_match = match_score
                best_dev = dev
        
        task_dict = {
            "id": f"task_{idx + 1}",
            "title": template["title"],
            "description": template["desc"],
            "estimatedHours": round(task_hours, 1),
            "skills": task_skills,
            "status": "pending" if task_type == "team-assignment" else "open",
            "type": task_type,
            "priority": priority,
        }
        
        # Only assign to developer if it's a team task
        if task_type == "team-assignment":
            task_dict["assignedTo"] = best_dev.get("id")  # For backward compatibility
            task_dict["assignedToId"] = best_dev.get("id")
            task_dict["assignedToName"] = best_dev.get("displayName", "Unknown")
        else:
            task_dict["assignedTo"] = None
            task_dict["assignedToId"] = None
            task_dict["assignedToName"] = None
        
        tasks.append(task_dict)
    
    return tasks


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


@app.post("/assign_project", response_model=DirectAssignmentResponse)
async def assign_project_to_team(request: DirectAssignmentRequest):
    """
    Directly assign a project to a specific team and generate initial task breakdown
    
    This endpoint is called after the manager confirms a team recommendation from the AI.
    It creates the assignment in Firestore and generates an initial task breakdown based
    on project requirements and team member skills.
    
    Args:
        request: DirectAssignmentRequest with projectId, teamId, and optional reasoning
    
    Returns:
        Assignment details with generated tasks assigned to specific developers
    """
    try:
        # Load data
        teams, projects, developers = await asyncio.gather(
            load_teams(),
            load_projects(),
            load_developers()
        )
        
        # Find the project and team
        project = next((p for p in projects if p.get("id") == request.projectId), None)
        team = next((t for t in teams if t.get("id") == request.teamId), None)
        
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {request.projectId} not found")
        if not team:
            raise HTTPException(status_code=404, detail=f"Team {request.teamId} not found")
        
        # Generate initial task breakdown
        tasks = generate_initial_tasks(project, team, developers)
        
        if not tasks:
            raise HTTPException(status_code=400, detail="Unable to generate tasks - team has no members")
        
        # Persist to Firestore
        def _persist() -> str:
            db = get_firestore_client()
            tenant_ref = db.collection("tenants").document(DEFAULT_TENANT_ID)
            
            # Update project
            project_ref = tenant_ref.collection("projects").document(request.projectId)
            now = admin_firestore.SERVER_TIMESTAMP
            project_ref.set({
                "status": "assigned",
                "assignedTeamId": request.teamId,
                "updatedAt": now,
            }, merge=True)
            
            # Separate tasks into team assignments and bounties
            team_tasks = [t for t in tasks if t.get("type") == "team-assignment"]
            bounty_tasks = [t for t in tasks if t.get("type") == "bounty"]
            
            # Create assignment with team tasks only
            assignments_ref = tenant_ref.collection("assignments")
            assignment_ref = assignments_ref.document()
            
            assignment_payload = {
                "projectId": request.projectId,
                "teamId": request.teamId,
                "tenantId": DEFAULT_TENANT_ID,
                "status": "in-progress",
                "reasoning": request.reasoning or "Manager selected based on AI recommendation",
                "progress": 0,
                "createdAt": now,
                "updatedAt": now,
                "tasks": team_tasks,  # Only team-assigned tasks
            }
            
            assignment_ref.set(assignment_payload)
            
            # Create bounties in separate collection
            if bounty_tasks:
                bounties_ref = tenant_ref.collection("bounties")
                for bounty in bounty_tasks:
                    bounty_ref = bounties_ref.document()
                    bounty_payload = {
                        **bounty,
                        "projectId": request.projectId,
                        "assignmentId": assignment_ref.id,
                        "teamId": request.teamId,
                        "isPublic": True,
                        "status": "open",
                        "createdAt": now,
                        "updatedAt": now,
                    }
                    # Remove fields that don't apply to bounties
                    bounty_payload.pop("assignedTo", None)
                    bounty_payload.pop("assignedToName", None)
                    bounty_ref.set(bounty_payload)
            
            # Update team workload
            team_ref = tenant_ref.collection("teams").document(request.teamId)
            team_ref.set({
                "current_workload": admin_firestore.Increment(1),
                "currentWorkload": admin_firestore.Increment(1),
                "updatedAt": now,
            }, merge=True)
            
            return assignment_ref.id
        
        try:
            assignment_id = await asyncio.to_thread(_persist)
        except FirebaseInitializationError:
            logger.warning("Firebase not configured; assignment not persisted")
            assignment_id = f"local_{request.projectId}_{request.teamId}"
        except exceptions.GoogleCloudError as exc:
            logger.error("Firestore error during assignment: %s", exc)
            raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
        
        return DirectAssignmentResponse(
            success=True,
            assignmentId=assignment_id,
            projectId=request.projectId,
            teamId=request.teamId,
            teamName=team.get("name", "Unknown Team"),
            tasks=[TaskDetail(**task) for task in tasks],
            message=f"Project assigned to {team.get('name')} with {len(tasks)} tasks generated"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error during project assignment: %s", e)
        raise HTTPException(status_code=500, detail=f"Assignment failed: {str(e)}")


@app.post("/bounties", response_model=BountyResponse)
async def create_bounty(request: BountyCreateRequest):
    """
    Create a new standalone bounty
    
    This endpoint allows managers to create side bounties for simple tasks
    that can be picked up by any available developer.
    """
    try:
        def _persist() -> Dict:
            db = get_firestore_client()
            tenant_ref = db.collection("tenants").document(DEFAULT_TENANT_ID)
            bounties_ref = tenant_ref.collection("bounties")
            bounty_ref = bounties_ref.document()
            
            now = admin_firestore.SERVER_TIMESTAMP
            bounty_payload = {
                "title": request.title,
                "description": request.description,
                "estimatedHours": request.estimatedHours,
                "skills": request.skills,
                "priority": request.priority or "medium",
                "status": "available",
                "isPublic": True,
                "linkedProjectId": request.linkedProjectId,
                "reward": request.reward,
                "deadline": request.deadline,
                "createdBy": "manager",  # TODO: Get from auth context
                "createdAt": now,
                "updatedAt": now,
            }
            
            bounty_ref.set(bounty_payload)
            
            # Return with document ID and timestamps as integers
            result = bounty_payload.copy()
            result["id"] = bounty_ref.id
            result["createdAt"] = int(datetime.now().timestamp() * 1000)
            return result
        
        bounty = await asyncio.to_thread(_persist)
        return BountyResponse(**bounty)
    
    except Exception as e:
        logger.error("Error creating bounty: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to create bounty: {str(e)}")


@app.get("/bounties", response_model=BountyListResponse)
async def list_bounties(status: Optional[str] = None, skill: Optional[str] = None):
    """
    List all available bounties with optional filtering
    
    Query parameters:
    - status: Filter by bounty status (available, claimed, review, completed)
    - skill: Filter by required skill
    """
    try:
        def _fetch() -> List[Dict]:
            db = get_firestore_client()
            tenant_ref = db.collection("tenants").document(DEFAULT_TENANT_ID)
            bounties_ref = tenant_ref.collection("bounties")
            
            query = bounties_ref
            if status:
                query = query.where("status", "==", status)
            
            bounties = []
            for doc in query.stream():
                bounty_data = doc.to_dict() or {}
                bounty_data["id"] = doc.id
                
                # Filter by skill if provided
                if skill and skill not in bounty_data.get("skills", []):
                    continue
                
                # Set defaults for missing fields
                if "createdBy" not in bounty_data:
                    bounty_data["createdBy"] = "system"
                if "priority" not in bounty_data:
                    bounty_data["priority"] = "medium"
                if "status" not in bounty_data:
                    bounty_data["status"] = "available"
                
                # Convert timestamps
                if "createdAt" in bounty_data and hasattr(bounty_data["createdAt"], "timestamp"):
                    bounty_data["createdAt"] = int(bounty_data["createdAt"].timestamp() * 1000)
                elif "createdAt" not in bounty_data:
                    bounty_data["createdAt"] = int(datetime.now().timestamp() * 1000)
                    
                if "claimedAt" in bounty_data and hasattr(bounty_data["claimedAt"], "timestamp"):
                    bounty_data["claimedAt"] = int(bounty_data["claimedAt"].timestamp() * 1000)
                
                bounties.append(bounty_data)
            
            return bounties
        
        bounties = await asyncio.to_thread(_fetch)
        return BountyListResponse(bounties=[BountyResponse(**b) for b in bounties], total=len(bounties))
    
    except Exception as e:
        logger.error("Error listing bounties: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to list bounties: {str(e)}")


@app.post("/bounties/{bounty_id}/claim")
async def claim_bounty(bounty_id: str, request: BountyClaimRequest):
    """
    Claim an available bounty
    
    Allows a developer to claim an open bounty and start working on it.
    """
    try:
        def _claim() -> Dict:
            db = get_firestore_client()
            tenant_ref = db.collection("tenants").document(DEFAULT_TENANT_ID)
            bounty_ref = tenant_ref.collection("bounties").document(bounty_id)
            
            bounty_doc = bounty_ref.get()
            if not bounty_doc.exists:
                raise HTTPException(status_code=404, detail="Bounty not found")
            
            bounty_data = bounty_doc.to_dict() or {}
            if bounty_data.get("status") not in ["available", "open"]:
                raise HTTPException(status_code=400, detail="Bounty is not available")
            
            now = admin_firestore.SERVER_TIMESTAMP
            bounty_ref.update({
                "status": "claimed",
                "claimedBy": request.developerId,
                "claimedByName": request.developerName,
                "claimedAt": now,
                "updatedAt": now,
            })
            
            result = bounty_data.copy()
            result["id"] = bounty_id
            result["status"] = "claimed"
            result["claimedBy"] = request.developerId
            result["claimedByName"] = request.developerName
            result["claimedAt"] = int(datetime.now().timestamp() * 1000)
            
            # Convert createdAt if needed
            if "createdAt" in result and hasattr(result["createdAt"], "timestamp"):
                result["createdAt"] = int(result["createdAt"].timestamp() * 1000)
            
            return result
        
        bounty = await asyncio.to_thread(_claim)
        return BountyResponse(**bounty)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error claiming bounty: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to claim bounty: {str(e)}")


@app.put("/bounties/{bounty_id}")
async def update_bounty(bounty_id: str, request: Dict):
    """
    Update bounty status or details
    
    Allows updating bounty information like status, description, etc.
    """
    try:
        def _update() -> Dict:
            db = get_firestore_client()
            tenant_ref = db.collection("tenants").document(DEFAULT_TENANT_ID)
            bounty_ref = tenant_ref.collection("bounties").document(bounty_id)
            
            bounty_doc = bounty_ref.get()
            if not bounty_doc.exists:
                raise HTTPException(status_code=404, detail="Bounty not found")
            
            # Update allowed fields
            update_data = {}
            allowed_fields = ["status", "description", "estimatedHours", "priority", "deadline"]
            for field in allowed_fields:
                if field in request:
                    update_data[field] = request[field]
            
            if update_data:
                update_data["updatedAt"] = admin_firestore.SERVER_TIMESTAMP
                bounty_ref.update(update_data)
            
            # Get updated document
            bounty_data = bounty_ref.get().to_dict() or {}
            bounty_data["id"] = bounty_id
            
            # Convert timestamps
            if "createdAt" in bounty_data and hasattr(bounty_data["createdAt"], "timestamp"):
                bounty_data["createdAt"] = int(bounty_data["createdAt"].timestamp() * 1000)
            if "claimedAt" in bounty_data and hasattr(bounty_data["claimedAt"], "timestamp"):
                bounty_data["claimedAt"] = int(bounty_data["claimedAt"].timestamp() * 1000)
            
            return bounty_data
        
        bounty = await asyncio.to_thread(_update)
        return BountyResponse(**bounty)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating bounty: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to update bounty: {str(e)}")


@app.post("/bounties/{bounty_id}/complete")
async def complete_bounty(bounty_id: str):
    """
    Mark a bounty as completed
    
    Called by a developer when they finish work on a claimed bounty.
    """
    try:
        def _complete() -> Dict:
            db = get_firestore_client()
            tenant_ref = db.collection("tenants").document(DEFAULT_TENANT_ID)
            bounty_ref = tenant_ref.collection("bounties").document(bounty_id)
            
            bounty_doc = bounty_ref.get()
            if not bounty_doc.exists:
                raise HTTPException(status_code=404, detail="Bounty not found")
            
            bounty_data = bounty_doc.to_dict() or {}
            if bounty_data.get("status") not in ["claimed"]:
                raise HTTPException(status_code=400, detail="Bounty cannot be completed in current status")
            
            now = admin_firestore.SERVER_TIMESTAMP
            bounty_ref.update({
                "status": "completed",
                "updatedAt": now,
            })
            
            result = bounty_data.copy()
            result["id"] = bounty_id
            result["status"] = "completed"
            
            # Convert timestamps
            if "createdAt" in result and hasattr(result["createdAt"], "timestamp"):
                result["createdAt"] = int(result["createdAt"].timestamp() * 1000)
            if "claimedAt" in result and hasattr(result["claimedAt"], "timestamp"):
                result["claimedAt"] = int(result["claimedAt"].timestamp() * 1000)
            
            return result
        
        bounty = await asyncio.to_thread(_complete)
        return BountyResponse(**bounty)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error completing bounty: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to complete bounty: {str(e)}")


@app.post("/finalize_assignment", response_model=FinalizeAssignmentResponse)
async def finalize_assignment(request: FinalizeAssignmentRequest):
    """
    Finalize an assignment by saving final task breakdown
    
    This endpoint:
    1. Updates the assignment document with finalized team tasks
    2. Creates individual bounty documents for each bounty task
    3. Updates project status to in-progress
    4. Returns summary of what was saved
    """
    try:
        def _persist() -> Dict[str, int]:
            db = get_firestore_client()
            tenant_ref = db.collection("tenants").document(DEFAULT_TENANT_ID)
            now = admin_firestore.SERVER_TIMESTAMP
            
            # Update assignment with finalized team tasks
            assignment_ref = tenant_ref.collection("assignments").document(request.assignmentId)
            
            # Convert team tasks to dict format
            team_tasks_data = [task.dict() for task in request.teamTasks]
            
            # Log assignments for debugging
            logger.info(f"Finalizing assignment {request.assignmentId} with {len(team_tasks_data)} team tasks")
            for task in team_tasks_data:
                if task.get('assignedToId'):
                    logger.info(f"  Task '{task['title']}' assigned to {task.get('assignedToName')} ({task.get('assignedToId')})")
                else:
                    logger.warning(f"  Task '{task['title']}' has NO ASSIGNMENT")
            
            assignment_ref.update({
                "tasks": team_tasks_data,
                "status": "in-progress",
                "updatedAt": now,
            })
            
            # Create individual bounty documents
            bounties_created = 0
            if request.bountyTasks:
                bounties_ref = tenant_ref.collection("bounties")
                for bounty_task in request.bountyTasks:
                    bounty_ref = bounties_ref.document()
                    bounty_payload = {
                        "title": bounty_task.title,
                        "description": bounty_task.description,
                        "estimatedHours": bounty_task.estimatedHours,
                        "skills": bounty_task.skills,
                        "priority": bounty_task.priority or "medium",
                        "status": "open",
                        "isPublic": True,
                        "projectId": request.projectId,
                        "assignmentId": request.assignmentId,
                        "teamId": request.teamId,
                        "createdBy": "manager",
                        "createdAt": now,
                        "updatedAt": now,
                    }
                    bounty_ref.set(bounty_payload)
                    bounties_created += 1
            
            # Update project status to in-progress
            project_ref = tenant_ref.collection("projects").document(request.projectId)
            project_ref.update({
                "status": "in-progress",
                "updatedAt": now,
            })
            
            return {
                "teamTasksCount": len(request.teamTasks),
                "bountiesCreated": bounties_created,
            }
        
        result = await asyncio.to_thread(_persist)
        
        return FinalizeAssignmentResponse(
            success=True,
            assignmentId=request.assignmentId,
            teamTasksCount=result["teamTasksCount"],
            bountiesCreated=result["bountiesCreated"],
            message=f"Assignment finalized: {result['teamTasksCount']} team tasks, {result['bountiesCreated']} bounties created"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error finalizing assignment: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to finalize assignment: {str(e)}")


@app.delete("/assignments/{assignment_id}")
async def delete_assignment(assignment_id: str):
    """
    Delete an assignment and its associated tasks
    
    Removes an assignment from the database and all its related data.
    """
    try:
        def _delete() -> Dict:
            db = get_firestore_client()
            tenant_ref = db.collection("tenants").document(DEFAULT_TENANT_ID)
            
            logger.info(f"Attempting to delete assignment: {assignment_id}")
            
            # First try to find in tenant assignments collection
            assignment_ref = tenant_ref.collection("assignments").document(assignment_id)
            assignment_doc = assignment_ref.get()
            
            if assignment_doc.exists:
                logger.info(f"Found assignment in tenants/{DEFAULT_TENANT_ID}/assignments/{assignment_id}")
                # Delete the assignment
                assignment_ref.delete()
                logger.info(f"Successfully deleted assignment from tenant collection")
                return {
                    "success": True,
                    "message": f"Assignment {assignment_id} deleted successfully"
                }
            
            logger.info(f"Assignment not found in tenant collection, searching collection group...")
            
            # If not found, search in collection group (assignments under projects)
            # We need to iterate through the collection group and find matching document ID
            assignments = db.collection_group("assignments").stream()
            
            found = False
            count = 0
            for doc in assignments:
                count += 1
                logger.info(f"Checking assignment {doc.id} at path: {doc.reference.path}")
                if doc.id == assignment_id:
                    logger.info(f"Found matching assignment! Deleting from: {doc.reference.path}")
                    doc.reference.delete()
                    found = True
                    break
            
            logger.info(f"Scanned {count} assignments in collection group")
            
            if not found:
                logger.warning(f"Assignment {assignment_id} not found anywhere")
                return {"error": "Assignment not found", "success": False}
            
            logger.info(f"Successfully deleted assignment {assignment_id}")
            return {
                "success": True,
                "message": f"Assignment {assignment_id} deleted successfully"
            }
        
        result = await asyncio.to_thread(_delete)
        
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error", "Assignment not found"))
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting assignment: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to delete assignment: {str(e)}")
        logger.error("Error deleting assignment: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to delete assignment: {str(e)}")


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

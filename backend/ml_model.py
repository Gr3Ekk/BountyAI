"""
ML Model for BountyAI - Team Assignment Logic

This module contains the core algorithm that scores teams and assigns bounties
based on skill matching, productivity rates, and current workload.

Scoring Weights:
- Skill Match: 50%
- Productivity Rate: 30%
- Workload Capacity: 20%

Copyright (c) 2025 Luis Penson. All rights reserved.
This software may not be copied, modified, distributed, or used without explicit permission.
"""

import json
from typing import Dict, List, Tuple, Optional
import os


def load_json_file(file_path: str) -> List[Dict]:
    """Load JSON data from a file."""
    if not os.path.exists(file_path):
        return []
    with open(file_path, 'r') as f:
        return json.load(f)


def calculate_skill_match(team_skills: List[str], required_skills: List[str]) -> float:
    """
    Calculate the skill match score between a team and a bounty.
    
    Args:
        team_skills: List of skills the team possesses
        required_skills: List of skills required for the bounty
    
    Returns:
        Float between 0 and 1 representing skill match percentage
    """
    if not required_skills:
        return 1.0
    
    # Convert to lowercase for case-insensitive matching
    team_skills_lower = [skill.lower() for skill in team_skills]
    required_skills_lower = [skill.lower() for skill in required_skills]
    
    # Find matching skills
    matched_skills = sum(1 for skill in required_skills_lower if skill in team_skills_lower)
    
    # Calculate match percentage
    skill_match = matched_skills / len(required_skills_lower)
    
    return skill_match


def calculate_workload_score(current_workload: int, max_capacity: int) -> float:
    """
    Calculate workload score - higher capacity remaining = higher score.
    
    Args:
        current_workload: Current number of assigned projects
        max_capacity: Maximum capacity of the team
    
    Returns:
        Float between 0 and 1 (1 = fully available, 0 = at capacity)
    """
    if max_capacity == 0:
        return 0.0
    
    available_capacity = max_capacity - current_workload
    workload_score = available_capacity / max_capacity
    
    # Penalize teams that are already at or over capacity
    if available_capacity <= 0:
        return 0.0
    
    return workload_score


def assign_bounty(
    bounty_id: str,
    teams_data_path: str = "data/teams.json",
    projects_data_path: str = "data/projects.json",
    teams_data: Optional[List[Dict]] = None,
    projects_data: Optional[List[Dict]] = None,
) -> Dict:
    """
    Assign a bounty to the best-fit team using heuristic scoring.
    
    Algorithm:
    1. Calculate skill match score (50% weight)
    2. Apply productivity rate multiplier (30% weight)
    3. Apply workload capacity score (20% weight)
    4. Return top-scoring team with reasoning
    
    Args:
        bounty_id: ID of the bounty/project to assign
        teams_data_path: Path to teams.json file
        projects_data_path: Path to projects.json file
    
    Returns:
        Dict containing:
        - assigned_team: The team object that was assigned
        - fit_score: Overall fit score (0-100)
        - reasoning: Explanation of why this team was chosen
        - all_scores: Detailed scores for all teams
    """
    
    # Load data
    teams = teams_data if teams_data is not None else load_json_file(teams_data_path)
    projects = projects_data if projects_data is not None else load_json_file(projects_data_path)
    
    # Find the project/bounty
    project = next((p for p in projects if p["id"] == bounty_id), None)
    if not project:
        return {
            "error": f"Bounty {bounty_id} not found",
            "assigned_team": None,
            "fit_score": 0
        }
    
    required_skills = project.get("required_skills", [])
    
    # Score each team
    team_scores = []
    
    for team in teams:
        # Calculate individual scores
        skill_match = calculate_skill_match(team["skills"], required_skills)
        productivity = team.get("productivity_rate", 0.5)
        workload_score = calculate_workload_score(
            team["current_workload"],
            team["max_capacity"]
        )
        
        # Apply weights (50% skills, 30% productivity, 20% workload)
        weighted_score = (
            (skill_match * 0.50) +
            (productivity * 0.30) +
            (workload_score * 0.20)
        )
        
        # Convert to 0-100 scale
        final_score = weighted_score * 100
        
        team_scores.append({
            "team": team,
            "final_score": final_score,
            "skill_match": skill_match * 100,
            "productivity": productivity * 100,
            "workload_score": workload_score * 100
        })
    
    # Sort by score (highest first)
    team_scores.sort(key=lambda x: x["final_score"], reverse=True)
    
    # Check if best team is viable (at least 0 capacity and some relevance)
    best_team_data = team_scores[0]
    best_team = best_team_data["team"]
    
    # Generate reasoning
    matched_skills = [
        skill for skill in best_team["skills"]
        if skill.lower() in [s.lower() for s in required_skills]
    ]
    
    reasoning = (
        f"{best_team['name']} selected based on: "
        f"{len(matched_skills)}/{len(required_skills)} required skills matched "
        f"({', '.join(matched_skills) if matched_skills else 'partial match'}), "
        f"{best_team['productivity_rate']*100:.0f}% productivity rate, "
        f"and {best_team['max_capacity'] - best_team['current_workload']} available slots."
    )
    
    return {
        "assigned_team": best_team,
        "fit_score": round(best_team_data["final_score"], 2),
        "reasoning": reasoning,
        "all_scores": [
            {
                "team_id": score["team"]["id"],
                "team_name": score["team"]["name"],
                "score": round(score["final_score"], 2),
                "skill_match": round(score["skill_match"], 2),
                "productivity": round(score["productivity"], 2),
                "workload_score": round(score["workload_score"], 2)
            }
            for score in team_scores
        ]
    }


if __name__ == "__main__":
    # Example usage
    result = assign_bounty("bounty_001")
    print(json.dumps(result, indent=2))

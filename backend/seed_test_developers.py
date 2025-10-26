#!/usr/bin/env python3
"""
Seed test developer accounts for bounty testing.
Creates Firebase Auth users and Firestore developer documents.

All developers will have:
- Email: {firstname}@bounty.com
- Password: test123
"""

import os
from datetime import datetime
from dotenv import load_dotenv
from firebase_admin import auth
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from firebase_client import get_firebase_app, get_firestore_client

# Load environment variables
load_dotenv()

# Initialize Firebase
app = get_firebase_app()
db = get_firestore_client()

# Test developers with various skills
# Distributed across different teams for testing
TEST_DEVELOPERS = [
    {
        "email": "alex@bounty.com",
        "displayName": "Alex Chen",
        "skills": ["Python", "React", "TypeScript", "API Design"],
        "level": "Senior",
        "availability": "full-time",
        "teamId": "team_delta"  # Delta Force - Full-stack team
    },
    {
        "email": "jordan@bounty.com",
        "displayName": "Jordan Smith",
        "skills": ["JavaScript", "Node.js", "MongoDB", "Express"],
        "level": "Mid-Level",
        "availability": "full-time",
        "teamId": "team_beta"  # Beta Crew - Backend team
    },
    {
        "email": "taylor@bounty.com",
        "displayName": "Taylor Johnson",
        "skills": ["React", "Vue.js", "CSS", "UI/UX"],
        "level": "Mid-Level",
        "availability": "part-time",
        "teamId": "team_alpha"  # Alpha Pilots - Frontend team
    },
    {
        "email": "morgan@bounty.com",
        "displayName": "Morgan Lee",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        "level": "Senior",
        "availability": "full-time",
        "teamId": "team_beta"  # Beta Crew - Backend team
    },
    {
        "email": "riley@bounty.com",
        "displayName": "Riley Brown",
        "skills": ["Java", "Spring Boot", "Microservices", "Kubernetes"],
        "level": "Senior",
        "availability": "full-time",
        "teamId": "team_gamma"  # Gamma Squadron - DevOps team
    },
    {
        "email": "casey@bounty.com",
        "displayName": "Casey Davis",
        "skills": ["React", "TypeScript", "GraphQL", "Testing"],
        "level": "Mid-Level",
        "availability": "full-time",
        "teamId": "team_alpha"  # Alpha Pilots - Frontend team
    }
]

PASSWORD = "test123"


def create_auth_user(email: str, display_name: str):
    """Create a Firebase Auth user."""
    try:
        # Check if user already exists
        try:
            user = auth.get_user_by_email(email)
            print(f"✓ Auth user already exists: {email} (UID: {user.uid})")
            return user.uid
        except Exception:
            pass
        
        # Create new user
        user = auth.create_user(
            email=email,
            password=PASSWORD,
            display_name=display_name,
            email_verified=True
        )
        print(f"✓ Created auth user: {email} (UID: {user.uid})")
        return user.uid
    except Exception as e:
        print(f"✗ Error creating auth user {email}: {e}")
        return None


def create_developer_document(uid: str, developer_data: dict):
    """Create a Firestore developer document."""
    try:
        doc_ref = db.collection('tenants').document('default').collection('developers').document(uid)
        
        # Check if developer already exists
        doc = doc_ref.get()
        if doc.exists:
            # Update existing developer with team assignment
            doc_ref.update({
                "teamId": developer_data["teamId"],
                "updatedAt": SERVER_TIMESTAMP
            })
            print(f"✓ Updated developer with team: {developer_data['email']} → {developer_data['teamId']}")
            return
        
        # Create developer document
        developer_doc = {
            "uid": uid,
            "email": developer_data["email"],
            "displayName": developer_data["displayName"],
            "role": "developer",
            "skills": developer_data["skills"],
            "level": developer_data["level"],
            "availability": developer_data["availability"],
            "teamId": developer_data["teamId"],
            "assignedBounties": [],
            "completedBounties": [],
            "totalPoints": 0,
            "createdAt": SERVER_TIMESTAMP
        }
        
        doc_ref.set(developer_doc)
        print(f"✓ Created developer document: {developer_data['email']} → Team {developer_data['teamId']}")
    except Exception as e:
        print(f"✗ Error creating developer document for {developer_data['email']}: {e}")


def seed_test_developers():
    """Seed all test developer accounts."""
    print("\n=== Seeding Test Developer Accounts ===\n")
    print(f"Password for all accounts: {PASSWORD}\n")
    
    for developer in TEST_DEVELOPERS:
        print(f"\nProcessing: {developer['displayName']} ({developer['email']})")
        
        # Create auth user
        uid = create_auth_user(developer["email"], developer["displayName"])
        if not uid:
            continue
        
        # Create developer document
        create_developer_document(uid, developer)
    
    print("\n=== Seeding Complete ===\n")
    print("Test Developer Accounts:")
    for developer in TEST_DEVELOPERS:
        print(f"  • {developer['email']} / {PASSWORD}")
    print()


if __name__ == "__main__":
    seed_test_developers()

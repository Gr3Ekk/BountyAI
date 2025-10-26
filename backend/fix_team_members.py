#!/usr/bin/env python3
"""
Fix team members - Add test developers to their assigned teams
"""

from dotenv import load_dotenv
load_dotenv()

from firebase_client import get_firestore_client
from google.cloud.firestore_v1 import SERVER_TIMESTAMP, ArrayUnion

db = get_firestore_client()

# Test developers and their team assignments
DEVELOPER_TEAMS = {
    "team_alpha": ["w3W7Pc1NoqZAzKT5dEqNOYVzpHy2", "7FhLu44IkAO2XBajDGndW89YQkA2"],  # Taylor, Casey
    "team_beta": ["TBroFOk1cgakhpeUOmQSS6i35C23", "fJSELJvILuPyNxnglihmaXBzmDc2"],    # Jordan, Morgan
    "team_gamma": ["oSPHlCHUXETa8SdDAbfnF4gsW8q1"],  # Riley
    "team_delta": ["O6EUg6rUTEaRUweGhnpcq6vNSao2"]   # Alex
}

DEVELOPER_INFO = {
    "O6EUg6rUTEaRUweGhnpcq6vNSao2": {"email": "alex@bounty.com", "name": "Alex Chen"},
    "TBroFOk1cgakhpeUOmQSS6i35C23": {"email": "jordan@bounty.com", "name": "Jordan Smith"},
    "w3W7Pc1NoqZAzKT5dEqNOYVzpHy2": {"email": "taylor@bounty.com", "name": "Taylor Johnson"},
    "fJSELJvILuPyNxnglihmaXBzmDc2": {"email": "morgan@bounty.com", "name": "Morgan Lee"},
    "oSPHlCHUXETa8SdDAbfnF4gsW8q1": {"email": "riley@bounty.com", "name": "Riley Brown"},
    "7FhLu44IkAO2XBajDGndW89YQkA2": {"email": "casey@bounty.com", "name": "Casey Davis"}
}

def fix_team_members():
    """Add test developers to their teams"""
    print("\n=== Adding Test Developers to Teams ===\n")
    
    tenant_ref = db.collection('tenants').document('default')
    teams_ref = tenant_ref.collection('teams')
    
    for team_id, member_uids in DEVELOPER_TEAMS.items():
        print(f"\n📋 Updating {team_id}...")
        team_ref = teams_ref.document(team_id)
        team_doc = team_ref.get()
        
        if not team_doc.exists:
            print(f"  ❌ Team {team_id} not found")
            continue
            
        team_data = team_doc.to_dict()
        team_name = team_data.get('name', team_id)
        current_members = team_data.get('members', [])
        
        print(f"  Team: {team_name}")
        print(f"  Current members: {len(current_members)}")
        
        # Add new members
        new_members_added = 0
        for uid in member_uids:
            if uid not in current_members:
                info = DEVELOPER_INFO.get(uid, {})
                team_ref.update({
                    'members': ArrayUnion([uid]),
                    'updatedAt': SERVER_TIMESTAMP
                })
                print(f"    ✅ Added {info.get('name', uid)} ({info.get('email', 'N/A')})")
                new_members_added += 1
            else:
                info = DEVELOPER_INFO.get(uid, {})
                print(f"    ✓ Already member: {info.get('name', uid)}")
        
        if new_members_added > 0:
            print(f"  ✅ Added {new_members_added} new member(s)")
        else:
            print(f"  ✓ No changes needed")
    
    print("\n=== Complete ===\n")
    
    # Show final team rosters
    print("\n=== Final Team Rosters ===\n")
    for team_id in DEVELOPER_TEAMS.keys():
        team_ref = teams_ref.document(team_id)
        team_doc = team_ref.get()
        if team_doc.exists:
            team_data = team_doc.to_dict()
            team_name = team_data.get('name', team_id)
            members = team_data.get('members', [])
            print(f"{team_name} ({team_id}): {len(members)} members")
            for uid in members:
                info = DEVELOPER_INFO.get(uid, {'name': 'Unknown', 'email': uid})
                print(f"  - {info['name']} ({info['email']})")
            print()

if __name__ == "__main__":
    fix_team_members()

# BountyAI Assignment Flow - Visual Guide

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MANAGER WORKFLOW                             │
└─────────────────────────────────────────────────────────────────────┘

Step 1: AI Recommendation
┌──────────────────────┐
│  Manager Dashboard   │
│  /manager/dashboard  │
└──────────┬───────────┘
           │
           ├──> Navigate to AI Copilot
           ↓
┌──────────────────────────────────────────────────┐
│         Manager AI Copilot                       │
│         /manager/copilot                         │
│                                                  │
│  1. Select Project: [Dropdown]                   │
│  2. Chat with AI:                                │
│     "Which team should I assign to this?"        │
│                                                  │
│  3. AI Response:                                 │
│     ┌────────────────────────────────────────┐  │
│     │ ✓ Preferred Squad: Team Alpha          │  │
│     │   Confidence: 85%                       │  │
│     │   [Assign Team] Button                  │  │
│     └────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────────┘
                   │
                   ├──> Click "Assign Team"
                   ↓
            POST /assign_project
            {
              projectId: "proj_123",
              teamId: "team_alpha",
              reasoning: "AI recommendation"
            }
                   │
                   ├──> Backend generates tasks
                   │    - Analyzes project requirements
                   │    - Matches team member skills
                   │    - Creates task breakdown
                   │    - Assigns to developers
                   │
                   ├──> Stores in Firestore:
                   │    - assignments/[id]
                   │    - Updates project status
                   │    - Increments team workload
                   │
                   ├──> Returns assignment data
                   │
                   ├──> Saves to sessionStorage
                   │
                   ↓
Step 2: Review & Edit Tasks
┌──────────────────────────────────────────────────┐
│    Team Assignment View                          │
│    /manager/assignment/:assignmentId             │
│                                                  │
│  ┌────────────────┐  ┌──────────────────────┐   │
│  │ Team Overview  │  │  Task Breakdown      │   │
│  │                │  │                      │   │
│  │ • Team Alpha   │  │  Team Tasks:         │   │
│  │ • 4 members    │  │  ☐ API Development   │   │
│  │ • Skills: ...  │  │  ☐ UI Components     │   │
│  │                │  │  ☐ Testing           │   │
│  │ Why this team: │  │                      │   │
│  │ Great skill    │  │  Bounties:           │   │
│  │ match & avail. │  │  ☐ Fix Docs          │   │
│  └────────────────┘  │  ☐ Write Tests       │   │
│                      └──────────────────────┘   │
│                                                  │
│  Actions:                                        │
│  • ✏️ Edit task details                          │
│  • 🌐 Convert team task ↔ bounty                │
│  • ➕ Add new tasks                              │
│  • 🗑️ Delete tasks                              │
│                                                  │
│  [Cancel]  [Finalize Assignment]                 │
└──────────────────┬───────────────────────────────┘
                   │
                   ├──> Click "Finalize"
                   ↓
          POST /finalize_assignment
          {
            assignmentId: "assign_123",
            teamTasks: [...],
            bountyTasks: [...]
          }
                   │
                   ├──> Backend processes:
                   │    - Updates assignment with final tasks
                   │    - Creates separate bounty docs
                   │    - Updates project to "in-progress"
                   │
                   ├──> Stores in Firestore:
                   │    - assignments/[id] → team tasks
                   │    - bounties/[id] → each bounty
                   │    - projects/[id] → status update
                   │
                   ├──> Success! 
                   │
                   ↓
         Navigate to Dashboard


┌─────────────────────────────────────────────────────────────────────┐
│                       DEVELOPER WORKFLOW                             │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│         Developer Hub                            │
│         /developer                               │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │     My Assigned Tasks (NEW!)               │ │
│  │                                            │ │
│  │  ┌──────────────────────────────────────┐ │ │
│  │  │ ✓ API Development                    │ │ │
│  │  │   Project: E-Commerce Platform       │ │ │
│  │  │   ⏱️ 12h estimated                    │ │ │
│  │  │   [pending]                          │ │ │
│  │  └──────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────┐ │ │
│  │  │ ✓ UI Components                      │ │ │
│  │  │   Project: E-Commerce Platform       │ │ │
│  │  │   ⏱️ 14h estimated                    │ │ │
│  │  │   [pending]                          │ │ │
│  │  └──────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │     Squad Assignments                      │ │
│  │                                            │ │
│  │  ┌──────────────────────────────────────┐ │ │
│  │  │ 📦 E-Commerce Platform               │ │ │
│  │  │   Crew: Team Alpha                   │ │ │
│  │  │   [████░░░░░░] 40% Complete          │ │ │
│  │  └──────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │     Bounty Board                           │ │
│  │                                            │ │
│  │  ┌──────────────────────────────────────┐ │ │
│  │  │ 🌐 Fix Documentation Typos           │ │ │
│  │  │   [easy] [$500]                      │ │ │
│  │  │   Skills: documentation              │ │ │
│  │  │   [Claim] (Coming Soon)              │ │ │
│  │  └──────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA PERSISTENCE                              │
└─────────────────────────────────────────────────────────────────────┘

AI Copilot generates recommendation
           │
           ├──> Frontend: setLastRecommendation()
           │    { teamId, teamName, confidence, summary }
           │
           ↓
Manager clicks "Assign Team"
           │
           ├──> API: POST /assign_project
           │    { projectId, teamId, reasoning }
           │
           ↓
Backend generates tasks
           │
           ├──> generate_initial_tasks()
           │    • Analyzes project.estimatedHours
           │    • Checks project.requiredSkills
           │    • Matches team member skills
           │    • Creates task breakdown
           │    • Classifies as team/bounty
           │    • Assigns to best-fit developers
           │
           ↓
Backend creates assignment
           │
           ├──> Firestore Write:
           │    tenants/default/assignments/[assignmentId]
           │    {
           │      projectId,
           │      teamId,
           │      status: "in-progress",
           │      tasks: [team-assignment tasks],
           │      reasoning,
           │      createdAt,
           │      updatedAt
           │    }
           │
           ├──> Firestore Update:
           │    tenants/default/projects/[projectId]
           │    {
           │      status: "assigned",
           │      assignedTeamId: teamId,
           │      updatedAt
           │    }
           │
           ├──> Firestore Update:
           │    tenants/default/teams/[teamId]
           │    {
           │      currentWorkload: +1,
           │      updatedAt
           │    }
           │
           ↓
Frontend receives response
           │
           ├──> sessionStorage.setItem()
           │    assignment_[assignmentId] = {
           │      assignmentId,
           │      projectId,
           │      teamId,
           │      tasks: [...],
           │      ...
           │    }
           │
           ├──> navigate(`/manager/assignment/${assignmentId}`)
           │
           ↓
Manager reviews & finalizes
           │
           ├──> API: POST /finalize_assignment
           │    { assignmentId, teamTasks, bountyTasks }
           │
           ↓
Backend finalizes assignment
           │
           ├──> Firestore Update:
           │    tenants/default/assignments/[assignmentId]
           │    {
           │      tasks: [final team tasks],
           │      status: "in-progress",
           │      updatedAt
           │    }
           │
           ├──> Firestore Write (for each bounty):
           │    tenants/default/bounties/[bountyId]
           │    {
           │      projectId,
           │      assignmentId,
           │      teamId,
           │      title,
           │      description,
           │      skills,
           │      estimatedHours,
           │      type: "bounty",
           │      status: "open",
           │      isPublic: true,
           │      createdAt,
           │      updatedAt
           │    }
           │
           ├──> Firestore Update:
           │    tenants/default/projects/[projectId]
           │    {
           │      status: "in-progress",
           │      updatedAt
           │    }
           │
           ↓
Developer logs in
           │
           ├──> Firestore Subscribe:
           │    tenants/default/assignments/*
           │    (Real-time listener)
           │
           ├──> Frontend filters tasks:
           │    assignments.forEach(a => {
           │      a.tasks.filter(t =>
           │        t.assignedTo === developer.id ||
           │        t.assignedToId === developer.id
           │      )
           │    })
           │
           ├──> Display in "My Assigned Tasks"
           │    • Task title & description
           │    • Project name
           │    • Estimated hours
           │    • Current status
           │
           ↓
Developer sees tasks immediately
```

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                   COMPONENT COMMUNICATION                            │
└─────────────────────────────────────────────────────────────────────┘

ManagerAICopilot
      │
      ├──> sendCopilotMessage(missionContext)
      │    └─> Cloudflare Worker → AI Model
      │
      ├──> setLastRecommendation(response.recommendation)
      │
      ├──> assignProjectToTeam({ projectId, teamId, reasoning })
      │    └─> Backend API → Firestore
      │
      ├──> sessionStorage.setItem('assignment_X', data)
      │
      └──> navigate('/manager/assignment/:id')
              │
              ↓
      TeamAssignmentView
              │
              ├──> useAuth() → get tenantId
              │
              ├──> useTenantTeams() → Firestore subscribe
              │
              ├──> useTenantDevelopers() → Firestore subscribe
              │
              ├──> sessionStorage.getItem() || fetchAssignmentById()
              │    └─> Firestore read
              │
              ├──> fetchBountiesForAssignment()
              │    └─> Firestore read
              │
              ├──> Display team & task data
              │
              ├──> Edit tasks (local state)
              │
              └──> finalizeAssignment({ ...tasks })
                   └─> Backend API → Firestore writes
                        │
                        ↓
                 Firestore Updated
                        │
                        ├──> assignments/[id] updated
                        ├──> bounties/[ids] created
                        └──> projects/[id] updated
                             │
                             ↓
                      Real-time sync
                             │
                             ↓
                      DeveloperHub
                             │
                             ├──> useAuth() → get developer email
                             │
                             ├──> useTenantDevelopers() → find profile
                             │
                             ├──> useTenantAssignments() → subscribe
                             │    └─> Firestore real-time listener
                             │
                             ├──> Filter tasks by developer.id
                             │
                             └──> Display in "My Assigned Tasks"
```

## State Management Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     STATE MANAGEMENT                                 │
└─────────────────────────────────────────────────────────────────────┘

Component State (React useState):
  ├─ ManagerAICopilot
  │  ├─ messages: CopilotMessage[]
  │  ├─ lastRecommendation: CopilotRecommendation | null
  │  ├─ error: string | null
  │  └─ isAssigning: boolean
  │
  ├─ TeamAssignmentView
  │  ├─ assignmentData: AssignmentData | null
  │  ├─ teamTasks: Task[]
  │  ├─ bountyTasks: Task[]
  │  ├─ selectedTask: Task | null
  │  ├─ isEditingTask: boolean
  │  └─ isFinalizing: boolean
  │
  └─ DeveloperHub
     ├─ individualTasks: computed from assignments
     ├─ squadAssignments: computed from assignments
     └─ bountyBoardItems: computed from projects

Global State (TanStack Query):
  ├─ ['tenant', tenantId, 'teams']
  │  └─> Real-time Firestore subscription
  │
  ├─ ['tenant', tenantId, 'projects']
  │  └─> Real-time Firestore subscription
  │
  ├─ ['tenant', tenantId, 'developers']
  │  └─> Real-time Firestore subscription
  │
  └─ ['tenant', tenantId, 'assignments']
     └─> Real-time Firestore subscription

Session Storage (temporary):
  └─ assignment_[assignmentId]
     └─> Fast access for immediate navigation
         (Falls back to Firestore if missing)

Context (React Context):
  └─ AuthContext
     ├─ state.email
     ├─ state.tenantId
     ├─ state.role
     └─ state.name
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING                                  │
└─────────────────────────────────────────────────────────────────────┘

AI Copilot Errors:
  ├─ No teamId in recommendation
  │  └─> Warning: "Team ID missing. Ask AI again."
  │       Button disabled
  │
  ├─ Network error
  │  └─> Error: "Unable to reach copilot service"
  │       Display in error banner
  │
  └─ Invalid response
     └─> Error: "Unexpected response format"
         Console log for debugging

Assignment Creation Errors:
  ├─ Missing projectId
  │  └─> Error: "No project selected"
  │
  ├─ Missing teamId
  │  └─> Error: "No team ID in recommendation"
  │
  ├─ Backend API error
  │  └─> Error: Display backend error message
  │       Console log full error
  │
  └─> Network error
      └─> Error: "Failed to assign project"

Assignment Loading Errors:
  ├─ Assignment not found in sessionStorage
  │  └─> Try Firestore fallback
  │
  ├─ Assignment not found in Firestore
  │  └─> Error: "Assignment not found"
  │       Show button to return to dashboard
  │
  └─ Network error loading
     └─> Error: "Failed to load assignment data"
         Show retry option

Finalization Errors:
  ├─ Missing required fields
  │  └─> Validation: Check before submit
  │
  ├─ Backend error
  │  └─> Error: Display backend message
  │       Don't navigate away
  │
  └─ Network error
     └─> Error: "Failed to finalize assignment"
         Allow retry

Developer View Errors:
  ├─ No developer profile found
  │  └─> Warning: "Profile not linked"
  │
  ├─ No team assigned
  │  └─> Info: "Link your profile to a squad"
  │
  └─ No assignments
     └─> Info: "No active missions yet"
```

## Success Indicators

```
✅ AI Recommendation Success:
   - Recommendation box appears
   - Team name displayed
   - Confidence % shown
   - "Assign Team" button enabled
   - Console: "Recommendation: { teamId: ... }"

✅ Assignment Creation Success:
   - Navigation to /manager/assignment/:id
   - Team overview loads
   - Tasks display correctly
   - No errors in console
   - sessionStorage has assignment data

✅ Assignment Loading Success:
   - Page loads within 2 seconds
   - Team details visible
   - All tasks displayed
   - Edit buttons functional
   - No "not found" error

✅ Finalization Success:
   - Success message appears
   - "Assignment finalized: X tasks, Y bounties"
   - Navigates to dashboard
   - Console: "Assignment finalized: ..."

✅ Developer View Success:
   - "My Assigned Tasks" section visible
   - Individual tasks displayed
   - Task details accurate
   - Status badges shown
   - Project names correct
```

---

This visual guide should help understand the complete flow!

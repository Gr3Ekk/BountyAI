# BountyAI - Testing Guide

## Quick Start Testing

### Prerequisites
1. Backend running: `cd backend && ./start.sh`
2. Frontend running: `cd frontend && npm run dev`
3. Firebase configured with test data
4. Cloudflare Worker deployed (for AI copilot)

## Test Flow #1: Complete Assignment Flow

### Step 1: Manager - Get AI Recommendation
1. Login as a manager account
2. Navigate to "AI Launch Copilot" (or `/manager/copilot`)
3. Ensure a project is selected in the dropdown
4. Type in the chat: "Which team should I assign to this project?"
5. Wait for AI response

**Expected Result:**
- AI responds with a team recommendation
- A highlighted box appears showing:
  - "Preferred Squad" with team name
  - Confidence percentage
  - "Assign Team" button (enabled)
- If button is disabled, check for warning about missing team ID

**Troubleshooting:**
- Check browser console for logs: "AI Response:" and "Recommendation:"
- If no recommendation appears, the AI might need more context
- Try: "I need to assign [Project Name]. It requires [skills]. Which team is best suited? Please include the team ID."

### Step 2: Create Assignment
1. Click "Assign Team" button
2. Watch for loading state ("Assigning...")

**Expected Result:**
- Automatically navigates to `/manager/assignment/[id]`
- Assignment view loads showing:
  - Team overview (name, skills, members)
  - Task breakdown section
  - List of team tasks
  - List of bounty tasks (if any)

**Troubleshooting:**
- If "Assignment Not Found" appears:
  - Check backend logs for errors
  - Check browser console
  - Try refreshing the page (will load from Firestore)
- If tasks are missing:
  - Check backend generated initial tasks
  - Verify project has estimated hours and skills

### Step 3: Review and Edit Tasks
1. Review the task breakdown
2. Try editing a task:
   - Click the pencil icon on any task
   - Modify the title, description, or hours
   - Click "Save Changes"
3. Try converting task types:
   - Click the 🌐 icon on a team task to convert to bounty
   - Click the 👥 icon on a bounty to convert to team task
4. Try adding a new task:
   - Click "+ Add Task"
   - Fill in details
   - Save

**Expected Result:**
- Tasks update immediately in the UI
- No errors in console
- Task counts update correctly

### Step 4: Finalize Assignment
1. Review all tasks are correct
2. Click "Finalize Assignment" button
3. Wait for confirmation

**Expected Result:**
- Success message appears
- Alert shows: "Assignment finalized: X team tasks, Y bounties created"
- After 1.5 seconds, navigates back to manager dashboard
- Check console for "Assignment finalized:" log

**Troubleshooting:**
- If error appears:
  - Check backend logs
  - Verify Firestore connection
  - Check that all tasks have required fields

### Step 5: Verify Developer Can See Assignment
1. Logout from manager account
2. Login as a developer who is a member of the assigned team
3. Navigate to Developer Hub

**Expected Result:**
- New section "My Assigned Tasks" appears (if you have tasks)
- Shows tasks specifically assigned to you with:
  - Task title and description
  - Project name
  - Estimated hours
  - Status badge
- "Squad Assignments" section shows team-level projects

**Troubleshooting:**
- If tasks don't appear:
  - Check developer's email matches Firestore developer document
  - Check developer's ID matches task's assignedTo/assignedToId
  - Check developer's primaryTeamId matches assignment's teamId
  - Check browser console for filtering logic
  - Try refreshing the page

## Test Flow #2: Task Assignment Without AI

### For Testing Backend Directly
```bash
# Use curl or Postman to test API directly
curl -X POST http://localhost:8000/assign_project \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "project_id_here",
    "teamId": "team_id_here",
    "reasoning": "Manual test assignment"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "assignmentId": "generated_id",
  "projectId": "project_id_here",
  "teamId": "team_id_here",
  "teamName": "Team Name",
  "tasks": [...],
  "message": "Project assigned to Team Name with N tasks generated"
}
```

## Test Flow #3: Verify Data in Firestore

### Check Assignment Document
1. Open Firebase Console
2. Go to Firestore Database
3. Navigate to: `tenants/default/assignments/`
4. Find the assignment document

**Should contain:**
- `projectId`
- `teamId`
- `tenantId: "default"`
- `status: "in-progress"`
- `reasoning`
- `tasks` (array of team-assignment tasks)
- `createdAt`, `updatedAt` timestamps

### Check Bounty Documents
1. In Firestore, navigate to: `tenants/default/bounties/`
2. Find bounties with matching `assignmentId`

**Each bounty should contain:**
- `title`, `description`
- `estimatedHours`, `skills`
- `type: "bounty"`
- `status: "open"`
- `isPublic: true`
- `projectId`, `assignmentId`, `teamId`
- `createdAt`, `updatedAt` timestamps

### Check Project Status
1. Navigate to: `tenants/default/projects/[projectId]`

**Should show:**
- `status: "in-progress"`
- `assignedTeamId: "[team_id]"`
- `updatedAt` recently updated

### Check Team Workload
1. Navigate to: `tenants/default/teams/[teamId]`

**Should show:**
- `currentWorkload` incremented by 1
- `updatedAt` recently updated

## Common Issues and Solutions

### Issue: AI doesn't return team recommendation
**Solutions:**
1. Ask more specifically: "Please recommend a team with their ID"
2. Provide more context about the project
3. Check that candidateTeams are being sent in missionContext
4. Check Cloudflare Worker logs for AI errors

### Issue: Assign button is disabled
**Check:**
1. Look for warning: "Team ID missing"
2. Console log shows recommendation but no teamId
3. Ask AI again with more explicit request

### Issue: Assignment view shows "not found"
**Solutions:**
1. Check backend logs for assignment creation
2. Check if assignmentId in URL is correct
3. Try refreshing page (will load from Firestore)
4. Check Firestore for assignment document

### Issue: No tasks generated
**Check:**
1. Project has `estimatedHours` or `estimated_hours`
2. Project has `required_skills` or `skillsRequired`
3. Team has at least one member
4. Backend logs for task generation

### Issue: Developer doesn't see tasks
**Check:**
1. Developer logged in with correct email
2. Developer document exists in Firestore
3. Developer's `primaryTeamId` matches assignment's `teamId`
4. Tasks have `assignedTo` or `assignedToId` matching developer `id`
5. Browser console for filtering logic
6. Assignment is finalized (not still in draft)

### Issue: Finalization fails
**Check:**
1. Backend logs for specific error
2. Firestore write permissions
3. All required task fields are present
4. Network connectivity to backend

## Performance Checks

### Expected Response Times
- AI recommendation: 2-5 seconds
- Assignment creation: < 1 second
- Assignment view load: < 500ms (sessionStorage) or 1-2 seconds (Firestore)
- Finalization: 1-2 seconds
- Developer hub load: 1-2 seconds

### Data Consistency
After finalization, verify within 3 seconds:
- ✅ Assignment document exists in Firestore
- ✅ Bounty documents created
- ✅ Project status updated to "in-progress"
- ✅ Team workload incremented
- ✅ Developer can see tasks immediately (after page refresh)

## Browser Console Debugging

### Useful Console Logs
Look for these messages:
- `AI Response:` - Shows full AI response
- `Recommendation:` - Shows parsed recommendation object
- `Assignment error:` - Shows assignment failures
- `Failed to load assignment:` - Data loading issues

### Check Network Tab
1. Open DevTools > Network
2. Filter by "Fetch/XHR"
3. Check these requests:
   - POST to `/assign_project` - Should return 200 with assignmentId
   - POST to `/finalize_assignment` - Should return 200 with success
   - Firestore reads - Should fetch assignments and bounties

## Test Data Requirements

### Minimum Firebase Data Needed
1. **At least one team** with:
   - id, name, skills
   - 2-3 team members

2. **At least 2-3 developers** with:
   - id, email, displayName, skills
   - primaryTeamId matching a team
   - email matching a user account

3. **At least one project** with:
   - id, title, description
   - estimatedHours (e.g., 40)
   - skillsRequired (e.g., ["frontend", "backend"])
   - status: "open"

4. **Manager account** with:
   - email, displayName
   - roles: ["manager"]

## Success Criteria

Your implementation is working correctly when:
- ✅ AI provides team recommendations with valid teamId
- ✅ "Assign Team" button appears and is clickable
- ✅ Clicking button navigates to assignment view
- ✅ Assignment view loads with team and task data
- ✅ Tasks can be edited without errors
- ✅ Finalization completes successfully
- ✅ Developer sees assigned tasks in hub
- ✅ Firestore contains all expected documents
- ✅ No console errors throughout flow

## Quick Verification Script

Run this in browser console on Developer Hub:
```javascript
// Check if developer has any assignments
const assignments = window.__REACT_QUERY_STATE__?.queries
  ?.find(q => q.queryKey?.includes('assignments'))
  ?.state?.data;

console.log('Total assignments:', assignments?.length);
console.log('Assignments:', assignments);

// Check developer profile
const developers = window.__REACT_QUERY_STATE__?.queries
  ?.find(q => q.queryKey?.includes('developers'))
  ?.state?.data;

const userEmail = '[your-email]';  // Replace with logged-in email
const myProfile = developers?.find(d => d.email.toLowerCase() === userEmail.toLowerCase());

console.log('My profile:', myProfile);
console.log('My team:', myProfile?.primaryTeamId);

// Check my tasks
if (myProfile && assignments) {
  const myTasks = [];
  assignments.forEach(a => {
    (a.tasks || []).forEach(t => {
      if (t.assignedTo === myProfile.id || t.assignedToId === myProfile.id) {
        myTasks.push(t);
      }
    });
  });
  console.log('My tasks:', myTasks);
}
```

## End-to-End Test Checklist

- [ ] Backend is running and accessible
- [ ] Frontend is running and accessible
- [ ] Can login as manager
- [ ] Can navigate to AI Copilot
- [ ] AI returns team recommendation
- [ ] "Assign Team" button appears and works
- [ ] Assignment view loads successfully
- [ ] Can edit task details
- [ ] Can convert task types
- [ ] Can add new tasks
- [ ] Can finalize assignment
- [ ] Can logout and login as developer
- [ ] Developer sees assigned tasks
- [ ] Task details are correct
- [ ] Firestore contains all expected data
- [ ] No errors in console throughout

## Support

If you encounter issues not covered here:
1. Check browser console for errors
2. Check backend logs for errors
3. Check Firestore console for data
4. Review `IMPLEMENTATION_SUMMARY.md` for architecture
5. Check network requests in DevTools

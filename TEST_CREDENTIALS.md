# 🔐 Test Account Credentials - BountyAI

## All Developer Test Accounts

**Universal Password:** `test123`

All developer accounts use the same password for easy testing.

---

## 👨‍💻 Developer Accounts

### 1. Alex Chen (Senior Developer)
- **Email:** `alex@bounty.com`
- **Password:** `test123`
- **UID:** `O6EUg6rUTEaRUweGhnpcq6vNSao2`
- **Team:** Delta Force (team_delta) - Full-stack team
- **Skills:** Python, React, TypeScript, API Design
- **Level:** Senior
- **Availability:** Full-time

### 2. Jordan Smith (Mid-Level Developer)
- **Email:** `jordan@bounty.com`
- **Password:** `test123`
- **UID:** `TBroFOk1cgakhpeUOmQSS6i35C23`
- **Team:** Beta Crew (team_beta) - Backend specialists
- **Skills:** JavaScript, Node.js, MongoDB, Express
- **Level:** Mid-Level
- **Availability:** Full-time

### 3. Taylor Johnson (Mid-Level Developer)
- **Email:** `taylor@bounty.com`
- **Password:** `test123`
- **UID:** `w3W7Pc1NoqZAzKT5dEqNOYVzpHy2`
- **Team:** Alpha Pilots (team_alpha) - Frontend experts
- **Skills:** React, Vue.js, CSS, UI/UX
- **Level:** Mid-Level
- **Availability:** Part-time

### 4. Morgan Lee (Senior Developer)
- **Email:** `morgan@bounty.com`
- **Password:** `test123`
- **UID:** `fJSELJvILuPyNxnglihmaXBzmDc2`
- **Team:** Beta Crew (team_beta) - Backend specialists
- **Skills:** Python, FastAPI, PostgreSQL, Docker
- **Level:** Senior
- **Availability:** Full-time

### 5. Riley Brown (Senior Developer)
- **Email:** `riley@bounty.com`
- **Password:** `test123`
- **UID:** `oSPHlCHUXETa8SdDAbfnF4gsW8q1`
- **Team:** Gamma Squadron (team_gamma) - DevOps experts
- **Skills:** Java, Spring Boot, Microservices, Kubernetes
- **Level:** Senior
- **Availability:** Full-time

### 6. Casey Davis (Mid-Level Developer)
- **Email:** `casey@bounty.com`
- **Password:** `test123`
- **UID:** `7FhLu44IkAO2XBajDGndW89YQkA2`
- **Team:** Alpha Pilots (team_alpha) - Frontend experts
- **Skills:** React, TypeScript, GraphQL, Testing
- **Level:** Mid-Level
- **Availability:** Full-time

---

## 📊 Quick Reference Table

| # | Name | Email | Password | Team | Level | Primary Skills |
|---|------|-------|----------|------|-------|----------------|
| 1 | Alex Chen | alex@bounty.com | test123 | Delta Force | Senior | Python, React, TypeScript |
| 2 | Jordan Smith | jordan@bounty.com | test123 | Beta Crew | Mid-Level | JavaScript, Node.js, MongoDB |
| 3 | Taylor Johnson | taylor@bounty.com | test123 | Alpha Pilots | Mid-Level | React, Vue.js, UI/UX |
| 4 | Morgan Lee | morgan@bounty.com | test123 | Beta Crew | Senior | Python, FastAPI, Docker |
| 5 | Riley Brown | riley@bounty.com | test123 | Gamma Squadron | Senior | Java, Spring Boot, K8s |
| 6 | Casey Davis | casey@bounty.com | test123 | Alpha Pilots | Mid-Level | React, TypeScript, GraphQL |

---

## 🏆 Team Distribution

### Team Alpha Pilots (Frontend Specialists)
- **Taylor Johnson** - React, Vue.js, CSS, UI/UX
- **Casey Davis** - React, TypeScript, GraphQL, Testing

### Team Beta Crew (Backend Specialists)
- **Jordan Smith** - JavaScript, Node.js, MongoDB, Express
- **Morgan Lee** - Python, FastAPI, PostgreSQL, Docker

### Team Gamma Squadron (DevOps Experts)
- **Riley Brown** - Java, Spring Boot, Microservices, Kubernetes

### Team Delta Force (Full-Stack Team)
- **Alex Chen** - Python, React, TypeScript, API Design

---

## 🧪 Testing Scenarios

### Scenario 1: Task Assignment Testing
1. Login as **Manager** (e.g., bob@example.com)
2. Create a mission in AI Copilot
3. Assign tasks to different developers:
   - **Alex** or **Morgan** for backend tasks (Python, APIs)
   - **Taylor** or **Casey** for frontend tasks (React, UI)
   - **Jordan** for full-stack tasks (Node.js, Express)
   - **Riley** for infrastructure tasks (Docker, Kubernetes)

### Scenario 2: Bounty Claiming Testing
1. Login as any developer (e.g., alex@bounty.com)
2. Go to Developer Dashboard
3. View "Available Bounties" section
4. Click "Claim" on a bounty matching your skills
5. Complete the bounty to earn points

### Scenario 3: Multi-Developer Workflow
1. **Manager:** Create mission with 6 tasks
2. **Manager:** Assign one task to each developer
3. **Manager:** Finalize assignment
4. Login as each developer to verify they see their assigned task

### Scenario 4: Points Competition
1. Have multiple developers claim and complete bounties
2. Check Developer Dashboard to see accumulated points
3. Compare points earned across developers

---

## 🔄 Regenerating Accounts

If you need to regenerate all test accounts, run:

```bash
cd /Users/luispenson/Desktop/BountyAi/backend
source venv/bin/activate
python3 seed_test_developers.py
```

The script will:
- ✅ Check if accounts already exist (won't create duplicates)
- ✅ Create missing accounts with Firebase Auth
- ✅ Create Firestore developer documents
- ✅ Display summary of all accounts

---

## 📝 Notes

- All accounts are verified in Firebase Auth
- All accounts have corresponding Firestore documents
- Accounts are in the `tenants/default/developers` collection
- Password is intentionally simple for easy testing
- All accounts have `emailVerified: true`

---

## 🚨 Security Warning

**DO NOT USE THESE CREDENTIALS IN PRODUCTION!**

These are test accounts with weak passwords designed for development and testing only. In production:
- Use strong, unique passwords
- Implement proper password policies
- Enable multi-factor authentication
- Use environment-specific credentials
- Never commit credentials to version control

---

**Last Updated:** October 26, 2025  
**Script Location:** `/backend/seed_test_developers.py`  
**Firebase Project:** bountyai-4770b

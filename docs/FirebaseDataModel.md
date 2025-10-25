# Firebase Data Model Blueprint

> Reference guide for implementing the BountyAI Firestore structure and related Firebase services. Aligns with the Space Cowboy productivity analytics roadmap.

> The backend expects a tenant document under `tenants/{tenantId}`. By default this is `tenants/default`, configurable via the `FIREBASE_DEFAULT_TENANT_ID` environment variable.

## Core Collections

### `tenants`
Parent document for each organization.

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Display name shown in the UI |
| `slug` | string | Lowercase unique identifier |
| `createdAt` | timestamp | When the tenant was created |
| `ownerUid` | string | Firebase Auth UID of the tenant owner/manager |
| `plan` | string | e.g. `trial`, `pro`, `enterprise` |
| `features` | map | Feature flags (manager analytics, AI suggestions, etc.) |

#### Sub-collection: `teams`

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Team name |
| `description` | string | Optional overview |
| `skills` | array<string> | Canonical skill names |
| `productivityScore` | number | Rolling average 0-1 |
| `currentWorkload` | number | Active bounty count |
| `maxCapacity` | number | Maximum concurrent bounties |
| `leadUid` | string | Manager or team lead UID |
| `active` | boolean | Soft delete flag |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

#### Sub-collection: `developers`

| Field | Type | Notes |
| --- | --- | --- |
| `displayName` | string | Preferred name |
| `email` | string | Unique email, used for Auth lookup |
| `photoURL` | string | Avatar |
| `roles` | array<string> | e.g. `["developer"]` |
| `skills` | array<string> | Normalized skill tags |
| `primaryTeamId` | string | Team document ID |
| `timezone` | string | IANA timezone |
| `availability` | map | `{ hoursPerWeek, updatedAt }` |
| `activeAssignmentCount` | number | Denormalized counter |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `projects`
Stored under `tenants/{tenantId}/projects`.

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Project display name |
| `description` | string | Markdown supported |
| `difficulty` | string | `easy`, `medium`, `hard`, `legendary` |
| `status` | string | `draft`, `open`, `assigned`, `in-progress`, `completed`, `archived` |
| `skillsRequired` | array<string> | Normalized skills |
| `estimatedHours` | number | Estimate for throughput calculations |
| `reward` | number | Credits or currency |
| `deadline` | timestamp | Due date |
| `createdBy` | string | Manager UID |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

#### Sub-collection: `assignments`

Tracks project-to-team matches and developer roster.

| Field | Type | Notes |
| --- | --- | --- |
| `teamId` | string | Reference to `teams` document |
| `developerIds` | array<string> | UIDs of participating developers |
| `startDate` | timestamp | |
| `dueDate` | timestamp | |
| `status` | string | `proposed`, `accepted`, `in-progress`, `blocked`, `completed` |
| `fitScore` | number | Score from ML model |
| `reasoning` | string | Explanation for assignment |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `productivitySnapshots`
`tenants/{tenantId}/productivitySnapshots/{snapshotId}`

| Field | Type | Notes |
| --- | --- | --- |
| `range` | map | `{ start: timestamp, end: timestamp }` |
| `metrics` | map | `{ averageVelocity, throughput, blockersCount, sentimentScore }` |
| `teamId` | string | Optional: focus on one team |
| `generatedBy` | string | `system`, `manager`, etc. |
| `createdAt` | timestamp | |

### `invites`
`tenants/{tenantId}/invites`

| Field | Type | Notes |
| --- | --- | --- |
| `email` | string | Invite target |
| `role` | string | `manager` or `developer` |
| `teamId` | string | Optional team assignment |
| `token` | string | Secure random string |
| `expiresAt` | timestamp | Expiration |
| `status` | string | `pending`, `accepted`, `expired`, `revoked` |
| `createdAt` | timestamp | |
| `createdBy` | string | Manager UID |

### `skillsCatalog`
Global collection `skillsCatalog` to normalize tag definitions.

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Display label |
| `slug` | string | Lowercase identifier |
| `category` | string | `frontend`, `backend`, `ops`, `ml`, etc. |
| `description` | string | Optional detail |
| `popularity` | number | Usage count |
| `createdAt` | timestamp | |

## Audit & Logging

### `activityLog`
`tenants/{tenantId}/activityLog`

| Field | Type | Notes |
| --- | --- | --- |
| `actorUid` | string | User performing the action |
| `action` | string | e.g. `assignment.created` |
| `target` | map | `{ type: 'project', id: 'projectId' }` |
| `metadata` | map | Additional context |
| `timestamp` | timestamp | |

### `feedback`
`tenants/{tenantId}/feedback`

| Field | Type | Notes |
| --- | --- | --- |
| `assignmentId` | string | Reference to assignment |
| `submittedBy` | string | UID |
| `sentiment` | string | `positive`, `neutral`, `negative` |
| `comments` | string | Free-form feedback |
| `score` | number | 1-5 rating |
| `createdAt` | timestamp | |

## Security Considerations

- **Authentication**: Firebase Auth with custom claims for `manager` vs `developer` roles.
- **Firestore Rules**:
  - Managers can read/write within their tenant.
  - Developers have read access to team/assignment data scoped to their team IDs.
  - Use security rules to enforce tenant isolation (`request.auth.token.tenantId`).
- **Service Accounts**: Backend uses Firebase Admin SDK with service account stored in environment variables.

## Index Recommendations

- `projects` collection composite index on `(status asc, deadline desc)` for dashboard queries.
- `assignments` collection composite index on `(teamId asc, status asc, updatedAt desc)`.
- `productivitySnapshots` single-field index on `range.start`.

## Integration Notes

- **Backend (FastAPI)** will use the Admin SDK (`backend/firebase_client.py`) to read/write documents server-side and run privileged operations.
- **Frontend** uses modular Firebase SDK (`src/lib/firebase.ts`) for client interactions. TanStack Query is recommended to wrap Firestore listeners/queries.
- **Emulator Support** is available by setting `VITE_FIREBASE_USE_EMULATOR=true` and `FIRESTORE_EMULATOR_HOST` on the backend.

---

For migration planning or schema evolution, append changelog entries here as collections go live.

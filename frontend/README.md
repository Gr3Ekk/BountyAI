# 🌌 BountyAI Frontend

React 19 + TypeScript + Vite single-page application that powers the Space Cowboy automation experience. The frontend consumes the FastAPI backend, visualizes productivity analytics, and now connects directly to Firebase for real-time collaboration.

## 🚀 Tech Stack

- React 19 with functional components and hooks
- Vite 7 build tooling
- TypeScript strict mode
- Tailwind CSS + custom glassmorphism theme
- TanStack Query for data fetching
- Firebase SDK v11 (Auth, Firestore, Analytics)
- Chart.js, anime.js, and Three.js/Vanta visual effects

## ⚙️ Prerequisites

- Node.js 20+
- npm 10+
- Firebase CLI (`npm install -g firebase-tools`) for managing projects and emulators

## 🔑 Environment Configuration

1. Copy the example environment file and fill in your Firebase project settings:

```bash
cp .env.example .env
```

2. Populate the values with the credentials from your Firebase project settings → **Project Settings → General → Your apps → Web app**.

| Variable | Description |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Authentication domain (e.g. `bountyai.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket URL |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `VITE_FIREBASE_APP_ID` | Web app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | (Optional) Analytics ID |
| `VITE_FIREBASE_DEFAULT_TENANT_ID` | (Optional) Tenant namespace for Firestore collections (defaults to `default`) |
| `VITE_CLOUDFLARE_WORKER_URL` | (Optional) Cloudflare Worker endpoint that proxies Workers AI |
| `VITE_CLOUDFLARE_WORKER_TOKEN` | (Optional) Bearer token forwarded with copilot requests |
| `VITE_API_BASE_URL` | (Optional) FastAPI backend base URL (defaults to `http://localhost:8000`) |

3. (Optional) Enable local emulators for offline development by setting:

```
VITE_FIREBASE_USE_EMULATOR=true
VITE_FIRESTORE_EMULATOR_HOST=localhost:8080
VITE_FIREBASE_AUTH_EMULATOR_HOST=http://localhost:9099
```

4. (Optional) Wire up the **AI Launch Copilot** to Cloudflare Workers AI:

	- Deploy a Worker that forwards requests to your chosen Workers AI model.
	- Set `VITE_CLOUDFLARE_WORKER_URL` to the Worker endpoint (e.g. `https://your-worker.workers.dev/chat`).
	- If the Worker expects a bearer token, add it to `VITE_CLOUDFLARE_WORKER_TOKEN`.
	- Leaving both values blank enables the built-in simulator so the UI still functions during local development.

## 📦 Installation

```bash
npm install
```

## 🧪 Development

```bash
npm run dev
```

The app will be available at http://localhost:5173. The development build automatically picks up your Firebase configuration via Vite environment variables.

## 🏗️ Production Build

```bash
npm run build
```

Outputs optimized assets to `dist/`.

## 🔥 Firebase CLI Quick Start

1. Authenticate (runs a browser login):

```bash
firebase login
```

2. Initialize config files in the project root (choose Firestore, Functions if needed):

```bash
firebase init
```

3. Select your default project when prompted. The CLI will create `.firebaserc` and `firebase.json`. Both files are already ignored by `.gitignore`.

4. To work with local emulators:

```bash
firebase emulators:start --only firestore,auth
```

## 🧱 Project Structure (Frontend)

```
src/
├── App.tsx                 # Route definitions and global shell
├── main.tsx                # Vite entry point
├── components/             # UI building blocks
├── context/AuthContext.tsx # Authentication state provider
├── lib/firebase.ts         # Firebase initialization and helpers
├── pages/                  # Manager & Developer dashboards, Auth screens
└── assets/                 # Logos and imagery
```

## ✅ Linting & Type Checking

```bash
npm run lint
```

## 🤝 Firebase Usage Guidelines

- Never commit `.env` files or service account credentials.
- Firebase config values are public-safe, but API keys should still be scoped via security rules.
- Use Firebase Authentication to manage users; Firestore security rules should enforce role-based access for managers vs developers.

## 📚 Additional Resources

- [Firebase Console](https://console.firebase.google.com/)
- [Firestore Data Model Blueprint](../docs/FirebaseDataModel.md) *(coming soon)*
- [Backend README](../backend/README.md)

---

**Need help?** Ping the backend docs for service account setup and the root README for end-to-end project instructions.

# 🚀 Firebase Deployment Guide for BountyAI

## Prerequisites

1. ✅ Firebase CLI installed (already done)
2. ⬜ Google Cloud SDK installed
3. ⬜ Firebase project selected
4. ⬜ Firebase Hosting enabled
5. ⬜ Cloud Run API enabled

---

## Step-by-Step Deployment

### 1️⃣ Install Google Cloud SDK (if not installed)

```bash
# macOS
brew install --cask google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

### 2️⃣ Login to Firebase and Google Cloud

```bash
# Login to Firebase
firebase login

# Login to Google Cloud
gcloud auth login

# Set your project
firebase use --add
# Select your Firebase project from the list

# Verify
firebase projects:list
```

### 3️⃣ Enable Required APIs

```bash
# Get your project ID
PROJECT_ID=$(firebase use | grep "active" | awk '{print $4}' | tr -d '()')

# Enable Cloud Run API
gcloud services enable run.googleapis.com --project=$PROJECT_ID

# Enable Container Registry API
gcloud services enable containerregistry.googleapis.com --project=$PROJECT_ID

# Enable Cloud Build API
gcloud services enable cloudbuild.googleapis.com --project=$PROJECT_ID
```

### 4️⃣ Deploy Everything

```bash
# From the project root directory
./deploy.sh
```

Or manually:

```bash
# Build frontend
cd frontend
npm run build
cd ..

# Deploy frontend to Firebase Hosting
firebase deploy --only hosting

# Deploy backend to Cloud Run
cd backend
gcloud run deploy bountyai-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

cd ..
```

### 5️⃣ Configure Environment Variables

After deployment, you'll get URLs for both services:
- Frontend: `https://YOUR-PROJECT-ID.web.app`
- Backend: `https://bountyai-backend-xxxxx-uc.a.run.app`

**Update Frontend to use Backend URL:**

Create `frontend/.env.production`:
```bash
VITE_API_URL=https://bountyai-backend-xxxxx-uc.a.run.app
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

Then rebuild and redeploy frontend:
```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

### 6️⃣ Configure Backend Environment Variables (if needed)

If your backend needs environment variables (like Firebase credentials):

```bash
gcloud run services update bountyai-backend \
  --region us-central1 \
  --set-env-vars="FIREBASE_PROJECT_ID=your-project-id,OTHER_VAR=value"
```

Or create a `.env.yaml` file and use:
```bash
gcloud run services update bountyai-backend \
  --region us-central1 \
  --env-vars-file=.env.yaml
```

---

## Quick Commands

### Deploy Only Frontend
```bash
cd frontend && npm run build && cd .. && firebase deploy --only hosting
```

### Deploy Only Backend
```bash
cd backend && gcloud run deploy bountyai-backend --source . --region us-central1 && cd ..
```

### View Logs
```bash
# Frontend logs (in Firebase Console)
firebase hosting:channel:list

# Backend logs
gcloud run services logs read bountyai-backend --region us-central1
```

### Check Deployment Status
```bash
# Frontend
firebase hosting:sites:list

# Backend
gcloud run services describe bountyai-backend --region us-central1
```

---

## Costs (All FREE Tier Eligible)

### Firebase Hosting - FREE
- 10 GB storage
- 360 MB/day downloads
- Custom domain support

### Cloud Run - FREE Tier
- 2 million requests/month
- 360,000 GB-seconds memory/month
- 180,000 vCPU-seconds/month
- No cold start charges

### Firestore - FREE Tier
- 1 GB storage
- 50,000 reads/day
- 20,000 writes/day
- 20,000 deletes/day

---

## Troubleshooting

### "Permission denied" error
```bash
# Make sure you're logged in
firebase login --reauth
gcloud auth login
```

### "API not enabled" error
```bash
# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### Backend not responding
```bash
# Check logs
gcloud run services logs read bountyai-backend --region us-central1 --limit 50
```

### CORS issues
Update your backend's CORS configuration in `main.py` to include your Firebase Hosting URL.

---

## Production Checklist

- [ ] Firebase project created and selected
- [ ] Google Cloud SDK installed and authenticated
- [ ] Cloud Run API enabled
- [ ] Frontend built successfully
- [ ] Backend deployed to Cloud Run
- [ ] Frontend deployed to Firebase Hosting
- [ ] Environment variables configured
- [ ] CORS configured for production URLs
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active (automatic with Firebase)
- [ ] Monitoring and alerts set up (optional)

---

## Support

If you encounter issues:
1. Check Firebase Console: https://console.firebase.google.com
2. Check Cloud Run Console: https://console.cloud.google.com/run
3. View logs with commands above
4. Consult Firebase docs: https://firebase.google.com/docs/hosting
5. Consult Cloud Run docs: https://cloud.google.com/run/docs

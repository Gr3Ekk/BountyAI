# 🚀 Quick Firebase Deployment

## TL;DR - Deploy in 3 Steps

### 1. Install Google Cloud SDK
```bash
brew install --cask google-cloud-sdk
```

### 2. Run Setup Script
```bash
./setup-firebase.sh
```
This will:
- Login to Firebase & Google Cloud
- Select your Firebase project
- Enable required APIs
- Create environment file template

### 3. Deploy
```bash
./deploy.sh
```

That's it! Your app will be live at:
- **Frontend:** `https://YOUR-PROJECT-ID.web.app`
- **Backend:** `https://bountyai-backend-xxxxx-uc.a.run.app`

---

## What Gets Deployed?

### Frontend → Firebase Hosting (FREE)
- Static React app
- Global CDN
- Automatic HTTPS
- Custom domains supported

### Backend → Google Cloud Run (FREE tier)
- FastAPI Python server
- Automatic scaling
- 2M requests/month free
- Only pays when running

### Database → Firestore (Already using it!)
- 1GB storage free
- 50K reads/day free

---

## Cost: $0/month for typical usage

Both services have generous free tiers that should cover development and small production loads.

---

## Manual Deployment

### Deploy Frontend Only
```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

### Deploy Backend Only
```bash
cd backend
gcloud run deploy bountyai-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
cd ..
```

---

## Configuration

### Frontend Environment (`frontend/.env.production`)
```bash
VITE_API_URL=https://your-backend-url.run.app
VITE_FIREBASE_API_KEY=your-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

Get these values from [Firebase Console](https://console.firebase.google.com) → Project Settings → General

---

## Files Created

- ✅ `firebase.json` - Firebase Hosting configuration
- ✅ `.firebaserc` - Firebase project selection
- ✅ `backend/Dockerfile` - Container configuration for Cloud Run
- ✅ `backend/.dockerignore` - Files to exclude from container
- ✅ `setup-firebase.sh` - Automated setup script
- ✅ `deploy.sh` - Automated deployment script
- ✅ `DEPLOYMENT_GUIDE.md` - Detailed deployment documentation

---

## Troubleshooting

### "gcloud: command not found"
```bash
brew install --cask google-cloud-sdk
```

### "Permission denied"
```bash
firebase login --reauth
gcloud auth login
```

### "API not enabled"
```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### Backend errors
```bash
# Check logs
gcloud run services logs read bountyai-backend --region us-central1
```

---

## Next Steps After Deployment

1. ✅ Test your app at the deployed URLs
2. 🔒 Configure custom domain (optional)
3. 📊 Set up monitoring in Firebase Console
4. 🔔 Configure alerts for errors
5. 💰 Set up billing alerts (stays free for typical usage)

---

## Support Links

- [Firebase Console](https://console.firebase.google.com)
- [Cloud Run Console](https://console.cloud.google.com/run)
- [Firebase Docs](https://firebase.google.com/docs/hosting)
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Detailed Guide](./DEPLOYMENT_GUIDE.md)

---

## Questions?

Check `DEPLOYMENT_GUIDE.md` for detailed instructions and troubleshooting.

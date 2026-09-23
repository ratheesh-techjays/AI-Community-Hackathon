# PRAHARI deployment: Cloud Run (API) + Firebase Hosting (web, same origin).
#
# NOT RUN AUTOMATICALLY. Deploying needs billing enabled on the project and
# costs money; run it yourself after approving that.
#
# Every command pins --project prahari-24399. It never changes the gcloud
# default project.
#
# Prerequisites (one time):
#   gcloud services enable run.googleapis.com cloudbuild.googleapis.com `
#       artifactregistry.googleapis.com secretmanager.googleapis.com --project prahari-24399
#   printf "<gemini key>" | gcloud secrets create gemini-key --data-file=- --project prahari-24399
#   printf "<write key>"  | gcloud secrets create prahari-api-key --data-file=- --project prahari-24399
#   A service account with roles/earthengine.viewer and roles/serviceusage.serviceUsageConsumer,
#   registered for Earth Engine (see README "Earth Engine").
#   npm install -g firebase-tools; firebase login; firebase projects:addfirebase prahari-24399

$ErrorActionPreference = "Stop"
$Project = "prahari-24399"
$Region = "asia-south1"
$ServiceAccount = "prahari-ee@$Project.iam.gserviceaccount.com"

# 1. API on Cloud Run. The image carries data/ (shelter register, IBTrACS if
#    present, precomputed runs), so the demo runs are cache hits with no Earth
#    Engine or Gemini call in the request path.
#    --max-instances 1: the run store and the rate limits live on the instance,
#    so one instance keeps polling consistent (TODO: GCS run store to scale).
#    --no-cpu-throttling: an on-demand run computes in a background thread
#    after the 202 response and must keep its CPU.
#    Writes (POST/DELETE /scenarios) need PRAHARI_API_KEY; the public web app
#    ships no key, so on-demand compute is operator-only. /query is public and
#    rate-limited.
gcloud run deploy prahari-api `
  --project $Project --region $Region `
  --source . `
  --service-account $ServiceAccount `
  --set-env-vars "PRAHARI_ENV=prod,GEE_PROJECT=$Project,PRAHARI_REPO_ROOT=/app" `
  --set-secrets "GEMINI_API_KEY=gemini-key:latest,PRAHARI_API_KEY=prahari-api-key:latest" `
  --concurrency 40 --min-instances 1 --max-instances 1 --no-cpu-throttling `
  --cpu 2 --memory 2Gi --timeout 600 `
  --allow-unauthenticated

# 2. Web on Firebase Hosting; firebase.json rewrites /api/** to the service
#    above, so the browser sees one origin and the API needs no CORS.
Push-Location web
npm ci
npm run build
Pop-Location
firebase deploy --only hosting --project $Project

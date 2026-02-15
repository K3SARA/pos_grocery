# Deploy As New Repo + New Railway Project (Safe Isolation)

This creates a separate deployment so your current hosted apps are untouched.

## 1) Create a new GitHub repo

Create a new empty repo, for example: `pos-grocery-new`.

## 2) Copy current project into a new folder and push to new repo

Run these commands in PowerShell:

```powershell
cd d:\
git clone d:\POS POS_NEW_RAILWAY
cd POS_NEW_RAILWAY
git remote remove origin
git remote add origin https://github.com/<your-user>/<your-new-repo>.git
git push -u origin main
```

This keeps your current `d:\POS` repo and remotes unchanged.

## 3) Railway backend service (new project)

1. In Railway, create a brand new project.
2. Add a service from your new GitHub repo.
3. Set service root directory to `backend`.
4. Railway will use `backend/railway.json` automatically.
5. Set environment variables:
   - `JWT_SECRET`: use a brand new secret value.
   - `DATABASE_URL`: use a separate database for this new project.

SQLite option (quick start):
- Add a Railway volume mounted at `/data`.
- Set `DATABASE_URL=file:/data/pos.db`.

Notes:
- Backend start command already runs `prisma db push` on startup.
- Use a separate DB from your existing deployment to avoid cross-impact.

## 4) Railway frontend service (new project)

1. In the same new Railway project, add another service from the same repo.
2. Set service root directory to `frontend`.
3. Railway will use `frontend/railway.json`.
4. Set environment variable:
   - `REACT_APP_API_URL=https://<your-new-backend-domain>`

## 5) Verify isolation

Check these are different from your existing hosted app:
- Railway project name
- Backend public domain
- Frontend public domain
- Backend `JWT_SECRET`
- Backend `DATABASE_URL`
- Frontend `REACT_APP_API_URL`

If all are separate, your old hosted app will not be affected.

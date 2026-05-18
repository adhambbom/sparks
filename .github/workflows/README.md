# GitHub Actions — EAS Build Setup

This directory contains the workflow that builds the Android AAB (and iOS
IPA if you opt-in) on Expo's cloud infrastructure, with **zero local
machine required**.

## One-time setup (3 minutes)

### 1. Create an Expo access token
1. Go to https://expo.dev
2. Sign in (or sign up — free)
3. Top-right avatar → **Access Tokens**
4. **Create token** → name it `GH-Actions-Sparks` → scope: **Build**
5. Copy the token (it's only shown once)

### 2. Add the token to GitHub
1. In this GitHub repo, open **Settings** (top nav)
2. Left sidebar: **Secrets and variables → Actions**
3. **New repository secret**
4. Name: `EXPO_TOKEN`
5. Value: paste the token from step 1
6. **Add secret**

## How to trigger a build

### Option A — Manual one-click build (recommended for V1)
1. Go to the **Actions** tab in this repo
2. Left sidebar: select **EAS Build**
3. Top-right: **Run workflow**
4. Pick platform (`android`) and profile (`production`)
5. Click **Run workflow**
6. ⏱ Wait ~10–15 minutes
7. 📧 expo.dev emails you the install link — share it with friends!

### Option B — Auto-build on every push to main
The workflow is already configured to fire on every push to `main` that
touches `frontend/**`. Just commit and push.

## What this workflow does

1. Checks out the repo
2. Installs Node 20 + Yarn deps with cache
3. Sets up the EAS CLI + authenticates with your `EXPO_TOKEN`
4. Runs `expo-doctor` (warning-only — doesn't block)
5. **Audits** `app.json`, `eas.json`, and `.env.production` for any leaked
   `JWT_SECRET` / `ADMIN_PASSWORD` literals (FAILS the build if found)
6. Prints the resolved EAS profile so you can sanity-check the env vars
7. Triggers the build via `eas build --non-interactive --no-wait`
8. Posts a summary with the build link

## Where to find the install link

After the workflow completes:
- **Email** from expo.dev (subject: "Your Android build is ready")
- **Dashboard:** https://expo.dev/accounts/&lt;your-account&gt;/projects/synthetic-sparks/builds
- The build detail page has both:
  - 📦 **Download .aab** — for Play Store upload
  - 🔗 **Internal Distribution URL + QR code** — share with testers; they
    open it on Android and tap **Install** (no Play Store needed)

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Workflow fails at "Setup Expo + EAS CLI" | Check that `EXPO_TOKEN` is set correctly in repo secrets |
| Build fails: "Cannot find module 'expo-asset'" | Run `yarn install` locally and commit the updated `yarn.lock` |
| Build fails on keystore | First-time only — trigger one manual build via `eas build` locally to generate it, then GitHub Actions can reuse it |
| Build succeeds but app crashes on phone | Check the on-screen ErrorBoundary message (we wired this in) and report back |

## Cost

Expo's free tier includes **30 builds/month** — plenty for V1 launch + a
few patches. Builds beyond that are $1–$3 each depending on tier.

## Going to iOS later

When you're ready to add iOS:
1. Get an Apple Developer Program account ($99/year)
2. Update `eas.json` `submit.production.ios` placeholders
3. Manually trigger this workflow with `platform=ios`

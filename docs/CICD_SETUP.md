# CI/CD & Update System Documentation

## Overview

This document describes the complete CI/CD pipeline and in-app update mechanism for Dommuss Agenda mobile app.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GitHub Push    │────▶│  GitHub Actions  │────▶│  GitHub Release │
│  (main/tags)    │     │  (Build & Sign)  │     │  (APK Asset)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User Installs  │◀────│  App Downloads   │◀────│  Backend API    │
│  APK from URL   │     │  & Shows Prompt  │     │  /api/v1/app/   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## 1. GitHub Actions Workflow

### Trigger Conditions

The workflow (`.github/workflows/android-release.yml`) triggers on:

| Event | Description | Creates Release |
|-------|-------------|-----------------|
| `push to main` | Every commit to main branch | ✅ Yes (pre-release) |
| `tag push v*.*.*` | Semantic version tags | ✅ Yes (official release) |
| `pull_request to main` | PRs for testing | ❌ No (build only) |
| `workflow_dispatch` | Manual trigger | ✅ Yes (optional) |

### Workflow Jobs

1. **build**: Builds and signs APK
2. **release**: Creates GitHub Release and uploads APK
3. **test**: Runs tests on PRs

### Artifacts

| Artifact | Retention | Purpose |
|----------|-----------|---------|
| `app-release.apk` | 30 days | Signed APK for testing |
| `version-manifest.json` | 30 days | Version metadata |

---

## 2. GitHub Secrets Configuration

### Required Secrets

Navigate to: **Repository Settings → Secrets and variables → Actions**

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded keystore | `UEsDBBQAAAg...` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | `MyK3yst0r3!` |
| `ANDROID_KEY_ALIAS` | Key alias within keystore | `upload` |
| `ANDROID_KEY_PASSWORD` | Key password | `MyK3y!` |

### Optional Secrets

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `BACKEND_MANIFEST_URL` | Backend endpoint to update manifest | `https://api.example.com/api/v1/app/version/manifest` |
| `BACKEND_MANIFEST_KEY` | API key for manifest update | `Bearer token...` |

### Creating the Keystore

```bash
# Generate new keystore (for production)
keytool -genkey -v \
  -keystore dommuss-agenda.keystore \
  -alias upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Convert to base64 for GitHub Secrets
base64 -w 0 dommuss-agenda.keystore > keystore-base64.txt
# Copy contents of keystore-base64.txt to ANDROID_KEYSTORE_BASE64 secret
```

⚠️ **IMPORTANT**: Store your keystore securely! If lost, you cannot update the app on Google Play.

---

## 3. Backend API Endpoints

### GET `/api/v1/app/version`

Returns the latest version manifest.

**Response:**
```json
{
  "success": true,
  "data": {
    "latestVersion": "1.4.2",
    "versionCode": 10402,
    "mandatory": false,
    "minVersion": "1.0.0",
    "apkUrl": "https://github.com/ORG/REPO/releases/download/v1.4.2/app-release-signed.apk",
    "changelog": "Bug fixes and improvements",
    "publishedAt": "2026-03-04T12:00:00Z",
    "buildNumber": 142
  }
}
```

### GET `/api/v1/app/version/check?version=1.4.1`

Checks if update is available for specific version.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `version` | string | Yes | Current app version |

**Response:**
```json
{
  "success": true,
  "data": {
    "updateAvailable": true,
    "currentVersion": "1.4.1",
    "latestVersion": "1.4.2",
    "versionCode": 10402,
    "mandatory": false,
    "minVersionSupported": true,
    "apkUrl": "...",
    "changelog": "...",
    "publishedAt": "..."
  }
}
```

### POST `/api/v1/app/version/manifest`

Update version manifest (admin only, called by CI/CD).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "latestVersion": "1.4.2",
  "versionCode": 10402,
  "mandatory": false,
  "minVersion": "1.0.0",
  "apkUrl": "https://github.com/...",
  "changelog": "Bug fixes",
  "publishedAt": "2026-03-04T12:00:00Z",
  "buildNumber": 142
}
```

**Required Role:** ADMIN

---

## 4. Frontend Integration

### Installation

Ensure Capacitor plugins are installed:

```bash
npm install @capacitor/app @capacitor/browser @capacitor/device @capacitor/preferences
npx cap sync
```

### Usage

#### Option 1: Automatic Check on App Start

```typescript
// src/App.tsx
import { useEffect, useState } from 'react';
import { UpdateModal } from './components/UpdateModal';
import { checkForUpdates, type UpdateCheckResult } from './services/updateService';

function App() {
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    // Check for updates on app start
    const checkUpdates = async () => {
      const result = await checkForUpdates(false);
      if (result) {
        setUpdate(result);
        setShowUpdateModal(true);
      }
    };
    
    checkUpdates();
  }, []);

  return (
    <>
      {/* Your app content */}
      <UpdateModal
        isOpen={showUpdateModal}
        update={update}
        onClose={() => setShowUpdateModal(false)}
      />
    </>
  );
}
```

#### Option 2: Manual Check (Settings Menu)

```typescript
// src/components/Settings.tsx
import { checkForUpdates } from '../services/updateService';

async function handleCheckForUpdates() {
  const update = await checkForUpdates(true); // Force check
  if (update) {
    // Show update modal
  } else {
    alert('You have the latest version!');
  }
}
```

---

## 5. Version Bumping

### Using the Script

```bash
# Bump patch version (1.4.1 -> 1.4.2)
./scripts/bump-version.sh patch

# Bump minor version (1.4.1 -> 1.5.0)
./scripts/bump-version.sh minor

# Bump major version (1.4.1 -> 2.0.0)
./scripts/bump-version.sh major

# Set specific version
./scripts/bump-version.sh 2.1.0
```

### Manual Versioning

1. Update `package.json`:
   ```json
   {
     "version": "1.4.2"
   }
   ```

2. Update `android/app/build.gradle`:
   ```gradle
   android {
     defaultConfig {
       versionCode 10402
       versionName "1.4.2"
     }
   }
   ```

3. Create git tag:
   ```bash
   git add .
   git commit -m "chore: bump version to 1.4.2"
   git tag -a v1.4.2 -m "Release v1.4.2"
   git push origin main && git push origin v1.4.2
   ```

---

## 6. Testing Checklist

### Local Testing

- [ ] Run `npm run build` - should succeed
- [ ] Run `npx cap sync android` - should succeed
- [ ] Open Android Studio and build APK manually
- [ ] Install APK on test device

### CI/CD Testing

- [ ] Push test commit to main
- [ ] Verify GitHub Actions job starts
- [ ] Verify build job succeeds
- [ ] Verify APK is signed correctly
- [ ] Verify release is created
- [ ] Download APK from release
- [ ] Install on test device

### Update Flow Testing

- [ ] Install older version on device
- [ ] Open app - should detect new version
- [ ] Verify update modal appears
- [ ] Click "Actualizar ahora"
- [ ] Verify browser opens download URL
- [ ] Complete manual installation
- [ ] Verify app works after update
- [ ] Verify API connection still works

---

## 7. Production Deployment

### Pre-Release Checklist

- [ ] Keystore is backed up securely
- [ ] All GitHub secrets are configured
- [ ] Backend manifest endpoint is accessible
- [ ] Test on multiple Android versions (10, 11, 12, 13, 14)
- [ ] Test on different screen sizes
- [ ] Verify update flow works end-to-end

### Release Process

1. **Prepare Release**
   ```bash
   ./scripts/bump-version.sh minor  # or patch/major
   ```

2. **Push and Tag**
   ```bash
   git push origin main && git push origin v$(node -p "require('./package.json').version")
   ```

3. **Monitor Build**
   - Go to GitHub Actions tab
   - Watch build progress
   - Verify APK is signed and uploaded

4. **Verify Release**
   - Check GitHub Releases page
   - Download APK
   - Test installation

5. **Notify Users** (optional)
   - Send push notification
   - Email newsletter
   - In-app announcement

---

## 8. Troubleshooting

### Build Fails

**Error: Keystore not found**
```
Solution: Ensure ANDROID_KEYSTORE_BASE64 secret is set correctly
```

**Error: Signing failed**
```
Solution: Verify ANDROID_KEYSTORE_PASSWORD and ANDROID_KEY_PASSWORD match
```

**Error: Gradle build failed**
```
Solution: Check android/app/build.gradle syntax
```

### Update Not Detected

**Issue: App doesn't show update available**

Checklist:
- [ ] Backend `/api/v1/app/version` returns correct data
- [ ] `latestVersion` > current app version
- [ ] API_BASE_URL is correct in frontend
- [ ] Device has internet connection

### APK Installation Fails

**Error: App not installed**
```
Solution: Uninstall old version first, then install new APK
```

**Error: Parse error**
```
Solution: Ensure APK downloaded completely, try again
```

---

## 9. Security Considerations

### Keystore Security

- ✅ Store keystore in GitHub Secrets (base64)
- ✅ Never commit keystore to repository
- ✅ Use strong passwords (12+ chars, mixed case, numbers, symbols)
- ✅ Backup keystore to secure location (password manager, encrypted storage)

### API Security

- ✅ Backend manifest endpoint requires ADMIN role
- ✅ Use HTTPS for all API calls
- ✅ Validate version manifest schema with Zod
- ✅ Rate limit version check endpoint

### Update Security

- ✅ APK is signed with release keystore
- ✅ GitHub Releases provides integrity verification
- ✅ User must manually confirm installation
- ✅ Mandatory updates for critical security fixes

---

## 10. Future Enhancements

### Planned Features

- [ ] Staged rollouts (10% → 50% → 100%)
- [ ] A/B testing for update prompts
- [ ] Update analytics (adoption rate, time to update)
- [ ] Delta updates (download only changed files)
- [ ] Background download with notification
- [ ] Auto-install for mandatory updates

### Google Play Integration

If publishing to Google Play:

1. Use Play Console API for releases
2. Implement Play In-App Updates API
3. Configure staged rollouts
4. Track vitals and crashes

---

## Support

For issues or questions:
- Check GitHub Actions logs
- Review backend error logs
- Contact: support@dommuss.com

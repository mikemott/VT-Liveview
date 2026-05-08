# Phase 1 Security Setup - VT-LiveView

This document provides step-by-step instructions for enabling automated security scanning.

## Quick Start (10-15 minutes)

### 1. GitHub Native Security Features (Free)

**Enable in repository settings:**

1. Go to https://github.com/[your-username]/VT-LiveView/settings/security_analysis
2. Enable the following:
   - ✅ **Dependency graph** (should already be on)
   - ✅ **Dependabot alerts** - Get notified of vulnerable npm packages
   - ✅ **Dependabot security updates** - Auto-create PRs to fix vulnerabilities
   - ✅ **Secret scanning** - Detect committed secrets (tokens, keys, passwords)
   - ✅ **Push protection** - Block pushes containing secrets

3. Configure Dependabot:
   ```bash
   # Create .github/dependabot.yml
   cat > .github/dependabot.yml <<EOF
   version: 2
   updates:
     # Frontend dependencies
     - package-ecosystem: "npm"
       directory: "/"
       schedule:
         interval: "weekly"
       open-pull-requests-limit: 10
       groups:
         development-dependencies:
           dependency-type: "development"
           update-types:
             - "minor"
             - "patch"

     # Backend dependencies
     - package-ecosystem: "npm"
       directory: "/backend"
       schedule:
         interval: "weekly"
       open-pull-requests-limit: 10
       groups:
         development-dependencies:
           dependency-type: "development"
           update-types:
             - "minor"
             - "patch"
   EOF
   ```

### 2. CodeQL Code Scanning (Already Configured)

The `.github/workflows/security-scan.yml` workflow already includes CodeQL for JavaScript/TypeScript.

**What it does:**
- Scans JS/TS code for security vulnerabilities (XSS, SQL injection, etc.)
- Runs on every PR and push to `main`
- Weekly scheduled scans (Mondays at 9 AM)
- Results appear in Security → Code scanning alerts

**No action needed** - will start running automatically on next PR.

### 3. Snyk Setup (10 minutes, Free Tier)

Snyk excels at finding vulnerabilities in npm dependencies and is especially good with React.

**Steps:**

1. **Sign up for Snyk:**
   - Go to https://snyk.io/signup
   - Sign in with GitHub
   - Grant access to VT-LiveView repository

2. **Import project:**
   - Click "Add project" → "GitHub"
   - Select "VT-LiveView"
   - Snyk will auto-detect:
     - `package.json` (frontend)
     - `backend/package.json` (backend)
   - Import both

3. **Configure auto-fix PRs:**
   - Go to project settings
   - Enable "Automatic fix PRs"
   - Set frequency to "Weekly"
   - Enable "Automatic dependency upgrades"

4. **Get Snyk token (optional for PR checks):**
   - Go to https://app.snyk.io/account
   - Copy API token
   - Add to GitHub Secrets as `SNYK_TOKEN`
   - Uncomment Snyk job in security-scan.yml (if desired)

**What you get:**
- Vulnerability scanning for 45,000+ npm packages
- Auto-generated fix PRs
- License compliance checking
- Container scanning (if using Docker)

### 4. SonarCloud Setup (15 minutes)

SonarCloud provides deep code quality and security analysis.

**Steps:**

1. **Sign up for SonarCloud:**
   - Go to https://sonarcloud.io
   - Sign in with GitHub
   - Grant access to VT-LiveView repository

2. **Create organization:**
   - Click "+ Analyze new project"
   - Select "mikemott" (or your GitHub username) as organization
   - Import VT-LiveView repository

3. **Configure project:**
   - Project key: `vt-liveview`
   - Organization: `mikemott` (or your username)
   - Click "Set Up"

4. **Get SonarCloud token:**
   - Go to https://sonarcloud.io/account/security
   - Generate new token: "VT-LiveView Security Scanning"
   - Copy the token

5. **Add token to GitHub Secrets:**
   - Go to https://github.com/[username]/VT-LiveView/settings/secrets/actions
   - Click "New repository secret"
   - Name: `SONAR_TOKEN`
   - Value: [paste token from step 4]
   - Click "Add secret"

6. **Create sonar-project.properties:**
   ```bash
   # From VT-LiveView project root
   cat > sonar-project.properties <<EOF
   sonar.projectKey=vt-liveview
   sonar.organization=mikemott
   sonar.sources=src,backend/src
   sonar.tests=src/**/*.test.js,src/**/*.test.ts,backend/src/**/*.test.js
   sonar.javascript.lcov.reportPaths=coverage/lcov.info
   sonar.sourceEncoding=UTF-8
   sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**
   EOF
   ```

7. **Enable test coverage (optional):**
   ```bash
   # Update package.json to generate coverage
   npm install --save-dev @vitest/coverage-v8
   ```

   Update `vitest.config.ts`:
   ```typescript
   export default defineConfig({
     test: {
       coverage: {
         provider: 'v8',
         reporter: ['text', 'lcov'],
       },
     },
   });
   ```

**What you get:**
- Code smell detection
- Security hotspot identification
- SQL injection detection (critical for D1 queries)
- XSS vulnerability detection
- Code coverage tracking
- PR decoration with quality gate status

---

## Workflow Overview

After setup, here's what happens automatically:

### On Every Pull Request:
1. **CodeQL** scans JS/TS code for vulnerabilities
2. **NPM Audit** checks for vulnerable dependencies in frontend + backend
3. **Custom security checks:**
   - Hardcoded secrets scan
   - SQL injection pattern detection (D1 queries)
   - Environment variable leak detection
   - CORS configuration validation
4. **SonarCloud** provides quality gate status
5. **Snyk** (if configured) comments on dependency vulnerabilities
6. **Security report** summarizes findings

### Weekly (Mondays 9 AM):
1. **Full security scan** runs on main branch
2. **Dependabot** checks for new vulnerability disclosures
3. **Snyk** opens PRs for fixable vulnerabilities
4. **Results** posted to Security tab

### When Vulnerabilities Found:
1. **Dependabot/Snyk** opens PR with fix
2. **GitHub Security Alerts** notify repo admins
3. **PR checks fail** if high/critical issues in new code

---

## VT-LiveView Specific Security Considerations

### 1. Cloudflare D1 SQL Injection
The security workflow includes custom checks for SQL injection patterns in D1 queries.

**Safe:**
```javascript
// Parameterized query
const result = await env.DB.prepare(
  'SELECT * FROM users WHERE id = ?'
).bind(userId).all();
```

**Unsafe (will fail security check):**
```javascript
// String interpolation - DANGEROUS!
const result = await env.DB.prepare(
  `SELECT * FROM users WHERE id = ${userId}`
).all();
```

### 2. Environment Variable Security
The workflow checks for accidental logging of environment variables.

**Safe:**
```javascript
if (import.meta.env.DEV) {
  console.log('User ID:', userId); // OK - no env vars
}
```

**Unsafe (will fail security check):**
```javascript
console.log('Config:', process.env); // DANGEROUS - logs all secrets
```

### 3. CORS Configuration
The workflow validates that CORS is properly configured.

**Production-safe:**
```javascript
// backend/src/server.js
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
app.register(cors, {
  origin: (origin, cb) => {
    if (allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  }
});
```

**Development-only (workflow will warn):**
```javascript
app.register(cors, {
  origin: '*' // Allows all origins - OK for dev, not production
});
```

---

## Testing the Setup

### 1. Test CodeQL (Create test PR):
```bash
git checkout -b vtl-test-security
echo "// Test security scanning" >> src/App.jsx
git add . && git commit -m "test: verify security scanning"
git push -u origin vtl-test-security
gh pr create --title "test: verify security scanning" --body "Closes VT-LIVEVIEW-1\n\nTesting Phase 1 security automation"
```

Wait 3-5 minutes, then check:
- PR "Checks" tab shows "Security Scanning" workflow
- All jobs should pass (CodeQL, NPM Audit, Security Checks)

### 2. Test SQL Injection Detection:
```bash
# This should FAIL security check
echo 'const bad = `SELECT * FROM users WHERE id = ${userId}`;' >> backend/src/test.js
git add . && git commit -m "test: SQL injection detection"
git push
# Should fail "SQL Injection Check" job
```

### 3. Test Secret Scanning:
```bash
# This should be blocked by push protection
echo 'const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";' >> src/test.js
git add . && git commit -m "test: secret scanning"
git push
# Should see: "Push protection detected a secret"
```

### 4. Test Dependency Audit:
```bash
# Install a package with known vulnerability (example)
npm install --save lodash@4.17.0
git add . && git commit -m "test: dependency with vulnerability"
git push
# Should fail "NPM Dependency Audit" job
```

---

## Interpreting Results

### CodeQL Alerts:
- **Critical/High:** Block merge, fix immediately
- **Medium:** Review and fix or document why it's safe
- **Low:** Fix when convenient

### NPM Audit Alerts:
- **Critical:** Update immediately, may block deployment
- **High:** Update within 7 days
- **Moderate:** Update in next release
- **Low:** Fix when convenient

### SonarCloud Quality Gate:
- **Passed:** Safe to merge
- **Failed:** Review issues, fix security hotspots

### Custom Security Checks:
- **SQL Injection:** Fix immediately - use parameterized queries
- **Env Var Leak:** Remove console.log of env vars
- **CORS Warning:** Ensure `origin: '*'` only in development

---

## Maintenance

### Weekly:
- Review Snyk/Dependabot PRs and merge if tests pass
- Check for new Security alerts

### Monthly:
- Review all Security → Code scanning alerts
- Update any dependencies with moderate vulnerabilities
- Review SonarCloud technical debt

### After Adding New Dependencies:
- Check Dependabot/Snyk alerts within 24 hours
- Review SonarCloud for any new code smells
- Run `npm audit` locally

### When Security Scan Fails:
1. Review the failed check in PR → Checks tab
2. Click "Details" to see specific findings
3. Fix high/critical issues before merging
4. For false positives:
   - Add `// sonar-ignore` comment with justification
   - Mark as false positive in Security tab

---

## Troubleshooting

### CodeQL fails to build:
- Check Node.js version in workflow (line 21)
- Verify `npm ci` succeeds locally
- Check build logs in Actions tab

### NPM Audit fails on old advisories:
- Review the specific vulnerability
- If false positive, use `npm audit --production` to ignore dev dependencies
- Document known acceptable risks

### SonarCloud not running:
- Verify `SONAR_TOKEN` secret is set
- Check organization/project key matches sonar-project.properties
- Ensure sonar-project.properties exists in repo root

### Dependabot/Snyk creating too many PRs:
- Configure grouping in dependabot.yml (already done)
- Adjust update frequency to "monthly" if needed
- Set `open-pull-requests-limit` lower

### SQL Injection check false positive:
- Check if it's actually a template literal in a SQL query
- If safe (e.g., table name from constant), add comment:
  ```javascript
  // security-scan-ignore: table name is constant
  const query = `SELECT * FROM ${TABLES.users}`;
  ```

---

## Additional Security Hardening

### 1. Enable Branch Protection:
```bash
# Settings → Branches → Add rule for "main"
- Require pull request before merging
- Require status checks to pass:
  ✓ CodeQL
  ✓ NPM Dependency Audit
  ✓ Custom Security Checks
  ✓ SonarCloud (if configured)
- Require branches to be up to date before merging
- Do not allow bypassing the above settings
```

### 2. Review GitHub Security Advisories:
- Check https://github.com/advisories regularly
- Subscribe to notifications for packages you use

### 3. Use GitHub Advanced Security (if available):
- Code scanning with CodeQL (included in free public repos)
- Secret scanning (included in free public repos)
- Dependency review (included in free public repos)

---

## Related Issues

- Forge Issue: **VT-LIVEVIEW-1** - Phase 1: Automated Security Scanning

---

**Last Updated:** 2026-04-03

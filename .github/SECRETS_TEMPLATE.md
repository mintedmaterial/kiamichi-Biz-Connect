# GitHub Secrets Template

Use this template to configure GitHub Actions secrets for the Kiamichi Biz Connect project.

## Configuration Steps

1. Go to your GitHub repository
2. Navigate to **Settings > Secrets and variables > Actions**
3. Click **New repository secret** for each secret below
4. Copy the name exactly (case-sensitive)
5. Paste the value (no quotes, no trailing spaces)

---

## Required Secrets

### Cloudflare Configuration

#### `CLOUDFLARE_API_TOKEN`
**Description**: API token for deploying Workers
**How to get**:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click on your profile → **My Profile** → **API Tokens**
3. Click **Create Token**
4. Use template: **Edit Cloudflare Workers**
5. Add permissions:
   - Account: Workers Scripts - Edit
   - Account: Workers KV Storage - Edit
   - Account: Workers R2 Storage - Edit
   - Account: D1 - Edit
6. Set Account Resources: Include → Your account
7. Click **Continue to summary** → **Create Token**
8. Copy the token (starts with `ey...`)

**Value**: `<your-cloudflare-api-token>`

---

#### `CLOUDFLARE_ACCOUNT_ID`
**Description**: Your Cloudflare account identifier
**How to get**:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **Workers & Pages** in the left sidebar
3. Look for **Account ID** in the right sidebar
4. Or check the URL: `dash.cloudflare.com/<account-id>/workers`

**Value**: `ff3c5e2beaea9f85fee3200bfe28da16`

---

### Application Secrets

#### `ADMIN_KEY`
**Description**: Secret key for admin operations
**How to generate**:
```bash
# Generate a secure random key
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Or use online generator
https://www.random.org/strings/
```

**Value**: `<your-generated-admin-key>`

**Security Notes**:
- Use at least 32 characters
- Mix of uppercase, lowercase, numbers, symbols
- Never commit this to git
- Rotate every 90 days

---

#### `GOOGLE_CLIENT_SECRET`
**Description**: OAuth client secret for Google authentication
**How to get**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Navigate to **APIs & Services > Credentials**
4. Find your OAuth 2.0 Client ID for web application
5. Click the client ID name
6. Copy the **Client Secret**

**Value**: `<your-google-client-secret>`

**Related Configuration**:
- Client ID (public, in wrangler.toml): `434934291611-9uo1jsbg07dnd711l4vb47kbrm2okoc0.apps.googleusercontent.com`
- Authorized redirect URIs should include:
  - `https://kiamichibizconnect.com/auth/google/callback`
  - `https://app.kiamichibizconnect.com/auth/google/callback`

---

#### `FACEBOOK_APP_SECRET`
**Description**: Facebook app secret for OAuth and API access
**How to get**:
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **My Apps**
3. Select your app (or create one)
4. Go to **Settings > Basic**
5. Copy the **App Secret** (click Show)

**Value**: `<your-facebook-app-secret>`

**Related Configuration**:
- App ID (public, in wrangler.toml): `879824491249046`
- App Domains should include: `kiamichibizconnect.com`

---

#### `FB_EMAIL`
**Description**: Facebook account email for browser-based posting
**Purpose**: Used by the Facebook Worker to log in via browser automation

**Value**: `<facebook-account-email>`

**Security Notes**:
- Use a dedicated business account, not a personal account
- Enable two-factor authentication (2FA)
- Consider using a service account if available
- Monitor login activity regularly

---

#### `FB_PASSWORD`
**Description**: Facebook account password for browser-based posting
**Purpose**: Used by the Facebook Worker to log in via browser automation

**Value**: `<facebook-account-password>`

**Security Notes**:
- Use a strong, unique password
- Rotate password every 90 days
- Monitor for unauthorized access
- Consider Facebook App Passwords if available
- Never commit this to git or share it

---

## Optional Secrets

#### `DATABASE_ID`
**Description**: D1 database identifier (usually in wrangler.toml)
**Value**: `e8b7b17a-a93b-4b61-92ad-80b488266e12`

**Note**: This is already configured in `wrangler.toml`, only add as secret if you need to override it.

---

## Verification Checklist

After adding all secrets, verify:

- [ ] All 7 required secrets are present in GitHub
- [ ] Secret names match exactly (case-sensitive)
- [ ] No trailing spaces or newlines in values
- [ ] Cloudflare API token has correct permissions
- [ ] Google OAuth redirect URIs are configured
- [ ] Facebook app domains are configured
- [ ] Test workflow runs successfully

---

## Testing Secrets

### Test Cloudflare Connection

```bash
# Install wrangler CLI locally
npm install -g wrangler

# Set environment variable
export CLOUDFLARE_API_TOKEN=<your-token>
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>

# Test connection
wrangler whoami

# List workers
wrangler deployments list --name kiamichi-biz-connect
```

### Test Deployment Locally

```bash
# Set all secrets in .dev.vars (DO NOT COMMIT)
cat > .dev.vars << EOF
ADMIN_KEY=<your-admin-key>
GOOGLE_CLIENT_SECRET=<your-google-secret>
FACEBOOK_APP_SECRET=<your-facebook-secret>
FB_EMAIL=<fb-email>
FB_PASSWORD=<fb-password>
EOF

# Run local dev server
npm run dev

# Test authentication flows
```

---

## Security Best Practices

1. **Never commit secrets to git**:
   ```bash
   # Add to .gitignore
   .dev.vars
   .env
   secrets.json
   ```

2. **Use environment-specific secrets**:
   - Different tokens for dev/staging/production
   - Separate OAuth credentials for preview environments

3. **Rotate secrets regularly**:
   - API tokens: Every 90 days
   - Passwords: Every 90 days
   - Admin keys: Every 180 days

4. **Monitor secret usage**:
   - Check Cloudflare audit logs
   - Review GitHub Actions logs for failures
   - Set up alerts for unauthorized access

5. **Limit permissions**:
   - API tokens should have minimal required permissions
   - Use read-only tokens where possible
   - Scope tokens to specific resources

---

## Troubleshooting

### "Invalid API Token" Error

**Symptoms**: Workflow fails with authentication error

**Solutions**:
1. Verify token hasn't expired
2. Check token has correct permissions
3. Regenerate token in Cloudflare
4. Update GitHub secret with new token

### "Secret Not Found" Error

**Symptoms**: Worker crashes with undefined secret

**Solutions**:
1. Verify secret name matches in workflow and code
2. Check secret is added in GitHub (not just locally)
3. Ensure workflow passes secret to wrangler-action:
   ```yaml
   secrets: |
     ADMIN_KEY
   env:
     ADMIN_KEY: ${{ secrets.ADMIN_KEY }}
   ```

### "OAuth Redirect URI Mismatch"

**Symptoms**: Authentication fails with redirect error

**Solutions**:
1. Add all domains to authorized redirect URIs
2. Include preview URLs: `https://...-preview.workers.dev/auth/...`
3. Wait 5-10 minutes for OAuth config to propagate

---

## Secret Management Tools

### Cloudflare Wrangler CLI

```bash
# List secrets for a worker
wrangler secret list --name kiamichi-biz-connect

# Add a secret to a worker
wrangler secret put ADMIN_KEY --name kiamichi-biz-connect

# Delete a secret
wrangler secret delete ADMIN_KEY --name kiamichi-biz-connect
```

### GitHub CLI

```bash
# Install GitHub CLI
# https://cli.github.com/

# Set a secret
gh secret set CLOUDFLARE_API_TOKEN

# List secrets
gh secret list

# Delete a secret
gh secret delete CLOUDFLARE_API_TOKEN
```

---

## Support

For issues with secret configuration:

1. Check [CI_CD_SETUP.md](../CI_CD_SETUP.md) for detailed troubleshooting
2. Review [GitHub Actions logs](../../actions)
3. Consult [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

---

**Last Updated**: December 2024
**Maintained By**: Kiamichi Biz Connect Team

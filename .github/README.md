# GitHub Configuration & CI/CD

This directory contains GitHub Actions workflows and CI/CD configuration for the Kiamichi Biz Connect project.

## Quick Navigation

### For Getting Started
Start here to set up the CI/CD pipeline:
- **[DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)** - Overview and quick start guide

### For Configuration
- **[SECRETS_TEMPLATE.md](SECRETS_TEMPLATE.md)** - How to configure GitHub secrets
- **[workflows/README.md](workflows/README.md)** - Workflow overview and reference

### For Detailed Documentation
- **[../CI_CD_SETUP.md](../CI_CD_SETUP.md)** - Complete setup and troubleshooting guide

### For Validation
- **[workflows/validate.sh](workflows/validate.sh)** - Run this to verify your setup

---

## Workflows

The project uses three GitHub Actions workflows:

| Workflow | File | Purpose | Triggers |
|----------|------|---------|----------|
| **CI** | [ci.yml](workflows/ci.yml) | Code validation | PR to main |
| **Deploy** | [deploy.yml](workflows/deploy.yml) | Production deployment | Merge to main |
| **Preview** | [preview.yml](workflows/preview.yml) | PR previews | PR open/update/close |

---

## Setup Steps

### 1. Configure Secrets
Follow [SECRETS_TEMPLATE.md](SECRETS_TEMPLATE.md) to add these secrets:
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- ADMIN_KEY
- GOOGLE_CLIENT_SECRET
- FACEBOOK_APP_SECRET
- FB_EMAIL
- FB_PASSWORD

### 2. Validate Setup
```bash
# Run validation script
bash .github/workflows/validate.sh
```

### 3. Test Workflows
1. Create a test PR
2. Verify CI passes
3. Check preview deployment
4. Merge to test production deployment

---

## Documentation Structure

```
.github/
├── README.md (this file)              # Navigation hub
├── DEPLOYMENT_SUMMARY.md              # Quick overview and metrics
├── SECRETS_TEMPLATE.md                # Secret configuration guide
└── workflows/
    ├── README.md                      # Workflow quick reference
    ├── ci.yml                         # CI workflow
    ├── deploy.yml                     # Deploy workflow
    ├── preview.yml                    # Preview workflow
    └── validate.sh                    # Validation script

CI_CD_SETUP.md (root)                  # Complete troubleshooting guide
```

---

## Need Help?

1. **Quick Reference**: See [workflows/README.md](workflows/README.md)
2. **Setup Issues**: See [SECRETS_TEMPLATE.md](SECRETS_TEMPLATE.md)
3. **Troubleshooting**: See [../CI_CD_SETUP.md](../CI_CD_SETUP.md)
4. **Deployment Issues**: See [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)

---

**Created**: December 2024
**Status**: Production Ready

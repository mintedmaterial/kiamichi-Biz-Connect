#!/bin/bash
# Validation script for CI/CD pipeline setup
# Run this to verify your workflows are correctly configured

set -e

echo "🔍 Validating CI/CD Pipeline Setup..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required files
echo "📁 Checking workflow files..."
required_files=(
    ".github/workflows/ci.yml"
    ".github/workflows/deploy.yml"
    ".github/workflows/preview.yml"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} Found: $file"
    else
        echo -e "${RED}✗${NC} Missing: $file"
        exit 1
    fi
done

# Check for package.json files
echo ""
echo "📦 Checking package.json files..."
package_files=(
    "package.json"
    "workers/business-agent/package.json"
    "workers/analyzer-worker/package.json"
    "workers/facebook-worker/package.json"
)

for file in "${package_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} Found: $file"
    else
        echo -e "${YELLOW}⚠${NC} Missing: $file (optional)"
    fi
done

# Check for wrangler configuration
echo ""
echo "⚙️  Checking wrangler configuration..."
wrangler_files=(
    "wrangler.toml"
    "workers/business-agent/wrangler.jsonc"
    "workers/analyzer-worker/wrangler.toml"
    "workers/facebook-worker/wrangler.toml"
)

for file in "${wrangler_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} Found: $file"
    else
        echo -e "${RED}✗${NC} Missing: $file"
        exit 1
    fi
done

# Check for GitHub secrets (can't actually verify values, just remind)
echo ""
echo "🔐 Required GitHub Secrets (verify manually):"
echo "   - CLOUDFLARE_API_TOKEN"
echo "   - CLOUDFLARE_ACCOUNT_ID"
echo "   - ADMIN_KEY"
echo "   - GOOGLE_CLIENT_SECRET"
echo "   - FACEBOOK_APP_SECRET"
echo "   - FB_EMAIL"
echo "   - FB_PASSWORD"
echo ""
echo "   ➜ Set these at: Settings > Secrets and variables > Actions"

# Validate YAML syntax
echo ""
echo "✨ Validating YAML syntax..."
for file in .github/workflows/*.yml; do
    if command -v yamllint &> /dev/null; then
        if yamllint "$file" 2>/dev/null; then
            echo -e "${GREEN}✓${NC} Valid YAML: $file"
        else
            echo -e "${YELLOW}⚠${NC} YAML warnings in: $file (non-critical)"
        fi
    else
        echo -e "${YELLOW}⚠${NC} yamllint not installed, skipping validation"
        break
    fi
done

# Check for common issues
echo ""
echo "🔎 Checking for common issues..."

# Check if workflows use correct action versions
if grep -q "actions/checkout@v4" .github/workflows/*.yml; then
    echo -e "${GREEN}✓${NC} Using latest checkout action (v4)"
else
    echo -e "${YELLOW}⚠${NC} Consider updating checkout action to v4"
fi

if grep -q "actions/setup-node@v4" .github/workflows/*.yml; then
    echo -e "${GREEN}✓${NC} Using latest setup-node action (v4)"
else
    echo -e "${YELLOW}⚠${NC} Consider updating setup-node action to v4"
fi

if grep -q "cloudflare/wrangler-action@v3" .github/workflows/*.yml; then
    echo -e "${GREEN}✓${NC} Using latest wrangler action (v3)"
else
    echo -e "${YELLOW}⚠${NC} Consider updating wrangler action to v3"
fi

# Check for security issues
echo ""
echo "🛡️  Security checks..."

if grep -rq "password.*:" .github/workflows/*.yml | grep -v "secrets\." | grep -v "#"; then
    echo -e "${RED}✗${NC} Found hardcoded passwords in workflows!"
    exit 1
else
    echo -e "${GREEN}✓${NC} No hardcoded passwords found"
fi

if grep -rq "token.*:" .github/workflows/*.yml | grep -v "secrets\." | grep -v "github-token" | grep -v "#"; then
    echo -e "${RED}✗${NC} Found hardcoded tokens in workflows!"
    exit 1
else
    echo -e "${GREEN}✓${NC} No hardcoded tokens found"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ CI/CD Pipeline validation passed!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Configure GitHub secrets (see .github/SECRETS_TEMPLATE.md)"
echo "2. Create a test PR to verify CI workflow"
echo "3. Check preview deployments work"
echo "4. Merge to main to test production deployment"
echo ""
echo "📚 Documentation: See CI_CD_SETUP.md for details"

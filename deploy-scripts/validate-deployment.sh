#!/bin/bash

# PDXmas Contest App - Deployment Validation Script
# This script validates that your deployment setup is correct before pushing to production

set -e

echo "🔍 PDXmas Contest App - Deployment Validation"
echo "============================================="

# Function to log with timestamp
log() {
    echo "[$(date '+%H:%M:%S')] $1"
}

# Function for success/failure indicators
success() {
    echo "✅ $1"
}

failure() {
    echo "❌ $1"
}

warning() {
    echo "⚠️  $1"
}

# Validation results
ERRORS=0
WARNINGS=0

log "Starting deployment validation..."

# Check 1: Gitea workflow file exists
log "Checking Gitea Actions workflow..."
if [ -f ".gitea/workflows/deploy.yml" ]; then
    success "Gitea Actions workflow file exists"
else
    failure "Gitea Actions workflow file not found at .gitea/workflows/deploy.yml"
    ERRORS=$((ERRORS + 1))
fi

# Check 2: Docker files exist and are valid
log "Checking Docker configuration..."
if [ -f "docker-compose.yml" ]; then
    success "docker-compose.yml exists"

    # Validate docker-compose syntax
    if docker-compose config >/dev/null 2>&1; then
        success "docker-compose.yml syntax is valid"
    else
        failure "docker-compose.yml has syntax errors"
        ERRORS=$((ERRORS + 1))
    fi
else
    failure "docker-compose.yml not found"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "backend/Dockerfile" ]; then
    success "Backend Dockerfile exists"
else
    failure "Backend Dockerfile not found"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "frontend/Dockerfile" ]; then
    success "Frontend Dockerfile exists"
else
    failure "Frontend Dockerfile not found"
    ERRORS=$((ERRORS + 1))
fi

# Check 3: Package.json files exist and have required scripts
log "Checking package.json files..."

# Backend package.json
if [ -f "backend/package.json" ]; then
    success "Backend package.json exists"

    # Check for required scripts
    for script in "build" "start" "dev" "test" "lint"; do
        if grep -q "\"$script\":" backend/package.json; then
            success "Backend has '$script' script"
        else
            warning "Backend missing '$script' script"
            WARNINGS=$((WARNINGS + 1))
        fi
    done
else
    failure "Backend package.json not found"
    ERRORS=$((ERRORS + 1))
fi

# Frontend package.json
if [ -f "frontend/package.json" ]; then
    success "Frontend package.json exists"

    # Check for required scripts
    for script in "build" "start" "test" "lint"; do
        if grep -q "\"$script\":" frontend/package.json; then
            success "Frontend has '$script' script"
        else
            warning "Frontend missing '$script' script"
            WARNINGS=$((WARNINGS + 1))
        fi
    done
else
    failure "Frontend package.json not found"
    ERRORS=$((ERRORS + 1))
fi

# Check 4: TypeScript configuration
log "Checking TypeScript configuration..."
if [ -f "backend/tsconfig.json" ]; then
    success "Backend TypeScript config exists"
else
    failure "Backend tsconfig.json not found"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "frontend/tsconfig.json" ]; then
    success "Frontend TypeScript config exists"
else
    failure "Frontend tsconfig.json not found"
    ERRORS=$((ERRORS + 1))
fi

# Check 5: Deployment scripts exist and are executable
log "Checking deployment scripts..."
REQUIRED_SCRIPTS=("deploy.sh" "rollback.sh" "setup-unraid.sh" "generate-ssh-keys.sh" "monitor.sh")

for script in "${REQUIRED_SCRIPTS[@]}"; do
    script_path="deploy-scripts/$script"
    if [ -f "$script_path" ]; then
        if [ -x "$script_path" ]; then
            success "Script $script exists and is executable"
        else
            warning "Script $script exists but is not executable"
            chmod +x "$script_path"
            success "Made $script executable"
        fi
    else
        failure "Script $script not found"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check 6: Source code structure
log "Checking source code structure..."

# Backend structure
BACKEND_DIRS=("src" "src/config" "src/controllers" "src/services" "src/models" "src/routes" "src/middleware" "src/utils" "src/types")
for dir in "${BACKEND_DIRS[@]}"; do
    if [ -d "backend/$dir" ]; then
        success "Backend directory $dir exists"
    else
        failure "Backend directory $dir not found"
        ERRORS=$((ERRORS + 1))
    fi
done

# Frontend structure
FRONTEND_DIRS=("src" "src/components" "src/pages" "src/hooks" "src/services" "src/utils" "src/types")
for dir in "${FRONTEND_DIRS[@]}"; do
    if [ -d "frontend/$dir" ]; then
        success "Frontend directory $dir exists"
    else
        failure "Frontend directory $dir not found"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check 7: Environment configuration
log "Checking environment configuration..."
if [ -f "backend/.env.example" ]; then
    success "Backend environment example exists"
else
    warning "Backend .env.example not found (recommended for documentation)"
    WARNINGS=$((WARNINGS + 1))
fi

# Check 8: Git configuration
log "Checking git configuration..."
if [ -d ".git" ]; then
    success "Git repository initialized"

    # Check if we're on main or master branch
    BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
        success "On main/master branch ($BRANCH)"
    else
        warning "Not on main/master branch (current: $BRANCH)"
        warning "Deployment will only trigger from main/master"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    failure "Not in a git repository"
    ERRORS=$((ERRORS + 1))
fi

# Check 9: Documentation
log "Checking documentation..."
if [ -f "DEPLOYMENT.md" ]; then
    success "Deployment documentation exists"
else
    warning "DEPLOYMENT.md not found (recommended)"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -f "CLAUDE.md" ]; then
    success "CLAUDE.md documentation exists"
else
    warning "CLAUDE.md not found (recommended for future development)"
    WARNINGS=$((WARNINGS + 1))
fi

# Check 10: Try building locally (optional)
log "Testing local builds (optional)..."
if command -v npm >/dev/null 2>&1; then
    success "npm is available"

    echo "Would you like to test local builds? This will install dependencies and build both backend and frontend."
    echo "This is optional but recommended. (y/N)"
    read -r RESPONSE

    if [ "$RESPONSE" = "y" ] || [ "$RESPONSE" = "Y" ]; then
        log "Testing backend build..."
        cd backend
        if npm ci >/dev/null 2>&1; then
            success "Backend dependencies installed"

            if npm run build >/dev/null 2>&1; then
                success "Backend builds successfully"
            else
                failure "Backend build failed"
                ERRORS=$((ERRORS + 1))
            fi
        else
            failure "Backend dependency installation failed"
            ERRORS=$((ERRORS + 1))
        fi
        cd ..

        log "Testing frontend build..."
        cd frontend
        if npm ci >/dev/null 2>&1; then
            success "Frontend dependencies installed"

            if npm run build >/dev/null 2>&1; then
                success "Frontend builds successfully"
            else
                failure "Frontend build failed"
                ERRORS=$((ERRORS + 1))
            fi
        else
            failure "Frontend dependency installation failed"
            ERRORS=$((ERRORS + 1))
        fi
        cd ..
    else
        warning "Skipped local build test"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    warning "npm not available - cannot test local builds"
    WARNINGS=$((WARNINGS + 1))
fi

echo
echo "🏁 Validation Summary"
echo "==================="
echo

if [ $ERRORS -eq 0 ]; then
    success "All critical validations passed!"
else
    failure "$ERRORS critical errors found"
fi

if [ $WARNINGS -gt 0 ]; then
    warning "$WARNINGS warnings found"
fi

echo

if [ $ERRORS -eq 0 ]; then
    echo "🚀 Your deployment setup looks good!"
    echo
    echo "Next steps:"
    echo "1. Run deploy-scripts/setup-unraid.sh on your Unraid server"
    echo "2. Run deploy-scripts/generate-ssh-keys.sh to create SSH keys"
    echo "3. Configure your Gitea repository secrets (see DEPLOYMENT.md)"
    echo "4. Push to main/master branch to trigger deployment"
    echo
    echo "📚 For detailed setup instructions, see DEPLOYMENT.md"
else
    echo "❌ Please fix the critical errors before deploying"
    echo
    echo "Critical issues found:"
    echo "- Check that all required files exist"
    echo "- Verify Docker configuration is valid"
    echo "- Ensure TypeScript compilation works"
    echo
    exit 1
fi

if [ $WARNINGS -eq 0 ]; then
    echo "✨ Perfect! No warnings found."
else
    echo "⚠️  Consider addressing the warnings for the best experience."
fi

echo
echo "🎄 Ready to deploy PDXmas Contest App! ❄️"
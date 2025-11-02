#!/bin/bash

# Script to generate coverage reports and run SonarQube scan
# Usage: ./run-coverage-and-scan.sh

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Generating Test Coverage Reports ===${NC}\n"

# 1. Generate Python coverage
echo -e "${GREEN}[1/4] Running Python tests and generating coverage...${NC}"
cd back-end

# Check if we're in a conda environment and use it, otherwise fall back to system python
if command -v conda &> /dev/null && conda info --envs | grep -q "scrummy"; then
    echo -e "${YELLOW}Using conda environment 'scrummy'${NC}"
    conda run -n scrummy python -m pytest tests/ --cov=. --cov-report=xml:coverage.xml --cov-report=term
elif command -v python3 &> /dev/null; then
    python3 -m pytest tests/ --cov=. --cov-report=xml:coverage.xml --cov-report=term
else
    python -m pytest tests/ --cov=. --cov-report=xml:coverage.xml --cov-report=term
fi

cd ..
echo -e "${GREEN}✓ Python coverage generated: back-end/coverage.xml${NC}\n"

# 2. Generate Frontend coverage
echo -e "${GREEN}[2/4] Running Frontend tests and generating coverage...${NC}"
cd front-end

# Check if node_modules exists, if not try to install dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    if command -v npm >/dev/null 2>&1; then
        npm install
    elif command -v yarn >/dev/null 2>&1; then
        yarn install
    elif command -v pnpm >/dev/null 2>&1; then
        pnpm install
    else
        echo -e "${RED}No package manager found (npm, yarn, or pnpm)${NC}"
        echo -e "${YELLOW}Skipping frontend tests...${NC}"
        cd ..
        FRONTEND_COVERAGE_EXISTS=false
    fi
fi

if [ "$FRONTEND_COVERAGE_EXISTS" != "false" ]; then
    # Run frontend tests with coverage, excluding test files
    if command -v npm >/dev/null 2>&1; then
        npm test -- --coverage --watchAll=false --passWithNoTests
    elif command -v yarn >/dev/null 2>&1; then
        yarn test --coverage --watchAll=false --passWithNoTests
    elif command -v pnpm >/dev/null 2>&1; then
        pnpm test --coverage --watchAll=false --passWithNoTests
    fi
    
    cd ..
    echo -e "${GREEN}✓ Frontend coverage generated: front-end/coverage/${NC}\n"
    FRONTEND_COVERAGE_EXISTS=true
else
    FRONTEND_COVERAGE_EXISTS=false
fi

# 3. Verify coverage files exist
if [ ! -f "back-end/coverage.xml" ]; then
    echo -e "${RED}Error: back-end/coverage.xml not found!${NC}"
    exit 1
fi

echo -e "${BLUE}Coverage files ready:${NC}"
echo -e "  ${GREEN}✓${NC} back-end/coverage.xml ($(wc -l < back-end/coverage.xml) lines)"

# Normalise backend coverage path expected by SonarQube
cp back-end/coverage.xml coverage-backend.xml
echo -e "  ${GREEN}✓${NC} coverage-backend.xml ($(wc -l < coverage-backend.xml) lines)"

if [ "$FRONTEND_COVERAGE_EXISTS" = "true" ] && [ -f "front-end/coverage/lcov.info" ]; then
    echo -e "  ${GREEN}✓${NC} front-end/coverage/lcov.info ($(wc -l < front-end/coverage/lcov.info) lines)"
elif [ "$FRONTEND_COVERAGE_EXISTS" = "true" ]; then
    echo -e "  ${YELLOW}⚠${NC} front-end/coverage/ (directory exists but lcov.info not found)"
else
    echo -e "  ${YELLOW}⚠${NC} Frontend coverage skipped (no package manager)"
fi

# 4. Check for SONAR_TOKEN
if [ -z "$SONAR_TOKEN" ]; then
    echo -e "\n${YELLOW}Warning: SONAR_TOKEN environment variable not set${NC}"
    read -p "Enter your SonarQube token: " SONAR_TOKEN
    export SONAR_TOKEN
fi

# 5. Run SonarQube scan
echo -e "\n${BLUE}=== Running SonarQube Scan ===${NC}\n"

# Try to find sonar-scanner in common locations
if command -v sonar-scanner &> /dev/null; then
    SONAR_CMD="sonar-scanner"
elif [ -f "/opt/homebrew/bin/sonar-scanner" ]; then
    SONAR_CMD="/opt/homebrew/bin/sonar-scanner"
elif [ -f "/opt/homebrew/Cellar/sonar-scanner/7.3.0.5189/bin/sonar-scanner" ]; then
    SONAR_CMD="/opt/homebrew/Cellar/sonar-scanner/7.3.0.5189/bin/sonar-scanner"
elif [ -f "/usr/local/bin/sonar-scanner" ]; then
    SONAR_CMD="/usr/local/bin/sonar-scanner"
else
    echo -e "${RED}Error: sonar-scanner not found. Please install it or add it to PATH${NC}"
    exit 1
fi

$SONAR_CMD \
  -Dsonar.host.url=https://sonarcloud.io \
  -Dsonar.token=$SONAR_TOKEN \
  -Dsonar.verbose=false

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✓ Scan completed successfully!${NC}"
    echo -e "${GREEN}View results at: https://sonarcloud.io/dashboard?id=slinkiedinky_scrummy-spm-G4T6${NC}"
else
    echo -e "\n${RED}✗ Scan failed${NC}"
    exit 1
fi

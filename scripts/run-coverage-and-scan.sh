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
echo -e "${GREEN}[1/3] Running Python tests and generating coverage...${NC}"
cd back-end
python -m pytest tests/ --cov=. --cov-report=xml:coverage.xml --cov-report=term
cd ..
echo -e "${GREEN}✓ Python coverage generated: back-end/coverage.xml${NC}\n"

# 2. Verify coverage file exists
if [ ! -f "back-end/coverage.xml" ]; then
    echo -e "${RED}Error: back-end/coverage.xml not found!${NC}"
    exit 1
fi

echo -e "${BLUE}Coverage files ready:${NC}"
echo -e "  ${GREEN}✓${NC} back-end/coverage.xml ($(wc -l < back-end/coverage.xml) lines)"

# 3. Check for SONAR_TOKEN
if [ -z "$SONAR_TOKEN" ]; then
    echo -e "\n${YELLOW}Warning: SONAR_TOKEN environment variable not set${NC}"
    read -p "Enter your SonarQube token: " SONAR_TOKEN
    export SONAR_TOKEN
fi

# 4. Run SonarQube scan
echo -e "\n${BLUE}=== Running SonarQube Scan ===${NC}\n"
sonar-scanner \
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

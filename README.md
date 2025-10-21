# Scrummy - Smart Task Management System

All-In-One is rolling out an internal Smart Task Management System to support hybrid work, drive productivity, and attract younger talent with flexible arrangements. The platform extends the company's existing remote-friendly culture by giving teams a shared space to organise tasks, coordinate deliverables, and optimise performance across regional offices.

## Project Structure

```
scrummy-spm-G4T6/
├── back-end/               # Flask API server
│   ├── tests/             # Backend test suite
│   ├── .coveragerc        # Python coverage configuration
│   ├── requirements.txt   # Python dependencies
│   └── firebase.py        # Firebase configuration
│
├── front-end/             # Next.js application
│   ├── src/
│   │   ├── app/          # Next.js app router pages
│   │   ├── components/   # React components
│   │   │   └── __tests__/  # Component tests
│   │   └── lib/          # Utilities and configs
│   ├── jest.config.js    # Jest configuration
│   └── jest.setup.js     # Jest setup file
│
├── docs/                  # Documentation
│   ├── TESTING.md        # Testing guide
│   └── SONARQUBE_SETUP.md # SonarQube configuration guide
│
├── scripts/               # Utility scripts
│   ├── run-all-tests.sh
│   └── run-coverage-and-scan.sh
│
├── .github/
│   └── workflows/        # CI/CD workflows
│       └── github_actions_workflow.yaml
│
├── sonar-project.properties  # SonarQube configuration
└── README.md
```

## Quick Start

### Backend Setup

```bash
cd back-end
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend Setup

```bash
cd front-end
npm install
npm run dev
```

## Testing

### Run All Tests

```bash
# From project root
./scripts/run-all-tests.sh
```

### Backend Tests

```bash
cd back-end
pytest tests/ --cov=. --cov-report=xml --cov-report=term -v
```

### Frontend Tests

```bash
cd front-end
npm test                    # Run tests
npm run test:coverage       # Run with coverage
```

For detailed testing information, see [docs/TESTING.md](docs/TESTING.md).

## Code Quality

### SonarQube Analysis

This project uses SonarQube Cloud for code quality and security analysis. The analysis runs automatically on every push via GitHub Actions.

To run a manual scan:

```bash
./scripts/run-coverage-and-scan.sh
```

For SonarQube setup instructions, see [docs/SONARQUBE_SETUP.md](docs/SONARQUBE_SETUP.md).

### Coverage

Current test coverage:
- Backend: 82% (41 tests)
- Frontend: Comprehensive test suite with 100+ tests

## Tech Stack

### Backend
- **Python 3.11**
- **Flask** - Web framework
- **Firebase Admin SDK** - Database and authentication
- **pytest** - Testing framework
- **pytest-cov** - Coverage reporting

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - UI library
- **Tailwind CSS** - Styling
- **Jest** - Testing framework
- **React Testing Library** - Component testing
- **Firebase** - Authentication and database

## CI/CD

GitHub Actions workflow automatically:
- Runs backend tests with coverage
- Runs frontend tests with coverage
- Performs SonarQube code analysis
- Generates coverage reports

## Users

### Staff
- Securely log in and manage a personal task space.
- Create/update tasks and subtasks with deadlines, notes, and ownership.
- Group tasks under projects or categories for clarity.
- Track schedules via calendar views and receive alerts for upcoming or overdue work.
- Leverage productivity tools (timers, reminders) to stay focused when unsupervised.
- Collaborate through shared tasks, comments, and personalised UI (e.g., dark mode).

### Managers & Directors
- Oversee team workload, schedules, and deadlines at a glance.
- Assign or reassign work based on priority and capacity.
- Comment on or approve updates, and highlight risks through dashboards.
- Generate visual insights into progress, bottlenecks, and cross-team initiatives.

### HR & Senior Management
- Monitor organisation-wide productivity trends and engagement.
- Review task data for performance discussions and strategic planning.
- Identify under-utilised or overloaded departments.
- Export summaries/reports for leadership reviews and digital transformation initiatives.

## Core Features

| Area | Description |
| --- | --- |
| **User Authorisation & Authentication** | Role-based access (employee, manager, admin) ensures the right data reaches the right people. |
| **Task Management** | Create, view, update, and complete tasks with metadata like deadlines, notes, assignees, and status. |
| **Task Grouping & Organisation** | Cluster work by project, department, or theme to maintain focus and context. |
| **Activity Tracking & History** | Full audit trail of updates for accountability and conflict resolution. |
| **User Roles & Management** | Invite users, assign teams, and govern permissions across the organisation. |
| **Dashboard & Insights** | Visualise progress, identify blockers, and surface team metrics for better decision-making. |
| **Deadline & Schedule Tracking** | Attach due dates, trigger reminders, and expose overdue work for follow-up. |
| **Calendar Integration** | Calendar view (with potential drag-and-drop) to plan workload across days/weeks/months. |
| **Focus Timer & Time Logging** | Built-in timer (e.g., Pomodoro) plus optional time tracking for self/manager insights. |
| **Notification System** | In-app or email alerts for comments, updates, approvals, and deadlines. |
| **User Personalisation** | Customise interface preferences such as light/dark mode and task list layouts. |
| **Report Generation & Exporting** | Produce shareable summaries (PDF, spreadsheet) for meetings and reviews. |
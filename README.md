# Scrummy - Smart Task Management System

All-In-One is rolling out an internal Smart Task Management System to support hybrid work, drive productivity, and attract younger talent with flexible arrangements. The platform extends the company's existing remote-friendly culture by giving teams a shared space to organise tasks, coordinate deliverables, and optimise performance across regional offices.

The internal Smart Task Management system supports the following six core functionalities:
## Core Features

| Area | Description |
| --- | --- |
| **User Authorisation & Authentication** | Role-based access (employee, manager, HR) ensures the right data reaches the right people. |
| **Task Management** | Create, view, update, and complete tasks with metadata like deadlines, notes, assignees, and status. |
| **Task Grouping & Organisation** | Cluster work by project, department, or theme to maintain focus and context. |
| **User Roles & Management** | Invite users, assign teams, and govern permissions across the organisation. |
| **Dashboard & Insights** | Visualise progress, identify blockers, and surface team metrics for better decision-making. |
| **Deadline & Schedule Tracking** | Attach due dates, trigger reminders, and expose overdue work for follow-up. |
| **Calendar Integration** | Calendar view to see schedules of different members of a project. |
| **Notification System** | In-app or email alerts for comments, updates, approvals, and deadlines. |
| **Report Generation & Exporting** | Produce shareable summaries (PDF, spreadsheet) for meetings and reviews. |

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

This project is managed using Scrum methodology. Within a team of six, we have the Product Owner, Scrum Master and developers to conduct sprints of two weeks duration each.
The entire Scrum process (user story definitions, playbook, sprint planning, review, retro) was documented on Jira using Confluence.
## Links
1. **Jira Board:** https://scrummy-spm-g4t6.atlassian.net/jira/software/projects/SCRUM/summary
2. **Jira Sprint Playbook:** https://scrummy-spm-g4t6.atlassian.net/wiki/x/DwEk
3. **Jira Sprint Planning:** https://scrummy-spm-g4t6.atlassian.net/wiki/spaces/S/folder/2392112
4. **Jira Sprint Review:** https://scrummy-spm-g4t6.atlassian.net/wiki/spaces/S/folder/7274501
5. **Jira Sprint Retro:** https://scrummy-spm-g4t6.atlassian.net/wiki/spaces/S/pages/2392066/Retrospectives?atlOrigin=eyJpIjoiY2QzN2U2NWU2M2JkNGI0OWJkNmU2YzRjMjYzNjFiYmEiLCJwIjoiYyJ9
6. **Github Repo:** https://github.com/slinkiedinky/scrummy-spm-G4T6

For Sprint 3, attached are the youtube links to the relevant videos:
1. Backlog Refinement:  https://youtu.be/vbvBmt_OZjA
2. Sprint Planning: https://youtu.be/xkEVTiy62R4
3. Daily Standup: https://youtu.be/UzJFDxcGh2o
4. Sprint Review:  https://youtu.be/tsbCQvC7CXM
5. Sprint Retro: https://youtu.be/qIttG_cIi3I 


## Project Structure

```
NEWEST-SCRUMMY-FINAL/
├─ .github/                     # CI workflow
├─ .vscode/                     # Editor settings
├─ .gitignore
├─ README.md
├─ sonar-project.properties     # SonarQube/SonarCloud config

├─ back-end/
│  ├─ __pycache__/              # Python bytecode (ignored)
│  ├─ .pytest_cache/            # pytest cache
│  ├─ functions/                # Cloud Functions / schedulers
│  ├─ tests/
│  │  └─ test_project_progress_unit.py
│  ├─ app.py                    # Backend entrypoint (FastAPI/Flask-style)
│  ├─ comments.py               # Comments domain logic/API
│  ├─ deadline_notifications.py # Deadline reminder jobs
│  ├─ firebase.py               # Firebase admin init/helpers
│  ├─ notifications.py          # Notification utilities
│  ├─ projects.py               # Projects domain logic/API
│  ├─ recurring_tasks.py        # Recurring cron-style tasks
│  ├─ status_notifications.py   # Status change notifications
│  ├─ users.py                  # Users domain logic/API
│  ├─ requirements.txt          # Python dependencies
│  ├─ package.json              # Node helpers for back-end
│  ├─ package-lock.json
│  ├─ .coveragerc               # Coverage config (Python)
│  ├─ .coverage                 # Coverage data file (Python)
│  └─ coverage.xml              # Coverage report (Python, XML)

├─ front-end/
│  ├─ .next/                    # Next.js build output (ignored)
│  ├─ node_modules/             # Frontend deps (ignored)
│  ├─ public/                   # Static assets
│  ├─ src/
│  │  ├─ __tests__/             # Jest/RTL tests
│  │  ├─ app/                   # Next.js app router
│  │  │  ├─ (dashboard)/        # Dashboard route group
│  │  │  ├─ analytics/          # /analytics
│  │  │  ├─ notifications/      # /notifications
│  │  │  ├─ projects/
│  │  │  │  └─ [id]/            # /projects/[id]
│  │  │  ├─ tasks/              # /tasks
│  │  │  ├─ timeline/           # /timeline
│  │  │  └─ page.jsx            # Root page
│  │  ├─ components/            # Reusable UI components
│  │  ├─ hooks/                 # Custom React hooks
│  │  └─ lib/                   # Utilities (fetchers, formatters, etc.)
│  ├─ components.json           # shadcn/ui registry
│  ├─ eslint.config.mjs         # ESLint config
│  ├─ jest.config.js            # Jest config
│  ├─ jest.setup.js             # Jest setup (RTL, mocks)
│  ├─ jsconfig.json             # Path aliases
│  ├─ package.json              # Frontend scripts/deps
│  ├─ package-lock.json
│  ├─ postcss.config.mjs        # PostCSS/Tailwind
│  ├─ htmlcov/                  # Frontend coverage HTML (Jest)
│  ├─ scripts/                  # Helper scripts
│  ├─ .coverage                 # Frontend coverage data (Jest)
│  ├─ coverage-backend.xml      # (Exported) backend coverage copy
│  └─ firebase-debug.log        # Firebase local logs

├─ htmlcov/                     # top-level coverage html
└─ coverage-backend.xml         # backend coverage at root

```

## Quick Start

### Backend Setup

```bash
cd back-end
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### Frontend Setup

```bash
cd front-end
npm install
npm run dev
```

## Testing

### Run All Tests with Coverage

```bash
cd back-end
pytest tests/ --cov=. --cov-report=xml --cov-report=term -v
```

## Code Quality

### SonarQube Analysis

This project uses SonarQube Cloud for code quality and security analysis. The analysis runs automatically on every push via GitHub Actions.

To run a manual scan:

```bash
./scripts/run-coverage-and-scan.sh
```

For SonarQube setup instructions, see [docs/SONARQUBE_SETUP.md](docs/SONARQUBE_SETUP.md).

### Coverage

Current test coverage: - 21.7% 
- Backend: 43% (390 tests) 
- Frontend: 33 tests

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

## CI

GitHub Actions workflow automatically:
- Runs tests with coverage
- Performs SonarQube code analysis
- Generates coverage reports



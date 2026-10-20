# Claude md

# Project overview

This project is a full stack employee web portal for ACESER Corporation that centralizes employee self-service, workforce management, payroll, attendance, filing, deductions, payslips, and procurement processes. It provides role-based interfaces for administrators and employees, with administrators able to manage employee records, oversee system operations, and customize page-level access to controll which features each employee can view and access.

The application is build using monorepo architecture, the application uses React + Vite for the frontend, Express.js and Node.js for the backend, and MongoDB for data storage.

### Key Commands

- `npm run backend` - starts the Express API with nodemon
- `npm run frontend` - start the React frontend via Vite
- `npm run dev` - runs backend and frontend concurrently
- `npm --prefix frontend run build` - creates a production build for the frontend
- `npm --prefix frontend run lint` - runs ESLint checks on the frontend

### Prerequesites

- Node.js 18+ and npm
- MongoDB running locally
- Git
- Local `.env` file with application secrets and database configuration

### Installation Steps

1. Clone the repository:
   `git clone https://github.com/masterayber/payrollSystem.Aceser.git`
2. Navigate to the project root:
   `cd payroll_system`
3. Install the root dependencies:
   `npm install`
4. Install frontend dependencies (the app uses a separate frontend package):
   `npm install --prefix frontend`
5. Configure environment variables in the project root `.env` file, including:
   - `JWT_SECRET`
   - `MONGO_URI`
   - `EMAIL_USER`
   - `EMAIL PASS`
   - Optional device-related settings for attendance integration
6. Start the application:
   `npm run dev`

## Development

The project is organized into two primary workspaces:

- `backend/` - contains the API server, MongoDB models, routes, middleware, schedlers, uploads, and utility services.
- `frontend/` - contains the React client, route definitions, layouts, contexts, and page components.

The main application flow is:

- User authentication via `backend/routes/auth.js`
- Role-based access using `PrivateRoute` and user role checks in the frontend.
- Attendance and payroll data stored in MongoDB collecions
- Real-time updates through Socket.IO when approvals or status changes occur

### Testing

At the moment, this repository does not appear to define a dedicated automated test suite. Validation is primarily done through manual smoke testing of:

- login and signup flows
- admin vs employee access control
- attendance and payroll screens
- deduction and reports features
- file upload and document handling

### Daily Reports

At the start of each working day (the first session of the day), before any other work, create a **draft** daily report. Don't wait for the end of the day.

- **Location:** `backend/reports/Report File/Daily Report/YYYY-MM-DD.md`, dated in Asia/Manila time. `backend/reports/` is gitignored, so write the file directly; it never goes through a commit or PR.
- **If the file already exists** (a later session the same day), update it instead of creating a new one.
- **Format:** copy the structure of the previous day's report: header (date, day number, repository, basis), Summary, Checklist, Commits and pull requests, What changed, Problems hit and how they were solved, Current state, Open items for the next day.
- **Mark it as a draft:** put `**Status:** DRAFT` under the header until the day is finished.
- **Pre-fill the draft:**
  - Today's checklist from the previous report's "Tomorrow" list and "Open items" section.
  - Current state from `git fetch`, `git status`, `git log` and the branch list.
  - Leave the remaining sections as placeholders.
- **During the day:** tick checklist items, add commits and PRs, and log problems and fixes as they happen.
- **At the end of the day:** fill in every section, write the next day's checklist and open items, and remove the DRAFT status.

Weekly reports go in `backend/reports/Report File/Weekly Report/`, and presentations (.pptx and speaker scripts, written for a non-technical audience) go in `backend/reports/Presentation/`.

### Code Quality

- Frontend linting is configured through ESLint in `frontend/package.json`
- Backend validation is mostly enforced through Mongoose schemas and server-side route logic
- Environment variables should stay in `.env` and should never be committed to source control
- JWT secrets must remain strong and non-placeholder, as enforced in `backend/server.js`

### Build

Production frontend build:

```bash
npm --prefix frontend run build
```

The backend is run as a Node.js service and does not have a separate production build step in the current setup.

## Architecture

### Frontend Architecture

The front end is a React application build with Vite and React Router. It is organized by role and feature area:

- Public pages: login, signup, forgot password, OTP, reset password, additional employee info
- Admin pages: dashboard, employees, deductions, payslips, attendance, calendar, filing, reports, settings
- Employee pages: dashboard, payroll, payslips, attendance, calendar, filing, settings

Global state is managed through context providers such as

- `UserContext`
- `EmployeeContext`
- `SettingsContext`
- `AttendanceContext`
- `FilingContext`

The app uses `MainLayout` for consistent shell navigation and `PrivateRoute` to gate access by role.

### Backend Architecture

The backend is powered by Express and communicates with a MongoDB database. Key components include:

- `backend/server.js` — application bootstrap, middleware setup, Socket.IO config, and database connection
- `backend/routes/` — API endpoints for authentication, attendance, deductions, employee management, filing, and settings
- `backend/models/` — Mongoose schemas such as employees, attendance, leave applications, overtime applications, settings, and user auth records
- `backend/middleware/` — request authentication and access validation
- `backend/utils/` — email, payroll-related helper logic, and device integration utilities
- `backend/uploads/` — uploaded employee or system content
- `backend/schedulers/` — automated job processing such as attendance-related scheduling

The API exposes dedicated routes under `/api/*`, including `/api/auth`, `/api/attendance`, `/api/employee`, `/api/filing`, and `/api/access`.

### Testing Strategy

The application is best validated using a combination of:

- API smoke tests for auth and payroll-related endpoints
- Browser-based verification for route access and user workflows
- Database checks for employee, settings, attendance, and filing records
- Manual validation of file uploads and generated reports

As the project grows, adding automated tests for unit and integration coverage would improve regression safety.

### General Principles

- Keep authentication secure and role-aware
- Use environment variables for sensitive configuration
- Keep frontend and backend responsibilities clearly separated
- Prefer centralized data access through MongoDB models and route handlers
- Validate employee and payroll business rules before writing records
- Maintain route protections for admin-only screens and sensitive APIs
- Support both employee self-service and operational admin management workflows

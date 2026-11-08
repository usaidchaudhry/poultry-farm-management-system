# Poultry Management System (React Frontend)

Final Year Project. Built phase by phase from the PRD. **Current state: Phase 4 (authentication and user access).**

## Requirements
- Node.js 18 or newer (check with `node -v`)
- npm (comes with Node.js)

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:5173. You land on the sign-in screen. Open "Demo accounts" and click a role to fill the form (password for all: `Poultry@123`). (`/setup-check` is the Phase 1 test page; `/design-system` is the Phase 2 component showcase and needs you to be signed in.)

## Other commands
```bash
npm run build     # production build into /dist
npm run preview   # serve the production build locally
```

## Environment variables
Copy `.env.example` to `.env` (already done in the zip). Only variables starting with `VITE_` reach the browser.

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Express API base URL (used from later phases) |
| `VITE_APP_NAME` | App name shown in the UI |

## Folder structure
```
src/
  app/          App.jsx and routes.jsx (ProtectedRoute arrives in Phase 3/4)
  assets/       images and static files
  components/   common, forms, tables, charts, layout (Phase 2+)
  layouts/      AuthLayout, DashboardLayout (Phase 3)
  pages/        one folder per module
  features/     module-specific logic (Phase 4+)
  services/     api.js (Axios instance) and endpoints/
  context/      AuthContext, FarmContext (Phase 4/5)
  hooks/        custom hooks
  utils/        helpers and config.js
  styles/       variables.css, base.css, utilities.css
```

## Styling approach
Plain CSS with design tokens in `src/styles/variables.css`. One CSS file per component or page, placed next to it.

## Git
```bash
git init
git add .
git commit -m "Phase 1: project setup and React foundation"
```

## Shared components (Phase 2)
All live in `src/components`. Import them directly, for example `import Button from '../components/common/Button.jsx'`.

| Folder | Components |
| --- | --- |
| `common/` | Button, IconButton, Icon, Badge, StatusBadge, Card, MetricCard, Modal, ConfirmDialog, Spinner, LoadingState, EmptyState, ErrorState, ToastViewport |
| `forms/` | Input, Select, DateInput, Textarea, Checkbox, Switch, SearchInput, FormField |
| `tables/` | DataTable, Pagination |
| `charts/` | ChartContainer |

Also added: `context/ToastContext.jsx` (`useToast()`), `hooks/useClientTable.js` (sorting and paging for mock data), and `utils/` helpers (`classNames`, `validators`, `formatters`, `pagination`).

Toast usage:
```jsx
const toast = useToast();
toast.success('Saved');
toast.error('Could not save', { title: 'Save failed' });
```

## App shell and routing (Phase 3)
- `src/config/modules.js` describes every page once (label, path, icon, permission, phase). The sidebar and the route table are both generated from it.
- `src/config/permissions.js` holds the permission codes. `src/config/roles.js` maps each role to its permissions (temporary: the backend will return permissions later).
- `src/app/ProtectedRoute.jsx` redirects signed-out users to `/login` and shows the Access denied page when a permission is missing.
- Layouts: `AuthLayout` (login pages) and `DashboardLayout` (sidebar, top bar, breadcrumbs, page title).
- Sidebar is permanent on screens 1024px and wider, and a slide-in drawer on tablet and mobile.

Add a real page later:
1. Build the page component.
2. Import it in `src/app/routes.jsx` and add one line to `PAGE_REGISTRY`, for example `users: UsersPage`.

Add a new menu item: add an entry to `MODULES` in `src/config/modules.js` (and a permission code if needed).

## Authentication and users (Phase 4)
- The login form validates required fields and email format, and shows clear messages for wrong password and deactivated accounts.
- `src/context/AuthContext.jsx` holds the signed-in user. It restores a saved session on page load, and shows a "session ended" notice on the login page if that fails.
- The mock backend is in `src/services/mock/` with seed data in `src/mock/seedUsers.js`. The UI only imports `src/services/authService.js` and `src/services/userService.js`. Replace the bodies of those two files with Axios calls when the Express API exists.
- Permission-aware UI: use `<Can permission={PERMISSIONS.USERS_MANAGE}>...</Can>` or `hasPermission(code)` from `useAuth()`. Never check role names.
- A user with no role signs in but only sees the Access pending screen.
- Users page (`/users`, Owner only by default): search, role and status filters, add and edit users, change role (with a preview of what the role can open), activate and deactivate. Users and role changes are saved in the browser (localStorage) so they survive a refresh. To reset to the seed data, run `localStorage.clear()` in the browser console and reload.
- Safeguards in the mock service: you cannot deactivate yourself or change your own role, and the last active Owner cannot be deactivated or demoted.

Demo accounts (password `Poultry@123`): owner@, production@, farm@, operations@, doctor@ (all `@poultry.test`), plus kamran@ (deactivated) and zoya@ (no role) to test those cases.

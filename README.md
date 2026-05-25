# Task Compass

A mobile-first personal and professional task manager built with React, Vite, Airtable, and a secure API bridge.

## What is included

- Airtable sync through `/api/tasks` when server environment variables are configured.
- Local demo mode when Airtable is not configured.
- Optional private app access code.
- Automatic Airtable field matching for common names like `Name`, `Description`, and `Deadline`.
- Today focus, personal, professional, upcoming, overdue, and completed views.
- Rich task editing with notes, aspect, area, status, priority, due date, tags, subtasks, and recurring flag.
- In-app reminders for due today and overdue tasks.
- Mobile-first bottom navigation and drawer-style task editor.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. For local UI-only testing, start the app:

   ```bash
   npm run dev
   ```

   Without the Airtable API bridge, the app uses browser storage.

## Airtable setup

1. Create an Airtable base and table using `airtable-setup.md`.
2. Create an Airtable Personal Access Token.
3. Deploy to Vercel.
4. Add these Vercel environment variables:

   - `AIRTABLE_TOKEN`
   - `AIRTABLE_SOURCES`
   - `APP_ACCESS_CODE` optional, protects the app API with a private code

Optional field overrides can be added if your Airtable field names are custom:

- `AIRTABLE_FIELD_TITLE`
- `AIRTABLE_FIELD_NOTES`
- `AIRTABLE_FIELD_ASPECT`
- `AIRTABLE_FIELD_AREA`
- `AIRTABLE_FIELD_STATUS`
- `AIRTABLE_FIELD_PRIORITY`
- `AIRTABLE_FIELD_DUE_DATE`
- `AIRTABLE_FIELD_TAGS`
- `AIRTABLE_FIELD_SUBTASKS`
- `AIRTABLE_FIELD_IS_RECURRING`
- `AIRTABLE_FIELD_CREATED_AT`
- `AIRTABLE_FIELD_UPDATED_AT`
- `AIRTABLE_FIELD_COMPLETED_AT`

The Airtable token must stay server-side. The React app calls `/api/tasks`; it never receives the token.

## Multiple Airtable sources

Use `AIRTABLE_SOURCES` to connect more than one table or base:

```text
Tasks|appBaseId|Tasks|tasks;Projects|appBaseId|Projects|projects;Things Done|appBaseId|Things that I did|activity
```

Each source has four parts separated by `|`:

- Display label shown in the app
- Airtable base ID
- Airtable table name
- Role: `tasks`, `projects`, or `activity`

Separate multiple sources with `;`.

Only sources with the `tasks` role are shown as task records. `projects` and `activity` sources are used as related context.

The older single-source variables `AIRTABLE_BASE_ID` and `AIRTABLE_TABLE_NAME` still work if `AIRTABLE_SOURCES` is not set.

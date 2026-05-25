# Task Compass

A mobile-first personal and professional task manager built with React, Vite, Airtable, and a secure API bridge.

## What is included

- Airtable sync through `/api/tasks` when server environment variables are configured.
- Local demo mode when Airtable is not configured.
- Optional private app access code.
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
   - `AIRTABLE_BASE_ID`
   - `AIRTABLE_TABLE_NAME` optional, defaults to `Tasks`
   - `APP_ACCESS_CODE` optional, protects the app API with a private code

The Airtable token must stay server-side. The React app calls `/api/tasks`; it never receives the token.

# Airtable Setup

Create one Airtable base with a table named `Tasks`.

Add these fields:

| Field name | Airtable type |
| --- | --- |
| Title | Single line text |
| Notes | Long text |
| Aspect | Single select: `personal`, `professional` |
| Area | Single line text |
| Status | Single select: `inbox`, `today`, `scheduled`, `waiting`, `done` |
| Priority | Single select: `low`, `medium`, `high` |
| Due Date | Date |
| Tags | Single line text |
| Subtasks | Long text |
| Recurring | Checkbox |
| Created At | Date with time |
| Updated At | Date with time |
| Completed At | Date with time |

Then create an Airtable Personal Access Token with access to this base and these scopes:

- `data.records:read`
- `data.records:write`
- `schema.bases:read`

Use the token only as a server-side environment variable. Do not paste it into browser code.

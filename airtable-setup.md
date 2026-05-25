# Airtable Setup

Create one Airtable base with a table named `Tasks`, or configure one or more existing tables with `AIRTABLE_SOURCES`.

The app now tries to adapt to your existing Airtable schema. For example, it can use `Name` as the task title field and `Description` as notes. Fields that do not exist are skipped.

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

## Existing Airtable tables

If your field names are different, add environment variables in Vercel to map them.

Examples:

```text
AIRTABLE_FIELD_TITLE=Name
AIRTABLE_FIELD_NOTES=Description
AIRTABLE_FIELD_DUE_DATE=Deadline
```

The title field is required. Optional fields can be left out of Airtable; the app will keep defaults for anything it cannot find.

## Multiple bases or tables

Set `AIRTABLE_SOURCES` in Vercel:

```text
Personal Tasks|appFirstBaseId|Tasks;Work Tasks|appSecondBaseId|Tasks
```

The token must have access to every base listed in `AIRTABLE_SOURCES`.

const AIRTABLE_API_URL = 'https://api.airtable.com/v0';
const AIRTABLE_META_URL = 'https://api.airtable.com/v0/meta';
const FIELD_ALIASES = {
  title: ['Title', 'Name', 'Task', 'Task Name', 'Summary'],
  notes: ['Notes', 'Description', 'Details', 'Context'],
  aspect: ['Aspect', 'Category', 'Type', 'Domain'],
  area: ['Area', 'Project', 'Area or Project', 'Project Name'],
  status: ['Status', 'State', 'Stage'],
  priority: ['Priority', 'Importance'],
  due_date: ['Due Date', 'Due', 'Deadline', 'Date'],
  tags: ['Tags', 'Tag', 'Labels'],
  subtasks: ['Subtasks', 'Sub Tasks', 'Checklist'],
  is_recurring: ['Recurring', 'Repeating', 'Repeat'],
  created_at: ['Created At', 'Created', 'Created Time'],
  updated_at: ['Updated At', 'Updated', 'Last Modified'],
  completed_at: ['Completed At', 'Completed', 'Done At'],
};

function requireConfig() {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || 'Tasks';

  if (!token || !baseId) {
    throw new Error('Airtable is not configured. Add AIRTABLE_TOKEN and AIRTABLE_BASE_ID.');
  }

  return { token, baseId, tableName };
}

function checkAccessCode(req) {
  const requiredCode = process.env.APP_ACCESS_CODE;
  if (!requiredCode) return true;

  return req.headers['x-app-code'] === requiredCode;
}

function airtableUrl(config, recordId = '') {
  const table = encodeURIComponent(config.tableName);
  const suffix = recordId ? `/${recordId}` : '';
  return `${AIRTABLE_API_URL}/${config.baseId}/${table}${suffix}`;
}

function metadataUrl(config) {
  return `${AIRTABLE_META_URL}/bases/${config.baseId}/tables`;
}

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeOption(value, fallback, allowed) {
  if (!value) return fallback;
  const normalized = String(value).trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function getField(fields, fieldMap, key) {
  const fieldName = fieldMap[key];
  return fieldName ? fields[fieldName] : undefined;
}

function setField(fields, fieldMap, key, value) {
  const fieldName = fieldMap[key];
  if (fieldName) fields[fieldName] = value;
}

function recordToTask(record, fieldMap) {
  const fields = record.fields || {};
  const now = new Date().toISOString();

  return {
    id: record.id,
    title: getField(fields, fieldMap, 'title') || '',
    notes: getField(fields, fieldMap, 'notes') || '',
    aspect: normalizeOption(getField(fields, fieldMap, 'aspect'), 'personal', [
      'personal',
      'professional',
    ]),
    area: getField(fields, fieldMap, 'area') || '',
    status: normalizeOption(getField(fields, fieldMap, 'status'), 'inbox', [
      'inbox',
      'today',
      'scheduled',
      'waiting',
      'done',
    ]),
    priority: normalizeOption(getField(fields, fieldMap, 'priority'), 'medium', [
      'low',
      'medium',
      'high',
    ]),
    due_date: getField(fields, fieldMap, 'due_date') || '',
    tags: parseList(getField(fields, fieldMap, 'tags')),
    subtasks: parseJson(getField(fields, fieldMap, 'subtasks'), []),
    is_recurring: Boolean(getField(fields, fieldMap, 'is_recurring')),
    created_at: getField(fields, fieldMap, 'created_at') || now,
    updated_at: getField(fields, fieldMap, 'updated_at') || now,
    completed_at: getField(fields, fieldMap, 'completed_at') || null,
  };
}

function taskToFields(task, fieldMap) {
  const fields = {};
  setField(fields, fieldMap, 'title', task.title);
  setField(fields, fieldMap, 'notes', task.notes || '');
  setField(fields, fieldMap, 'aspect', task.aspect || 'personal');
  setField(fields, fieldMap, 'area', task.area || '');
  setField(fields, fieldMap, 'status', task.status || 'inbox');
  setField(fields, fieldMap, 'priority', task.priority || 'medium');
  setField(fields, fieldMap, 'due_date', task.due_date || null);
  setField(fields, fieldMap, 'tags', (task.tags || []).join(', '));
  setField(fields, fieldMap, 'subtasks', JSON.stringify(task.subtasks || []));
  setField(fields, fieldMap, 'is_recurring', Boolean(task.is_recurring));
  setField(fields, fieldMap, 'created_at', task.created_at || new Date().toISOString());
  setField(fields, fieldMap, 'updated_at', task.updated_at || new Date().toISOString());
  setField(fields, fieldMap, 'completed_at', task.completed_at || null);
  return fields;
}

async function callAirtable(config, path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      authorization: `Bearer ${config.token}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || payload.error || 'Airtable request failed.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function getFieldMap(config) {
  const payload = await callAirtable(config, metadataUrl(config));
  const table = (payload.tables || []).find((item) => item.name === config.tableName);

  if (!table) {
    throw new Error(`Airtable table "${config.tableName}" was not found.`);
  }

  const names = new Set(table.fields.map((field) => field.name));
  const fieldMap = {};

  for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
    const envName = process.env[`AIRTABLE_FIELD_${key.toUpperCase()}`];
    if (envName && names.has(envName)) {
      fieldMap[key] = envName;
      continue;
    }

    const matched = aliases.find((alias) => names.has(alias));
    if (matched) fieldMap[key] = matched;
  }

  const primaryField = table.fields.find((field) => field.id === table.primaryFieldId);
  if (!fieldMap.title && primaryField) {
    fieldMap.title = primaryField.name;
  }

  if (!fieldMap.title) {
    throw new Error('Could not find a title/name field in your Airtable table.');
  }

  return fieldMap;
}

async function listTasks(config, fieldMap) {
  const tasks = [];
  let offset = '';

  do {
    const url = new URL(airtableUrl(config));
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);

    const payload = await callAirtable(config, url.toString());
    tasks.push(...(payload.records || []).map((record) => recordToTask(record, fieldMap)));
    offset = payload.offset;
  } while (offset);

  return tasks;
}

function send(res, status, payload) {
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (!checkAccessCode(req)) {
    send(res, 401, { error: 'Enter the private app access code.' });
    return;
  }

  let config;
  try {
    config = requireConfig();
  } catch (error) {
    send(res, 503, { error: error.message });
    return;
  }

  try {
    const fieldMap = await getFieldMap(config);

    if (req.method === 'GET') {
      const tasks = await listTasks(config, fieldMap);
      send(res, 200, { tasks });
      return;
    }

    if (req.method === 'POST') {
      const now = new Date().toISOString();
      const task = { ...req.body, created_at: now, updated_at: now };
      const payload = await callAirtable(config, airtableUrl(config), {
        method: 'POST',
        body: JSON.stringify({ fields: taskToFields(task, fieldMap) }),
      });
      send(res, 200, { task: recordToTask(payload, fieldMap) });
      return;
    }

    if (req.method === 'PATCH') {
      const task = { ...req.body, updated_at: new Date().toISOString() };
      const payload = await callAirtable(config, airtableUrl(config, task.id), {
        method: 'PATCH',
        body: JSON.stringify({ fields: taskToFields(task, fieldMap) }),
      });
      send(res, 200, { task: recordToTask(payload, fieldMap) });
      return;
    }

    if (req.method === 'DELETE') {
      const taskId = req.query.id;
      if (!taskId) {
        send(res, 400, { error: 'Missing task id.' });
        return;
      }

      await callAirtable(config, airtableUrl(config, taskId), { method: 'DELETE' });
      send(res, 200, { ok: true });
      return;
    }

    send(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    send(res, error.status || 500, { error: error.message });
  }
}

const AIRTABLE_API_URL = 'https://api.airtable.com/v0';
const FIELD_NAMES = {
  title: 'Title',
  notes: 'Notes',
  aspect: 'Aspect',
  area: 'Area',
  status: 'Status',
  priority: 'Priority',
  due_date: 'Due Date',
  tags: 'Tags',
  subtasks: 'Subtasks',
  is_recurring: 'Recurring',
  created_at: 'Created At',
  updated_at: 'Updated At',
  completed_at: 'Completed At',
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

function recordToTask(record) {
  const fields = record.fields || {};
  const now = new Date().toISOString();

  return {
    id: record.id,
    title: fields[FIELD_NAMES.title] || '',
    notes: fields[FIELD_NAMES.notes] || '',
    aspect: fields[FIELD_NAMES.aspect] || 'personal',
    area: fields[FIELD_NAMES.area] || '',
    status: fields[FIELD_NAMES.status] || 'inbox',
    priority: fields[FIELD_NAMES.priority] || 'medium',
    due_date: fields[FIELD_NAMES.due_date] || '',
    tags: parseList(fields[FIELD_NAMES.tags]),
    subtasks: parseJson(fields[FIELD_NAMES.subtasks], []),
    is_recurring: Boolean(fields[FIELD_NAMES.is_recurring]),
    created_at: fields[FIELD_NAMES.created_at] || now,
    updated_at: fields[FIELD_NAMES.updated_at] || now,
    completed_at: fields[FIELD_NAMES.completed_at] || null,
  };
}

function taskToFields(task) {
  return {
    [FIELD_NAMES.title]: task.title,
    [FIELD_NAMES.notes]: task.notes || '',
    [FIELD_NAMES.aspect]: task.aspect || 'personal',
    [FIELD_NAMES.area]: task.area || '',
    [FIELD_NAMES.status]: task.status || 'inbox',
    [FIELD_NAMES.priority]: task.priority || 'medium',
    [FIELD_NAMES.due_date]: task.due_date || null,
    [FIELD_NAMES.tags]: (task.tags || []).join(', '),
    [FIELD_NAMES.subtasks]: JSON.stringify(task.subtasks || []),
    [FIELD_NAMES.is_recurring]: Boolean(task.is_recurring),
    [FIELD_NAMES.created_at]: task.created_at || new Date().toISOString(),
    [FIELD_NAMES.updated_at]: task.updated_at || new Date().toISOString(),
    [FIELD_NAMES.completed_at]: task.completed_at || null,
  };
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

async function listTasks(config) {
  const tasks = [];
  let offset = '';

  do {
    const url = new URL(airtableUrl(config));
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);

    const payload = await callAirtable(config, url.toString());
    tasks.push(...(payload.records || []).map(recordToTask));
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
    if (req.method === 'GET') {
      const tasks = await listTasks(config);
      send(res, 200, { tasks });
      return;
    }

    if (req.method === 'POST') {
      const now = new Date().toISOString();
      const task = { ...req.body, created_at: now, updated_at: now };
      const payload = await callAirtable(config, airtableUrl(config), {
        method: 'POST',
        body: JSON.stringify({ fields: taskToFields(task) }),
      });
      send(res, 200, { task: recordToTask(payload) });
      return;
    }

    if (req.method === 'PATCH') {
      const task = { ...req.body, updated_at: new Date().toISOString() };
      const payload = await callAirtable(config, airtableUrl(config, task.id), {
        method: 'PATCH',
        body: JSON.stringify({ fields: taskToFields(task) }),
      });
      send(res, 200, { task: recordToTask(payload) });
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

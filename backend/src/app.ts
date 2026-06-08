import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { members } from './routes/members.js';
import { holidays } from './routes/holidays.js';
import { tasks } from './routes/tasks.js';
import { projects } from './routes/projects.js';
import { requirements } from './routes/requirements.js';
import { dailyReports } from './routes/dailyReports.js';
import { referenceProjects } from './routes/referenceProjects.js';
import { settings } from './routes/settings.js';
import { fsBrowse } from './routes/fs.js';

// アプリ生成を関数化してテスト(app.request)から再利用できるようにする。
export function createApp() {
  const app = new Hono();

  app.use('*', cors());

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  app.route('/api/projects', projects);
  app.route('/api/requirements', requirements);
  app.route('/api/daily-reports', dailyReports);
  app.route('/api/reference-projects', referenceProjects);
  app.route('/api/settings', settings);
  app.route('/api/fs', fsBrowse);
  app.route('/api/members', members);
  app.route('/api/holidays', holidays);
  app.route('/api/tasks', tasks);

  app.notFound((c) => c.json({ error: 'Not Found' }, 404));

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    console.error(err);
    return c.json({ error: 'Internal Server Error' }, 500);
  });

  return app;
}

export const app = createApp();

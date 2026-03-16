import request from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { Role, User, ProductionSite, AssemblyLine, TechNode, TelemetryRecord, Alert, Command, Session } from '../src/models';

// Routes
import authRoutes from '../src/routes/auth';
import usersRoutes from '../src/routes/users';
import sitesRoutes from '../src/routes/sites';
import linesRoutes from '../src/routes/lines';
import nodesRoutes from '../src/routes/nodes';
import telemetryRoutes from '../src/routes/telemetry';
import alertsRoutes from '../src/routes/alerts';
import commandsRoutes from '../src/routes/commands';

// Build test app (without socket.io and simulator)
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/lines', linesRoutes);
app.use('/api/nodes', nodesRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/commands', commandsRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

let adminToken: string;
let operatorToken: string;
let siteId: string;
let lineId: string;
let nodeId: string;
let alertId: string;

// ─── Setup & Teardown ────────────────────────────────────────

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alc_test');
  // Clean DB
  await Promise.all([
    Role.deleteMany({}), User.deleteMany({}), Session.deleteMany({}),
    ProductionSite.deleteMany({}), AssemblyLine.deleteMany({}), TechNode.deleteMany({}),
    TelemetryRecord.deleteMany({}), Alert.deleteMany({}), Command.deleteMany({}),
  ]);

  // Seed roles
  const adminRole = await Role.create({ name: 'admin', permissions: ['read', 'write', 'delete', 'manage_users'] });
  const operatorRole = await Role.create({ name: 'operator', permissions: ['read', 'write'] });
  await Role.create({ name: 'viewer', permissions: ['read'] });

  // Seed users
  const hash = await bcrypt.hash('test123', 10);
  await User.create({ username: 'testadmin', password_hash: hash, role_id: adminRole._id });
  await User.create({ username: 'testoperator', password_hash: hash, role_id: operatorRole._id });
});

afterAll(async () => {
  // Clean test DB
  await Promise.all([
    Role.deleteMany({}), User.deleteMany({}), Session.deleteMany({}),
    ProductionSite.deleteMany({}), AssemblyLine.deleteMany({}), TechNode.deleteMany({}),
    TelemetryRecord.deleteMany({}), Alert.deleteMany({}), Command.deleteMany({}),
  ]);
  await mongoose.disconnect();
});

// ─── 1. Health Check ──────────────────────────────────────────

describe('Health Check', () => {
  it('GET /api/health — должен вернуть status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ─── 2. Аутентификация ───────────────────────────────────────

describe('Аутентификация (/api/auth)', () => {
  it('POST /api/auth/login — ошибка без данных', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login — ошибка с неверным паролем', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login — успешный вход admin', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'test123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    adminToken = res.body.token;
  });

  it('POST /api/auth/login — успешный вход operator', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'testoperator', password: 'test123' });
    expect(res.status).toBe(200);
    operatorToken = res.body.token;
  });

  it('GET /api/auth/me — возвращает текущего пользователя', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('testadmin');
  });

  it('GET /api/auth/me — 401 без токена', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/logout — успешный выход', async () => {
    // Login again to get a disposable token
    const loginRes = await request(app).post('/api/auth/login').send({ username: 'testadmin', password: 'test123' });
    const tempToken = loginRes.body.token;
    const res = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${tempToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });
});

// ─── 3. Управление пользователями ────────────────────────────

describe('Пользователи (/api/users)', () => {
  it('GET /api/users — 403 для оператора (не admin)', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/users — список пользователей для admin', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('POST /api/users — создание пользователя', async () => {
    const res = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'newviewer', password: 'pass123', role_name: 'viewer' });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('newviewer');
  });

  it('POST /api/users — 409 дубликат', async () => {
    const res = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'newviewer', password: 'pass123', role_name: 'viewer' });
    expect(res.status).toBe(409);
  });

  it('DELETE /api/users/:id — удаление пользователя', async () => {
    const user = await User.findOne({ username: 'newviewer' });
    const res = await request(app).delete(`/api/users/${user!._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

// ─── 4. Производственные площадки ─────────────────────────────

describe('Площадки (/api/sites)', () => {
  it('POST /api/sites — создание площадки', async () => {
    const res = await request(app).post('/api/sites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Тестовый завод', location: 'Москва' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Тестовый завод');
    siteId = res.body._id;
  });

  it('GET /api/sites — список площадок', async () => {
    const res = await request(app).get('/api/sites').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/sites/:id — площадка по ID', async () => {
    const res = await request(app).get(`/api/sites/${siteId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Тестовый завод');
  });

  it('PUT /api/sites/:id — обновление', async () => {
    const res = await request(app).put(`/api/sites/${siteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ location: 'Санкт-Петербург' });
    expect(res.status).toBe(200);
    expect(res.body.location).toBe('Санкт-Петербург');
  });
});

// ─── 5. Сборочные линии ──────────────────────────────────────

describe('Линии (/api/lines)', () => {
  it('POST /api/lines — создание линии', async () => {
    const res = await request(app).post('/api/lines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ site_id: siteId, name: 'Линия-А', status: 'active' });
    expect(res.status).toBe(201);
    lineId = res.body._id;
  });

  it('GET /api/lines?site_id — фильтрация по площадке', async () => {
    const res = await request(app).get(`/api/lines?site_id=${siteId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Линия-А');
  });
});

// ─── 6. Технологические узлы ─────────────────────────────────

describe('Узлы (/api/nodes)', () => {
  it('POST /api/nodes — создание узла с параметрами', async () => {
    const res = await request(app).post('/api/nodes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        line_id: lineId,
        name: 'Конвейер-1',
        type: 'conveyor',
        ip_address: '192.168.1.50',
        parameters: [
          { name: 'Скорость', unit: 'м/мин', min_value: 5, max_value: 25, update_interval_sec: 5 },
          { name: 'Температура', unit: '°C', min_value: 15, max_value: 45, update_interval_sec: 10 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.parameters.length).toBe(2);
    nodeId = res.body._id;
  });

  it('GET /api/nodes — список узлов', async () => {
    const res = await request(app).get('/api/nodes').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/nodes/:id — узел по ID', async () => {
    const res = await request(app).get(`/api/nodes/${nodeId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Конвейер-1');
    expect(res.body.status).toBe('online');
  });

  it('GET /api/nodes?status=online — фильтр по статусу', async () => {
    const res = await request(app).get('/api/nodes?status=online').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every((n: any) => n.status === 'online')).toBe(true);
  });
});

// ─── 7. Телеметрия ───────────────────────────────────────────

describe('Телеметрия (/api/telemetry)', () => {
  let paramId: string;

  it('Подготовка: получить param_id', async () => {
    const node = await TechNode.findById(nodeId);
    paramId = node!.parameters[0].param_id.toString();
    expect(paramId).toBeDefined();
  });

  it('POST /api/telemetry — запись телеметрии (норма)', async () => {
    const res = await request(app).post('/api/telemetry')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ node_id: nodeId, param_id: paramId, value: 15.5, quality_flag: 'good' });
    expect(res.status).toBe(201);
    expect(res.body.value).toBe(15.5);
  });

  it('POST /api/telemetry — запись с превышением порога создаёт Alert', async () => {
    const res = await request(app).post('/api/telemetry')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ node_id: nodeId, param_id: paramId, value: 50 });
    expect(res.status).toBe(201);

    // Check alert was created
    const alerts = await Alert.find({ node_id: nodeId });
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    alertId = alerts[0]._id.toString();
  });

  it('GET /api/telemetry — получение записей с фильтрами', async () => {
    const res = await request(app)
      .get(`/api/telemetry?node_id=${nodeId}&limit=10`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/telemetry/latest/:node_id — последние значения', async () => {
    const res = await request(app)
      .get(`/api/telemetry/latest/${nodeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2); // 2 parameters
    expect(res.body[0].value).toBeDefined();
  });

  it('POST /api/telemetry — 400 без обязательных полей', async () => {
    const res = await request(app).post('/api/telemetry')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ node_id: nodeId });
    expect(res.status).toBe(400);
  });
});

// ─── 8. Алармы ───────────────────────────────────────────────

describe('Алармы (/api/alerts)', () => {
  it('GET /api/alerts — список алармов', async () => {
    const res = await request(app).get('/api/alerts').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/alerts/:id — аларм по ID', async () => {
    const res = await request(app).get(`/api/alerts/${alertId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.severity).toBeDefined();
  });

  it('PATCH /api/alerts/:id/acknowledge — подтверждение', async () => {
    const res = await request(app)
      .patch(`/api/alerts/${alertId}/acknowledge`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('acknowledged');
  });

  it('PATCH /api/alerts/:id/resolve — разрешение', async () => {
    const res = await request(app)
      .patch(`/api/alerts/${alertId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');
    expect(res.body.resolved_at).toBeDefined();
  });
});

// ─── 9. Команды управления ───────────────────────────────────

describe('Команды (/api/commands)', () => {
  let commandId: string;

  it('POST /api/commands — отправка команды', async () => {
    const res = await request(app).post('/api/commands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ node_id: nodeId, action_type: 'restart' });
    expect(res.status).toBe(201);
    expect(res.body.action_type).toBe('restart');
    expect(res.body.status).toBe('pending');
    commandId = res.body._id;
  });

  it('GET /api/commands — список команд', async () => {
    const res = await request(app).get('/api/commands').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/commands/:id — команда по ID', async () => {
    const res = await request(app).get(`/api/commands/${commandId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.action_type).toBe('restart');
  });

  it('POST /api/commands — 400 без обязательных полей', async () => {
    const res = await request(app).post('/api/commands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ node_id: nodeId });
    expect(res.status).toBe(400);
  });
});

// ─── 10. Авторизация по ролям ────────────────────────────────

describe('Контроль доступа по ролям', () => {
  it('Оператор НЕ может управлять пользователями', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(403);
  });

  it('Оператор МОЖЕТ отправлять команды', async () => {
    const res = await request(app).post('/api/commands')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ node_id: nodeId, action_type: 'diagnostics' });
    expect(res.status).toBe(201);
  });

  it('Оператор МОЖЕТ просматривать узлы', async () => {
    const res = await request(app).get('/api/nodes').set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(200);
  });

  it('Без токена — 401 на все защищённые роуты', async () => {
    const routes = ['/api/users', '/api/sites', '/api/nodes', '/api/telemetry', '/api/alerts', '/api/commands'];
    for (const route of routes) {
      const res = await request(app).get(route);
      expect(res.status).toBe(401);
    }
  });
});

// ─── 11. Каскадная проверка (E2E сценарий) ───────────────────

describe('E2E: полный цикл работы системы', () => {
  it('Создание площадки → линия → узел → телеметрия → аларм → подтверждение → разрешение', async () => {
    // 1. Площадка
    const site = await request(app).post('/api/sites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Завод', location: 'Тестград' });
    expect(site.status).toBe(201);

    // 2. Линия
    const line = await request(app).post('/api/lines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ site_id: site.body._id, name: 'E2E Линия' });
    expect(line.status).toBe(201);

    // 3. Узел
    const node = await request(app).post('/api/nodes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        line_id: line.body._id, name: 'E2E Станок', type: 'press',
        ip_address: '10.0.0.99',
        parameters: [{ name: 'Давление', unit: 'бар', min_value: 2, max_value: 10, update_interval_sec: 5 }],
      });
    expect(node.status).toBe(201);

    const pid = node.body.parameters[0].param_id;

    // 4. Нормальная телеметрия
    const t1 = await request(app).post('/api/telemetry')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ node_id: node.body._id, param_id: pid, value: 6.0 });
    expect(t1.status).toBe(201);

    // 5. Аварийная телеметрия → аларм
    const t2 = await request(app).post('/api/telemetry')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ node_id: node.body._id, param_id: pid, value: 15.0 });
    expect(t2.status).toBe(201);

    const alertsRes = await request(app)
      .get(`/api/alerts?node_id=${node.body._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(alertsRes.body.length).toBeGreaterThanOrEqual(1);

    const a = alertsRes.body[0];

    // 6. Подтвердить аларм
    const ack = await request(app)
      .patch(`/api/alerts/${a._id}/acknowledge`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ack.body.status).toBe('acknowledged');

    // 7. Разрешить аларм
    const resolve = await request(app)
      .patch(`/api/alerts/${a._id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resolve.body.status).toBe('resolved');

    // 8. Отправить команду рестарт
    const cmd = await request(app).post('/api/commands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ node_id: node.body._id, action_type: 'restart' });
    expect(cmd.status).toBe(201);

    // 9. Удалить площадку
    const del = await request(app).delete(`/api/sites/${site.body._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);
  });
});

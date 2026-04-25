import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { Role, User, ProductionSite, AssemblyLine, TechNode, TelemetryRecord, Alert, Command } from '../models';

async function seed() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB, seeding...');

  // Clear all collections
  await Promise.all([
    Role.deleteMany({}),
    User.deleteMany({}),
    ProductionSite.deleteMany({}),
    AssemblyLine.deleteMany({}),
    TechNode.deleteMany({}),
    TelemetryRecord.deleteMany({}),
    Alert.deleteMany({}),
    Command.deleteMany({}),
  ]);

  // === ROLES ===
  const roles = await Role.insertMany([
    { name: 'admin', permissions: ['read', 'write', 'delete', 'manage_users', 'manage_system'] },
    { name: 'engineer', permissions: ['read', 'write', 'manage_nodes', 'resolve_alerts'] },
    { name: 'operator', permissions: ['read', 'acknowledge_alerts', 'send_commands'] },
  ]);
  console.log('Roles created');

  const adminRole = roles.find(r => r.name === 'admin')!;
  const engineerRole = roles.find(r => r.name === 'engineer')!;
  const operatorRole = roles.find(r => r.name === 'operator')!;

  // === USERS ===
  const passwordHash = await bcrypt.hash('password123', 10);
  const users = await User.insertMany([
    { username: 'admin', password_hash: passwordHash, role_id: adminRole._id },
    { username: 'engineer1', password_hash: passwordHash, role_id: engineerRole._id },
    { username: 'engineer2', password_hash: passwordHash, role_id: engineerRole._id },
    { username: 'operator1', password_hash: passwordHash, role_id: operatorRole._id },
    { username: 'operator2', password_hash: passwordHash, role_id: operatorRole._id },
    { username: 'operator3', password_hash: passwordHash, role_id: operatorRole._id },
  ]);
  console.log('Users created (password: password123)');

  const adminUser = users[0];
  const engineer1 = users[1];
  const engineer2 = users[2];
  const operator1 = users[3];
  const operator2 = users[4];
  const operator3 = users[5];

  // === PRODUCTION SITES ===
  const sites = await ProductionSite.insertMany([
    { name: 'Завод №1 — Москва', location: 'г. Москва, ул. Промышленная, 15', created_by: adminUser._id },
    { name: 'Завод №2 — Тольятти', location: 'г. Тольятти, ул. Заводская, 42', created_by: engineer1._id },
    { name: 'Завод №3 — Казань', location: 'г. Казань, ул. Техническая, 7', created_by: engineer2._id },
    { name: 'Завод №4 — Нижний Новгород', location: 'г. Нижний Новгород, ул. Моторная, 3', created_by: operator1._id },
    { name: 'Завод №5 — Самара', location: 'г. Самара, ул. Кузнечная, 12', created_by: operator2._id },
  ]);
  console.log('Production sites created');

  // === ASSEMBLY LINES ===
  const lines = await AssemblyLine.insertMany([
    { site_id: sites[0]._id, name: 'Линия сборки кузовов A1', status: 'active', created_by: adminUser._id },
    { site_id: sites[0]._id, name: 'Линия сварки B1', status: 'active', created_by: adminUser._id },
    { site_id: sites[0]._id, name: 'Линия покраски C1', status: 'maintenance', created_by: adminUser._id },
    { site_id: sites[1]._id, name: 'Линия сборки двигателей A2', status: 'active', created_by: engineer1._id },
    { site_id: sites[1]._id, name: 'Линия тестирования D2', status: 'active', created_by: engineer1._id },
    { site_id: sites[2]._id, name: 'Линия электроники E3', status: 'active', created_by: engineer2._id },
    { site_id: sites[3]._id, name: 'Линия сборки F4', status: 'active', created_by: operator1._id },
    { site_id: sites[4]._id, name: 'Линия штамповки G5', status: 'active', created_by: operator2._id },
  ]);
  console.log('Assembly lines created');

  // === TECH NODES ===
  const nodesDefs = [
    {
      line_id: lines[0]._id, name: 'Робот-сварщик RW-001', type: 'welding_robot',
      ip_address: '192.168.1.10', created_by: adminUser._id,
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура', unit: '°C', min_value: 20, max_value: 800, update_interval_sec: 5 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Ток сварки', unit: 'A', min_value: 50, max_value: 400, update_interval_sec: 2 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Скорость подачи проволоки', unit: 'м/мин', min_value: 1, max_value: 25, update_interval_sec: 5 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Давление газа', unit: 'бар', min_value: 0.5, max_value: 3, update_interval_sec: 10 },
      ],
    },
    {
      line_id: lines[0]._id, name: 'Конвейер CV-001', type: 'conveyor',
      ip_address: '192.168.1.11', created_by: adminUser._id,
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Скорость ленты', unit: 'м/с', min_value: 0.1, max_value: 2.5, update_interval_sec: 3 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Нагрузка', unit: 'кг', min_value: 0, max_value: 5000, update_interval_sec: 5 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Вибрация', unit: 'мм/с', min_value: 0, max_value: 10, update_interval_sec: 10 },
      ],
    },
    {
      line_id: lines[1]._id, name: 'Сварочный аппарат WM-001', type: 'welding_machine',
      ip_address: '192.168.1.20', created_by: adminUser._id,
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Напряжение дуги', unit: 'В', min_value: 15, max_value: 40, update_interval_sec: 2 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура наконечника', unit: '°C', min_value: 100, max_value: 1200, update_interval_sec: 5 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Расход защитного газа', unit: 'л/мин', min_value: 5, max_value: 25, update_interval_sec: 10 },
      ],
    },
    {
      line_id: lines[2]._id, name: 'Камера покраски PC-001', type: 'paint_chamber',
      ip_address: '192.168.1.30', created_by: adminUser._id,
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура камеры', unit: '°C', min_value: 18, max_value: 35, update_interval_sec: 10 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Влажность', unit: '%', min_value: 40, max_value: 70, update_interval_sec: 10 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Давление распыления', unit: 'бар', min_value: 2, max_value: 6, update_interval_sec: 5 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Толщина покрытия', unit: 'мкм', min_value: 20, max_value: 120, update_interval_sec: 15 },
      ],
    },
    {
      line_id: lines[3]._id, name: 'Станок CNC-001', type: 'cnc_machine',
      ip_address: '192.168.2.10', created_by: engineer1._id,
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Обороты шпинделя', unit: 'об/мин', min_value: 500, max_value: 12000, update_interval_sec: 2 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Подача', unit: 'мм/мин', min_value: 10, max_value: 5000, update_interval_sec: 3 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура СОЖ', unit: '°C', min_value: 15, max_value: 45, update_interval_sec: 30 },
      ],
    },
    {
      line_id: lines[3]._id, name: 'Пресс PR-001', type: 'press',
      ip_address: '192.168.2.11', created_by: engineer1._id,
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Усилие прессования', unit: 'кН', min_value: 10, max_value: 500, update_interval_sec: 2 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Ход пуансона', unit: 'мм', min_value: 0, max_value: 300, update_interval_sec: 2 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура масла', unit: '°C', min_value: 30, max_value: 80, update_interval_sec: 15 },
      ],
    },
    {
      line_id: lines[4]._id, name: 'Стенд испытательный TS-001', type: 'test_stand',
      ip_address: '192.168.2.20', created_by: engineer1._id,
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Крутящий момент', unit: 'Нм', min_value: 0, max_value: 500, update_interval_sec: 1 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Обороты', unit: 'об/мин', min_value: 0, max_value: 8000, update_interval_sec: 1 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура двигателя', unit: '°C', min_value: 20, max_value: 120, update_interval_sec: 5 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Расход топлива', unit: 'л/ч', min_value: 0, max_value: 30, update_interval_sec: 5 },
      ],
    },
    // === Узлы для engineer2 (Казань) ===
    {
      line_id: lines[5]._id, name: 'Паяльная станция PS-001', type: 'soldering_station',
      ip_address: '192.168.3.10', created_by: engineer2._id,
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура жала', unit: '°C', min_value: 200, max_value: 450, update_interval_sec: 3 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Поток воздуха', unit: 'л/мин', min_value: 5, max_value: 50, update_interval_sec: 10 },
      ],
    },
    // === Узлы для operator1 (Нижний Новгород) ===
    {
      line_id: lines[6]._id, name: 'Робот-манипулятор RM-001', type: 'robot_arm',
      ip_address: '192.168.4.10', created_by: operator1._id,
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Угол поворота', unit: '°', min_value: 0, max_value: 360, update_interval_sec: 1 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Нагрузка захвата', unit: 'кг', min_value: 0, max_value: 50, update_interval_sec: 3 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура привода', unit: '°C', min_value: 20, max_value: 90, update_interval_sec: 10 },
      ],
    },
    // === Узлы для operator2 (Самара) ===
    {
      line_id: lines[7]._id, name: 'Штамповочный пресс SP-001', type: 'stamping_press',
      ip_address: '192.168.5.10', created_by: operator2._id,
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Усилие штамповки', unit: 'кН', min_value: 50, max_value: 1000, update_interval_sec: 2 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура матрицы', unit: '°C', min_value: 30, max_value: 200, update_interval_sec: 5 },
      ],
    },
  ];

  const nodes = await TechNode.insertMany(nodesDefs);
  console.log(`${nodes.length} tech nodes created`);

  // === TELEMETRY DATA (synthetic) ===
  console.log('Generating telemetry records...');
  const now = Date.now();
  const telemetryBatch: any[] = [];

  for (const node of nodes) {
    for (const param of node.parameters) {
      // Generate 200 records per parameter over the last 2 hours
      for (let i = 0; i < 200; i++) {
        const timeOffset = (i / 200) * 2 * 60 * 60 * 1000;
        const range = param.max_value - param.min_value;
        const mid = (param.max_value + param.min_value) / 2;
        const noise = (Math.random() - 0.5) * range * 0.6;
        let value = mid + noise;
        if (Math.random() < 0.03) {
          value = param.max_value + range * 0.1 * Math.random();
        }

        telemetryBatch.push({
          node_id: node._id,
          param_id: param.param_id,
          value: parseFloat(value.toFixed(2)),
          timestamp: new Date(now - timeOffset),
          quality_flag: Math.random() < 0.95 ? 'good' : (Math.random() < 0.5 ? 'uncertain' : 'bad'),
        });
      }
    }
  }

  const batchSize = 1000;
  for (let i = 0; i < telemetryBatch.length; i += batchSize) {
    await TelemetryRecord.insertMany(telemetryBatch.slice(i, i + batchSize));
  }
  console.log(`${telemetryBatch.length} telemetry records created`);

  // === ALERTS ===
  const alertsDefs = [
    { node_id: nodes[0]._id, param_id: nodes[0].parameters[0].param_id, severity: 'warning', message: 'Температура Робот-сварщик RW-001 приближается к верхнему порогу (780°C)', status: 'active' },
    { node_id: nodes[0]._id, param_id: nodes[0].parameters[1].param_id, severity: 'critical', message: 'Ток сварки RW-001 превысил допустимый предел (420A)', status: 'active' },
    { node_id: nodes[2]._id, param_id: nodes[2].parameters[1].param_id, severity: 'warning', message: 'Температура наконечника WM-001 = 1180°C', status: 'acknowledged' },
    { node_id: nodes[3]._id, param_id: nodes[3].parameters[1].param_id, severity: 'info', message: 'Влажность в камере покраски PC-001 = 68%', status: 'resolved', resolved_at: new Date(now - 3600000) },
    { node_id: nodes[5]._id, param_id: nodes[5].parameters[2].param_id, severity: 'critical', message: 'Температура масла пресса PR-001 = 85°C (макс: 80°C)', status: 'active' },
    { node_id: nodes[6]._id, param_id: nodes[6].parameters[2].param_id, severity: 'warning', message: 'Температура двигателя на стенде TS-001 = 115°C', status: 'active' },
  ];
  await Alert.insertMany(alertsDefs);
  console.log('Alerts created');

  // === COMMANDS ===
  await Command.insertMany([
    { node_id: nodes[0]._id, user_id: users[1]._id, action_type: 'set_parameter', parameters: { param: 'Ток сварки', value: 350 }, status: 'completed', executed_at: new Date(now - 1800000) },
    { node_id: nodes[1]._id, user_id: users[3]._id, action_type: 'restart', parameters: {}, status: 'completed', executed_at: new Date(now - 3600000) },
    { node_id: nodes[4]._id, user_id: users[1]._id, action_type: 'set_parameter', parameters: { param: 'Обороты шпинделя', value: 8000 }, status: 'completed', executed_at: new Date(now - 900000) },
    { node_id: nodes[5]._id, user_id: users[2]._id, action_type: 'emergency_stop', parameters: {}, status: 'pending' },
  ]);
  console.log('Commands created');

  // Update some node statuses to reflect alerts
  await TechNode.findByIdAndUpdate(nodes[0]._id, { status: 'critical' });
  await TechNode.findByIdAndUpdate(nodes[5]._id, { status: 'critical' });
  await TechNode.findByIdAndUpdate(nodes[6]._id, { status: 'warning' });

  console.log('\nSeed completed successfully!');
  console.log('\nTest accounts (password: password123):');
  console.log('  admin      (admin)    — видит ВСЕ данные');
  console.log('  engineer1  (engineer) — Завод №2 Тольятти');
  console.log('  engineer2  (engineer) — Завод №3 Казань');
  console.log('  operator1  (operator) — Завод №4 Нижний Новгород');
  console.log('  operator2  (operator) — Завод №5 Самара');
  console.log('  operator3  (operator) — нет данных (для демо RBAC)');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});

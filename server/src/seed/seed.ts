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

  // === PRODUCTION SITES ===
  const sites = await ProductionSite.insertMany([
    { name: 'Завод №1 — Москва', location: 'г. Москва, ул. Промышленная, 15' },
    { name: 'Завод №2 — Тольятти', location: 'г. Тольятти, ул. Заводская, 42' },
  ]);
  console.log('Production sites created');

  // === ASSEMBLY LINES ===
  const lines = await AssemblyLine.insertMany([
    { site_id: sites[0]._id, name: 'Линия сборки кузовов A1', status: 'active' },
    { site_id: sites[0]._id, name: 'Линия сварки B1', status: 'active' },
    { site_id: sites[0]._id, name: 'Линия покраски C1', status: 'maintenance' },
    { site_id: sites[1]._id, name: 'Линия сборки двигателей A2', status: 'active' },
    { site_id: sites[1]._id, name: 'Линия тестирования D2', status: 'active' },
  ]);
  console.log('Assembly lines created');

  // === TECH NODES ===
  const nodesDefs = [
    {
      line_id: lines[0]._id, name: 'Робот-сварщик RW-001', type: 'welding_robot',
      ip_address: '192.168.1.10',
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура', unit: '°C', min_value: 20, max_value: 800, update_interval_sec: 5 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Ток сварки', unit: 'A', min_value: 50, max_value: 400, update_interval_sec: 2 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Скорость подачи проволоки', unit: 'м/мин', min_value: 1, max_value: 25, update_interval_sec: 5 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Давление газа', unit: 'бар', min_value: 0.5, max_value: 3, update_interval_sec: 10 },
      ],
    },
    {
      line_id: lines[0]._id, name: 'Конвейер CV-001', type: 'conveyor',
      ip_address: '192.168.1.11',
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Скорость ленты', unit: 'м/с', min_value: 0.1, max_value: 2.5, update_interval_sec: 3 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Нагрузка', unit: 'кг', min_value: 0, max_value: 5000, update_interval_sec: 5 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Вибрация', unit: 'мм/с', min_value: 0, max_value: 10, update_interval_sec: 10 },
      ],
    },
    {
      line_id: lines[1]._id, name: 'Сварочный аппарат WM-001', type: 'welding_machine',
      ip_address: '192.168.1.20',
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Напряжение дуги', unit: 'В', min_value: 15, max_value: 40, update_interval_sec: 2 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура наконечника', unit: '°C', min_value: 100, max_value: 1200, update_interval_sec: 5 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Расход защитного газа', unit: 'л/мин', min_value: 5, max_value: 25, update_interval_sec: 10 },
      ],
    },
    {
      line_id: lines[2]._id, name: 'Камера покраски PC-001', type: 'paint_chamber',
      ip_address: '192.168.1.30',
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура камеры', unit: '°C', min_value: 18, max_value: 35, update_interval_sec: 10 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Влажность', unit: '%', min_value: 40, max_value: 70, update_interval_sec: 10 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Давление распыления', unit: 'бар', min_value: 2, max_value: 6, update_interval_sec: 5 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Толщина покрытия', unit: 'мкм', min_value: 20, max_value: 120, update_interval_sec: 15 },
      ],
    },
    {
      line_id: lines[3]._id, name: 'Станок CNC-001', type: 'cnc_machine',
      ip_address: '192.168.2.10',
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Обороты шпинделя', unit: 'об/мин', min_value: 500, max_value: 12000, update_interval_sec: 2 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Подача', unit: 'мм/мин', min_value: 10, max_value: 5000, update_interval_sec: 3 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура СОЖ', unit: '°C', min_value: 15, max_value: 45, update_interval_sec: 30 },
      ],
    },
    {
      line_id: lines[3]._id, name: 'Пресс PR-001', type: 'press',
      ip_address: '192.168.2.11',
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Усилие прессования', unit: 'кН', min_value: 10, max_value: 500, update_interval_sec: 2 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Ход пуансона', unit: 'мм', min_value: 0, max_value: 300, update_interval_sec: 2 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура масла', unit: '°C', min_value: 30, max_value: 80, update_interval_sec: 15 },
      ],
    },
    {
      line_id: lines[4]._id, name: 'Стенд испытательный TS-001', type: 'test_stand',
      ip_address: '192.168.2.20',
      parameters: [
        { param_id: new mongoose.Types.ObjectId(), name: 'Крутящий момент', unit: 'Нм', min_value: 0, max_value: 500, update_interval_sec: 1 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Обороты', unit: 'об/мин', min_value: 0, max_value: 8000, update_interval_sec: 1 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Температура двигателя', unit: '°C', min_value: 20, max_value: 120, update_interval_sec: 5 },
        { param_id: new mongoose.Types.ObjectId(), name: 'Расход топлива', unit: 'л/ч', min_value: 0, max_value: 30, update_interval_sec: 5 },
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
        // Normal-ish distribution around midpoint
        const noise = (Math.random() - 0.5) * range * 0.6;
        let value = mid + noise;
        // Occasionally create out-of-bounds values
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

  // Insert in batches
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
  console.log('\nTest accounts:');
  console.log('  admin / password123 (admin)');
  console.log('  engineer1 / password123 (engineer)');
  console.log('  operator1 / password123 (operator)');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});

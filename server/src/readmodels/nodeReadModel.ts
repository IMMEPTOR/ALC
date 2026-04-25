import mongoose from 'mongoose';
import logger from '../logger';

// Denormalized read model — stored in separate collection
// Includes site/line info embedded for fast queries without joins
export interface NodeReadModelDoc {
  _id: string;
  node_id: string;
  name: string;
  type: string;
  ip_address: string;
  status: string;
  line_id: string;
  line_name: string;
  site_id: string;
  site_name: string;
  site_location: string;
  owner_id: string;
  owner_username: string;
  active_alerts_count: number;
  last_command_at?: Date;
  last_command_action?: string;
  updated_at: Date;
}

const COLLECTION = 'node_read_model';

export function getReadDb() {
  return mongoose.connection.db!;
}

export async function upsertNodeReadModel(data: Partial<NodeReadModelDoc> & { node_id: string }): Promise<void> {
  const db = getReadDb();
  await db.collection(COLLECTION).updateOne(
    { node_id: data.node_id },
    { $set: { ...data, updated_at: new Date() } },
    { upsert: true }
  );
}

export async function updateNodeStatusInReadModel(nodeId: string, status: string): Promise<void> {
  const db = getReadDb();
  await db.collection(COLLECTION).updateOne(
    { node_id: nodeId },
    { $set: { status, updated_at: new Date() } }
  );
}

export async function incrementAlertsCount(nodeId: string, delta: number = 1): Promise<void> {
  const db = getReadDb();
  await db.collection(COLLECTION).updateOne(
    { node_id: nodeId },
    { $inc: { active_alerts_count: delta }, $set: { updated_at: new Date() } }
  );
}

export async function setLastCommand(nodeId: string, actionType: string): Promise<void> {
  const db = getReadDb();
  await db.collection(COLLECTION).updateOne(
    { node_id: nodeId },
    { $set: { last_command_at: new Date(), last_command_action: actionType, updated_at: new Date() } }
  );
}

export async function deleteNodeReadModel(nodeId: string): Promise<void> {
  const db = getReadDb();
  await db.collection(COLLECTION).deleteOne({ node_id: nodeId });
}

export async function rebuildReadModel(): Promise<void> {
  const db = getReadDb();
  const nodes = await db.collection('technodes').aggregate([
    { $lookup: { from: 'assemblylines', localField: 'line_id', foreignField: '_id', as: 'line' } },
    { $unwind: { path: '$line', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'productionsites', localField: 'line.site_id', foreignField: '_id', as: 'site' } },
    { $unwind: { path: '$site', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'users', localField: 'created_by', foreignField: '_id', as: 'owner' } },
    { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
    { $lookup: {
        from: 'alerts',
        let: { nid: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [ { $eq: ['$node_id', '$$nid'] }, { $in: ['$status', ['active', 'acknowledged']] } ] } } },
          { $count: 'n' },
        ],
        as: 'alerts',
      } },
  ]).toArray();

  const bulk = nodes.map(n => ({
    updateOne: {
      filter: { node_id: n._id.toString() },
      update: { $set: {
        node_id: n._id.toString(),
        name: n.name,
        type: n.type,
        ip_address: n.ip_address,
        status: n.status,
        line_id: n.line?._id?.toString() || '',
        line_name: n.line?.name || '',
        site_id: n.site?._id?.toString() || '',
        site_name: n.site?.name || '',
        site_location: n.site?.location || '',
        owner_id: n.owner?._id?.toString() || '',
        owner_username: n.owner?.username || '',
        active_alerts_count: n.alerts[0]?.n || 0,
        updated_at: new Date(),
      } },
      upsert: true,
    },
  }));

  if (bulk.length) {
    await db.collection(COLLECTION).bulkWrite(bulk);
  }
  logger.info(`Read model rebuilt: ${bulk.length} nodes`);
}

export { COLLECTION as NODE_READ_MODEL_COLLECTION };

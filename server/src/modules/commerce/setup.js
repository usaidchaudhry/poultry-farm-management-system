import { InventoryItem, StockLocation, defaultLocations, farmScope } from '../inventory/models.js';
import { EggPolicy } from './models.js';
import { eggKeys } from '../reports/validation.js';
export async function eggItems(organizationId, session) {
  const result = {};
  for (const category of eggKeys) {
    let item = await InventoryItem.findOne({ organizationId, eggCategory: category }).session(session);
    if (!item) [item] = await InventoryItem.create([{ organizationId, eggCategory: category, name: `Egg stock: ${category}`, nameKey: `egg stock: ${category}`, category: 'egg', unit: 'count', active: true }], { session });
    result[category] = item;
  }
  return result;
}
export async function setupEggFarm(farm, session) {
  await eggItems(farm.organizationId, session);
  if (await EggPolicy.exists({ farmId: farm._id }).session(session)) return;
  await defaultLocations(farm, session);
  const location = await StockLocation.findOne({ farmId: farm._id, kind: 'collection', nameKey: 'egg collection room' }).session(session);
  await EggPolicy.create([{ ...farmScope(farm), locationId: location._id, categories: eggKeys.slice(0, 4) }], { session });
}

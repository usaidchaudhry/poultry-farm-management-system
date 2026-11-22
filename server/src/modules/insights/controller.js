import { parse, z } from '../../lib/validation.js';
import { reportQuery, dashboardQuery } from './validation.js';
import * as service from './service.js';
import { csv } from './csv.js';
import { printReport } from './print.js';
export const catalog = (req, res) => res.json({ data: service.available(req.actor) });
export const dashboard = async (req, res) => res.json({ data: await service.dashboard(req.actor, parse(dashboardQuery, req.query)) });
export const report = async (req, res) => res.json(await service.report(req.actor, req.params.type, parse(reportQuery, req.query)));
export async function exportReport(req, res) {
  const { format, ...query } = parse(reportQuery.extend({ format: z.literal('csv').default('csv') }), req.query);
  const result = await service.report(req.actor, req.params.type, query, { exporting: true });
  res.set('Content-Disposition', `attachment; filename="layerflow-${req.params.type}-${result.meta.from}-${result.meta.to}.csv"`);
  res.type('text/csv').send(csv(result.meta.definition.columns, result.data));
}
export async function print(req, res) { const { revision } = parse(z.strictObject({ revision: z.coerce.number().int().positive().optional() }), req.query); res.type('html').send(await printReport(req.actor, req.params.id, revision)); }

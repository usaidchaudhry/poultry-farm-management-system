import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from '../src/lib/validation.js';
import { authRoutes } from '../src/modules/auth/routes.js';
import { usersRouter } from '../src/modules/users/routes.js';
import { rolesRouter } from '../src/modules/roles/routes.js';
import { organizationRouter, scopeBody } from '../src/modules/organization/routes.js';
import { reportRouter, populationRouter, measurementRouter } from '../src/modules/reports/routes.js';
import { visitsRouter, prescriptionsRouter, medicationRouter } from '../src/modules/clinical/routes.js';
import { inventoryRouter } from '../src/modules/inventory/routes.js';
import { formulaRouter } from '../src/modules/formulas/routes.js';
import { productionRouter, salesRouter, expensesRouter, financeRouter } from '../src/modules/commerce/routes.js';
import { evidenceRouter } from '../src/modules/evidence/routes.js';
import { notificationRouter } from '../src/modules/notifications/routes.js';
import { insightRouter, dashboardRouter } from '../src/modules/insights/routes.js';
import { auditRouter } from '../src/modules/audit/routes.js';
import { reportQuery, dashboardQuery } from '../src/modules/insights/validation.js';
import { queryInput as auditQuery } from '../src/modules/audit/validation.js';
import { inboxQuery } from '../src/modules/notifications/validation.js';
import { listSchema } from '../src/modules/reports/validation.js';
import { query as formulaQuery } from '../src/modules/formulas/validation.js';
import { query as inventoryQuery } from '../src/modules/inventory/validation.js';
import { query as commerceQuery } from '../src/modules/commerce/validation.js';
const spec = { openapi: '3.1.0', info: { title: 'LayerFlow API', version: '1.0.0', description: 'Generated from registered feature routes, body validators and permission middleware. Scope, dates, state/version checks and separation of duties apply independently. See the phase logs for source-specific transitions. Decimal values are JSON strings; IDs are 24 hexadecimal characters.' }, servers: [{ url: '/api/v1' }], security: [{ cookieSession: [] }], paths: {}, components: { securitySchemes: { cookieSession: { type: 'apiKey', in: 'cookie', name: 'layerflow.sid' }, csrf: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' } }, schemas: { Error: { type: 'object', required: ['code', 'message', 'requestId'], properties: { code: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' }, fieldErrors: { type: 'object', additionalProperties: { type: 'string' } } } } } } };
function schema(input) { const value = z.toJSONSchema(input, { io: 'input', unrepresentable: 'any' }); delete value.$schema; return value; }
function add(path, method, layers = [], query) {
  path = path.replace(/:([A-Za-z]+)/g, '{$1}').replace(/\/$/, '') || '/';
  const write = !['get', 'head', 'options'].includes(method); const permissions = layers.flatMap((l) => l.handle.permissionCodes || []);
  const anyPermissions = layers.flatMap((l) => l.handle.anyPermissionCodes ? [l.handle.anyPermissionCodes] : []);
  const operation = { tags: [path.split('/')[1]], summary: `${method.toUpperCase()} ${path}`, 'x-required-permissions': permissions, 'x-any-permission-groups': anyPermissions, 'x-company-scope': layers.some((l) => l.handle.name === 'companyScope'), parameters: [...path.matchAll(/{([^}]+)}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string', ...(m[1].toLowerCase().endsWith('id') ? { pattern: '^[a-fA-F0-9]{24}$' } : {}) } })), responses: { '200': { description: 'Success. Lists use {data, meta}; other JSON uses {data}. Read fields are permission-aware.' }, ...Object.fromEntries([400, 401, 403, 404, 409, 413, 422, 429, 500].map((status) => [String(status), { description: `${status} safe error`, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }])) } };
  if (query) for (const [name, property] of Object.entries(schema(query).properties || {})) operation.parameters.push({ name, in: 'query', required: false, schema: property });
  if (write) { operation.security = [{ cookieSession: [], csrf: [] }]; operation.parameters.push({ name: 'X-CSRF-Token', in: 'header', required: true, schema: { type: 'string' } }); }
  const body = layers.find((l) => l.handle.apiSchema)?.handle.apiSchema;
  if (body) operation.requestBody = { required: true, content: { 'application/json': { schema: schema(body) } } };
  if (method === 'post') operation.responses['201'] = { description: 'Created for resource-creation routes; action routes use 200.' };
  if (path.endsWith('/export')) operation.responses['200'].content = { 'text/csv': { schema: { type: 'string' } } };
  if (path.includes('/evidence/') && path.endsWith('/files') && write) { operation.requestBody = { required: true, content: Object.fromEntries(['image/jpeg', 'image/png', 'image/webp'].map((type) => [type, { schema: { type: 'string', format: 'binary', maxLength: 5242880 } }])) }; operation.parameters.push({ name: 'name', in: 'query', required: true, schema: { type: 'string', maxLength: 150 } }, { name: 'purpose', in: 'query', schema: { enum: ['general', 'post-mortem'], default: 'general' } }); }
  if (write && (/^\/(sales|expenses)$/.test(path) || path === '/expenses/{id}/replace' || path === '/inventory/movements' || path === '/inventory/movements/{id}/reverse' || path === '/feed-formulas' || path === '/feed-formulas/{id}/revise')) operation.parameters.push({ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{16,100}$' } });
  (spec.paths[path] ||= {})[method] = operation;
}
const groups = [['/auth', authRoutes({ loginLimit: 20 }), null], ['/users', usersRouter], ['/roles', rolesRouter], ['/organization', organizationRouter], ['/daily-reports', reportRouter, listSchema], ['/flocks', populationRouter], ['/bird-measurements', measurementRouter, listSchema], ['/clinical-visits', visitsRouter], ['/prescriptions', prescriptionsRouter], ['/medication-tasks', medicationRouter], ['/inventory', inventoryRouter, inventoryQuery], ['/feed-formulas', formulaRouter, formulaQuery], ['/egg-production', productionRouter, commerceQuery], ['/sales', salesRouter, commerceQuery], ['/expenses', expensesRouter, commerceQuery], ['/finance', financeRouter, commerceQuery], ['/evidence', evidenceRouter], ['/notifications', notificationRouter, inboxQuery], ['/reports', insightRouter, reportQuery], ['/dashboard', dashboardRouter, dashboardQuery], ['/audit-events', auditRouter, auditQuery]];
for (const [prefix, router, query] of groups) {
  const inherited = router.stack.filter((l) => !l.route && (l.handle.permissionCodes || l.handle.anyPermissionCodes || l.handle.name === 'companyScope'));
  for (const layer of router.stack) if (layer.route) for (const method of Object.keys(layer.route.methods)) add(prefix + (layer.route.path === '/' ? '' : layer.route.path), method, [...inherited, ...layer.route.stack], method === 'get' && !layer.route.path.includes(':id') ? query : null);
}
for (const path of ['/health', '/ready']) { add(path, 'get'); spec.paths[path].get.security = []; }
for (const [path, method, permissions] of [['/permissions', 'get', []], ['/mortality', 'get', ['mortality.view']], ['/users/{id}/scope', 'put', ['users.manage', 'organization.manage']], ['/daily-reports/{id}/print', 'get', ['daily-reports.view', 'reports.export']]]) { add(path, method); spec.paths[path][method]['x-required-permissions'] = permissions; }
spec.paths['/permissions'].get['x-any-permission-groups'] = [['roles.view', 'roles.manage']];
spec.paths['/users/{id}/scope'].put.requestBody = { required: true, content: { 'application/json': { schema: schema(scopeBody) } } };
for (const [path, operations] of Object.entries(spec.paths)) if (/^\/(users|roles|permissions)(\/|$)/.test(path)) for (const operation of Object.values(operations)) operation['x-company-scope'] = true;
spec.paths['/daily-reports/{id}/print'].get.responses['200'].content = { 'text/html': { schema: { type: 'string' } } };
for (const path of ['/auth/csrf', '/auth/login', '/auth/demo-accounts']) spec.paths[path][path.endsWith('login') ? 'post' : 'get'].security = path.endsWith('login') ? [{ csrf: [] }] : [];
await writeFile(resolve('../docs/openapi.json'), JSON.stringify(spec, null, 2) + '\n');
console.log(`Generated ${Object.keys(spec.paths).length} resource paths from the live route/validation definitions.`);

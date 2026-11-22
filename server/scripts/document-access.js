import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ROLES, ALL_PERMISSIONS, RECOVERY_PERMISSIONS } from '../src/modules/access/catalog.js';

const directory = fileURLToPath(new URL('../../docs/', import.meta.url));
await mkdir(directory, { recursive: true });
const lines = [
  '# LayerFlow default access matrix', '',
  'Generated from the shared permission identifiers and the backend seed catalog. Run `npm run docs:access` after changing defaults. Existing database role edits are not overwritten by startup migrations.', '',
  '| Permission | Owner | Production Manager | Farm Manager | Operation Manager | Doctor |',
  '| --- | --- | --- | --- | --- | --- |',
  ...ALL_PERMISSIONS.filter((code) => code !== 'notifications.manage').map((code) => `| \`${code}\` | ${DEFAULT_ROLES.map((role) => role.permissions.includes(code) ? 'Yes' : '—').join(' | ')} |`), '',
  '## Scope and recovery', '',
  '| Role | Scope | Protected |', '| --- | --- | --- |',
  ...DEFAULT_ROLES.map((role) => `| ${role.name} | ${role.scopeMode} | ${role.isProtected ? 'Yes' : 'No'} |`), '',
  `Minimum recovery permissions: ${RECOVERY_PERMISSIONS.map((code) => `\`${code}\``).join(', ')}. An effective administrator must also have company scope and an active account.`, '',
  'User and role APIs are organization-wide administration: they additionally require company scope. Users with no assigned role have no permissions. New accounts always start unassigned and must change their temporary password.', '',
  'Only the protected recovery role can administer protected accounts or assign that role. It cannot be edited through the API. Other grants must be a subset of the acting administrator’s current permissions. Concurrent identity/access changes serialize on the access-control guard and recheck the actor inside the transaction.', '',
  'Historical operational reads require `reports.history.view`; Doctors have the separate `clinical.history.view` exception for clinical records and measurements. Implemented list/detail/chart/export routes enforce scope and business-date windows. Current stock, open work and unresolved alerts have the documented limited current-state exceptions.', '',
  'Audit viewing additionally requires company scope. Reports/export permissions do not substitute for the underlying source permission; formula prices require `feed-formulas.cost-view`. Audit details are redacted and require source read permission.', '',
  'The legacy mock permission `notifications.manage` is retained only for compatibility with the original frontend demo. Live notification actions use their explicit permissions.', '',
];
await writeFile(`${directory}/ACCESS_MATRIX.md`, lines.join('\n'));
console.log('Updated docs/ACCESS_MATRIX.md from the seed catalog.');

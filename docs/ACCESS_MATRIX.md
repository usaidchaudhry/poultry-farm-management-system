# LayerFlow default access matrix

Generated from the shared permission identifiers and the backend seed catalog. Run `npm run docs:access` after changing defaults. Existing database role edits are not overwritten by startup migrations.

| Permission | Owner | Production Manager | Farm Manager | Operation Manager | Doctor |
| --- | --- | --- | --- | --- | --- |
| `dashboard.view` | Yes | Yes | Yes | Yes | Yes |
| `notifications.view` | Yes | Yes | Yes | Yes | Yes |
| `organization.view` | Yes | Yes | Yes | Yes | Yes |
| `organization.manage` | Yes | — | — | — | — |
| `daily-reports.view` | Yes | Yes | Yes | — | — |
| `daily-reports.manage` | Yes | — | Yes | — | — |
| `daily-reports.review` | Yes | Yes | — | — | — |
| `mortality.view` | Yes | Yes | Yes | — | — |
| `clinical.view` | Yes | Yes | — | — | Yes |
| `clinical.manage` | Yes | — | — | — | Yes |
| `medication.view` | Yes | Yes | Yes | — | Yes |
| `medication.administer` | Yes | — | Yes | — | — |
| `bird-parameters.view` | Yes | Yes | Yes | — | Yes |
| `bird-parameters.manage` | Yes | — | Yes | — | — |
| `inventory.view` | Yes | Yes | — | Yes | — |
| `inventory.manage` | Yes | — | — | Yes | — |
| `feed-formulas.view` | Yes | Yes | Yes | Yes | — |
| `feed-formulas.compose` | Yes | — | Yes | — | — |
| `feed-formulas.cost` | Yes | — | — | Yes | — |
| `egg-production.view` | Yes | Yes | — | Yes | — |
| `egg-production.manage` | Yes | — | — | Yes | — |
| `sales.view` | Yes | Yes | — | Yes | — |
| `sales.manage` | Yes | — | — | Yes | — |
| `finance.view` | Yes | Yes | — | Yes | — |
| `finance.manage` | Yes | — | — | Yes | — |
| `reports.view` | Yes | Yes | — | Yes | — |
| `users.view` | Yes | — | — | — | — |
| `users.manage` | Yes | — | — | — | — |
| `audit.view` | Yes | — | — | — | — |
| `roles.view` | Yes | — | — | — | — |
| `roles.manage` | Yes | — | — | — | — |
| `daily-reports.submit` | Yes | — | Yes | — | — |
| `daily-reports.correct-history` | Yes | — | — | — | — |
| `bird-population.manage` | Yes | — | — | — | — |
| `clinical.history.view` | Yes | — | — | — | Yes |
| `medication.correct` | Yes | — | — | — | — |
| `inventory.adjust` | Yes | — | — | Yes | — |
| `inventory.transfer` | Yes | — | — | Yes | — |
| `feed-formulas.submit` | Yes | — | Yes | — | — |
| `feed-formulas.cost-view` | Yes | — | — | Yes | — |
| `feed-formulas.finalize` | Yes | — | — | Yes | — |
| `feed-formulas.return` | Yes | — | — | Yes | — |
| `notifications.raise` | Yes | — | Yes | — | — |
| `notifications.acknowledge` | Yes | Yes | Yes | Yes | Yes |
| `notifications.respond` | Yes | Yes | — | — | Yes |
| `notifications.resolve` | Yes | Yes | — | Yes | Yes |
| `reports.export` | Yes | — | — | Yes | — |
| `reports.history.view` | Yes | — | — | — | — |

## Scope and recovery

| Role | Scope | Protected |
| --- | --- | --- |
| Owner / Production Head | company | Yes |
| Production Manager | company | No |
| Farm Manager | assigned | No |
| Operation Manager | assigned | No |
| Doctor | assigned | No |

Minimum recovery permissions: `users.view`, `users.manage`, `roles.view`, `roles.manage`. An effective administrator must also have company scope and an active account.

User and role APIs are organization-wide administration: they additionally require company scope. Users with no assigned role have no permissions. New accounts always start unassigned and must change their temporary password.

Only the protected recovery role can administer protected accounts or assign that role. It cannot be edited through the API. Other grants must be a subset of the acting administrator’s current permissions. Concurrent identity/access changes serialize on the access-control guard and recheck the actor inside the transaction.

Historical operational reads require `reports.history.view`; Doctors have the separate `clinical.history.view` exception for clinical records and measurements. Implemented list/detail/chart/export routes enforce scope and business-date windows. Current stock, open work and unresolved alerts have the documented limited current-state exceptions.

Audit viewing additionally requires company scope. Reports/export permissions do not substitute for the underlying source permission; formula prices require `feed-formulas.cost-view`. Audit details are redacted and require source read permission.

The legacy mock permission `notifications.manage` is retained only for compatibility with the original frontend demo. Live notification actions use their explicit permissions.

# LayerFlow submission demonstration

Use an isolated demonstration database. Follow README setup and bootstrap, sign in as Owner and change the initial password before seeding. There is no public/default password.

```powershell
# Set a private temporary password, 12-128 characters, in server/.env:
# DEMO_PASSWORD=your-private-temporary-password
npm run db:demo:full
```

The command prints account emails and source IDs, never passwords. Staff initially require password change. It uses today/yesterday in the organization's timezone; current restricted users therefore see useful data. Repeat runs reuse stable source keys and preserve existing credentials and records. It refuses production mode or unrelated non-demo hierarchy. Avoid altering the seed records before testing repeatability; it does not repair/reset arbitrary manual changes.

Set `LOCAL_DEMO_LOGIN=true` with the same `DEMO_PASSWORD` in `server/.env` and restart the API to retain the sign-in account picker. It includes all five user types: `demo-owner@layerflow.test`, `demo-production@layerflow.test`, `demo-alpha@layerflow.test` and `demo-beta@layerflow.test` (Farm Managers), `demo-operations@layerflow.test`, and `demo-doctor@layerflow.test`. The dedicated demo Owner is separate from the original bootstrap Owner. Every account uses normal sessions/permissions and initially requires password change. Already changed passwords are never disclosed or reset; select the email and supply its current password. Disabling the setting hides the helper without deleting accounts. No external service is involved.

## Walkthrough (approximately 10-15 minutes)

1. Owner: show the site, Alpha/Beta farms, houses and flocks. Create a separate staff account, change its temporary password in another clean browser context, and demonstrate pending access before assigning a role/scope.
2. Operation Manager: select Alpha and inspect the feed receipt, location balance and immutable movement ledger. Its account has both farms; the manager accounts have separate farm assignments.
3. Farm Manager Alpha: show today's submitted report: 720 eggs, two mortalities, feed/water/light and sampled weight. Open the sealed placeholder image and attributed comment. It is explicitly a sample image, not a clinical photograph.
4. Show 720 produced eggs, a one-Peti sale (360 eggs), and 360 Alpha eggs remaining. Return/correct/resubmit only on a disposable report or an unsold category; explain that stock-dependent unsafe reductions are blocked and safe revisions post deltas.
5. Show the clearly labeled sample medical alert and its no-Doctor Owner fallback. Sign in as the assigned Doctor and change the temporary password. Let the next reminder scan refresh recipient routing, then acknowledge/respond. Critical resolution requires prior acknowledgement and a note.
6. Doctor: create a new sample visit and multi-item, three-day/two-times-per-day prescription; preview and finalize. In the Doctor context, demonstrate that original-prescriber administration is denied. In a Farm Manager context, record one due completed/missed outcome and show its attributable correction history. Seeded clinical records were entered by Owner via the CLI and accurately retain Owner as prescriber; do not describe them as Doctor-authored.
7. Formula: Farm Manager sees composition and the pending handoff without prices. Operation Manager sees the finalized 60 kg at 10 plus 40 kg at 20 example: total 1,400; 14/kg; 700 per 50 kg bag. Show the immutable version. Formula cost did not create a finance expense.
8. Sales/finance: show 18,000 recorded revenue, unpaid status, 7,000 recorded expense and 11,000 recorded operating surplus. This is an incomplete-cost operating result; official ROI is unavailable.
9. Owner: filter Dashboard and Reports by Alpha/today; reconcile those totals, download CSV, print a submitted daily revision, search `report.submit` in Audit and open redacted changes.
10. Demonstrate wrong-farm and older operational-history requests using the browser/API checks; Doctor's older clinical grant does not authorize finance history. Never expose real cookie or CSRF tokens in a presentation.
11. Restart the API, reload and check session/data/private image persistence. Demonstrate the separate-database restore procedure and fresh login using [backup instructions](BACKUP_RESTORE.md).

Resetting a demonstration means selecting a new empty database and new private upload directory, then bootstrapping and seeding again. No command in this workflow deletes an existing database.

# Inventory section: static redesign

The Inventory section now follows the "Mujez Inventory" design (Developers & Compounds). It uses static demo data only. It makes no API calls.

## What changed

### New: Developers and Compounds tabs
The sidebar's **Inventory** group now has **Developers**, **Compounds** and **Reservations**. English and Arabic labels are both updated. Reservations is unchanged. The old Projects and Units items are gone.

| Route | View |
| --- | --- |
| `/company/developers` | Developers list: search, All / Top / Verified chips, sort, follow button |
| `/company/developers/:id` | Developer profile: cover, KPIs, about (EN/AR), trust signals, their compounds, contact and social |
| `/company/compounds` | Compounds list: search, status chips, developer filter, follow |
| `/company/compounds/:id` | Compound profile: promo banner, gallery, stats, overview, payment plans, phases, unit types, facilities, FAQs, map, master plan, brochure, latest update, alerts bell |

- `/company/projects` and `/company/units` now redirect to `/company/compounds`. The dashboard, contracts and reservations pages link to them.
- Breadcrumbs and in-page navigation are real routes, so the browser back button works.
- The pages follow the app language toggle (EN/RTL), and the compound and developer text has its own English/Arabic switch.
- Following a developer or compound, alert preferences and mute are kept in memory only (`InventoryState`). They reset on reload.
- Actions with no backend show a toast instead. These are Add developer, Add compound, Share, Open in Maps, Download brochure and Stacking plan.

### Files added
`src/app/pages/company-shell/inventory/`:
- `inventory.ts`, `inventory.html`, `inventory.scss`: one component that renders all four views, chosen by the route's `data.view`.
- `inventory-data.ts`: static data ported from the design (`DEVS`, `COS`, `STATUS`, `FIN`, `PAL`, `IC`). It has 6 developers and 16 compounds.
- `inventory-state.ts`: in-memory follow, mute and alert state.
- `inv-scene.ts`: SVG illustration used in place of project photos.

`src/app/inventory.spec.ts` is rewritten for the new pages.

### Removed (API-backed code)
- `pages/company-shell/projects/` (the old Projects page with its stacking plan and `projects` / `units` API calls)
- `pages/company-shell/units/` (the old Units table)
- `src/app/inventory-editor.ts` (the create/edit drawer, which wrote through the API)
- the old `inventory.spec.ts`

### Edited
- `app.routes.ts`: new routes, plus redirects from the old URLs.
- `pages/company-shell/company-shell.ts`: nav entries, icons and permission map. The tabs are gated by the existing `projects.read` permission.
- `company-access.spec.ts`: expected nav paths updated.

## Left alone on purpose
`inventory-api.service.ts` (`InventoryApi`) is still there. The finance, insights, growth and reservations services use it, and they are outside the Inventory section. Reservations still loads units from the API.

## Known limits
- Data is a hard-coded demo, so the new pages don't show real company inventory. Creating, editing, archiving and importing units and projects are not possible now.
- The stacking-plan button is a placeholder toast.
- The `units.read`, `units.manage` and `projects.manage` permissions no longer control anything in the UI.
- Fonts: the design used Geist, but the page inherits the app font.

## Verification
`ng build` (development and production) passes, `npm run check:overlays` passes and `ng test` passes (20 files, 93 tests). The new spec renders every list and profile in both languages. I haven't looked at the pages in a browser.

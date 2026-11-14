> Historical design reference. These screens now use the shared platform catalog API. See `docs/shared-inventory-catalog.md` for current behavior. Static records below are no longer runtime data.

# Inventory section: static redesign (Developers, Compounds, Units)

The Inventory section now follows the "Mujez Inventory" design (Developers, Compounds & Units). It uses static demo data only. It makes no API calls.

## What changed

### New: Developers and Compounds tabs
The sidebar's **Inventory** group now has **Developers**, **Compounds**, **Units** and **Reservations**. English and Arabic labels are both updated. Reservations is unchanged. The old API-backed Projects and Units pages are replaced.

| Route | View |
| --- | --- |
| `/company/developers` | Developers list: search, All / Top / Verified chips, sort, follow button |
| `/company/developers/:id` | Developer profile: cover, KPIs, about (EN/AR), trust signals, their compounds, contact and social |
| `/company/compounds` | Compounds list: search, status chips, developer filter, follow |
| `/company/units` | Units list: search, compound / property-type / sort selects, Primary / Resale / Ready / Offers / Launches chips, bedroom filter, clear filters, favorite heart |
| `/company/units/:id` | Unit profile: offer / launch banner, photos / floor plan / video tabs, payment-plan calculator, unit details, description (EN/AR), price + reserve box, seller, compound and developer cards, more units in the compound |
| `/company/compounds/:id` | Compound profile: promo banner, gallery, stats, overview, payment plans, phases, unit types, facilities, FAQs, map, master plan, brochure, latest update, alerts bell |

- `/company/projects` redirects to `/company/compounds`. `/company/units` is now the static Units tab, which the dashboard, contracts and reservations pages link to.
- Compound profiles show a "Units for sale" section that links to the Units list filtered by that compound (`?co=<index>`). Developer profiles show a units-listed KPI.
- Breadcrumbs and in-page navigation are real routes, so the browser back button works.
- The pages follow the app language toggle (EN/RTL), and the compound and developer text has its own English/Arabic switch.
- Following a developer or compound, alert preferences and mute are kept in memory only (`InventoryState`). They reset on reload.
- Actions with no backend show a toast instead. These are Add developer, Add compound, Share, Open in Maps, Download brochure and Stacking plan.

### Files added
`src/app/pages/company-shell/inventory/`:
- `inventory.ts`, `inventory.html`, `inventory.scss`: one component that renders all four views, chosen by the route's `data.view`.
- `inventory-data.ts`: static data ported from the design (`DEVS`, `COS`, `STATUS`, `FIN`, `PAL`, `IC`, plus `UNITS`, `UTYPES`, `KTYPES`, `AGENTS`). It has 6 developers and 16 compounds. The units are generated from the compounds with a seeded random generator, the same way as in the design, so they are the same on every load.
- `inventory-state.ts`: in-memory follow, mute, alert and unit-favorite state.
- `inv-scene.ts`: SVG illustration used in place of project photos.

`src/app/inventory.spec.ts` is rewritten for the new pages.

### Removed (API-backed code)
- `pages/company-shell/projects/` (the old Projects page with its stacking plan and `projects` / `units` API calls)
- `pages/company-shell/units/` (the old Units table)
- `src/app/inventory-editor.ts` (the create/edit drawer, which wrote through the API)
- the old `inventory.spec.ts`

### Edited
- `app.routes.ts`: new routes, plus redirects from the old URLs.
- `pages/company-shell/company-shell.ts`: nav entries, icons and permission map. Developers and Compounds are gated by `projects.read`, Units by `units.read`.
- `company-access.spec.ts`: expected nav paths updated.

## Left alone on purpose
`inventory-api.service.ts` (`InventoryApi`) is still there. The finance, insights, growth and reservations services use it, and they are outside the Inventory section. Reservations still loads units from the API.

## Known limits
- Data is a hard-coded demo, so the new pages don't show real company inventory. Creating, editing, archiving and importing units and projects are not possible now.
- The stacking-plan button is a placeholder toast.
- `units.manage` and `projects.manage` no longer control anything in the UI.
- Reserve, Call, WhatsApp and Share on a unit only show a toast. Reserving does not create a reservation.
- Fonts: the design used Geist, but the page inherits the app font.

## Verification
`ng build` (development and production) passes (production needed the component-style error budget raised from 10 kB to 30 kB for `inventory.scss`, which is about 23 kB), `npm run check:overlays` passes and `ng test` passes (20 files, 96 tests). The new spec renders every list and profile in both languages. I haven't looked at the pages in a browser.

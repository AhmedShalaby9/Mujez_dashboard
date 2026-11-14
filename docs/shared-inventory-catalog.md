# Shared inventory catalog integration

The redesigned inventory routes now load `/api/v1/catalog/{developers,compounds,units}` through `CatalogApi` instead of importing the static arrays. Shared catalog writes are available in the admin sidebar to platform users with `co.create`. Company users browse the same published records with existing projects/units read permissions and an active subscription.

Lists use server pagination (24 per page), bilingual literal search, status/parent/type/listing/bedroom filters, sort and saved favorites. Profiles use UUID deep links and fetch actual metadata, media, specifications, payment plans, facilities, phases, FAQs and child records. Missing values show “Not set”; published child counts and follower totals come from the database. Photos without a source show an explicit placeholder, never a fabricated project image.

Saved alert preferences are retained across sessions. The UI states that external email delivery is not configured. Share copies the actual page link; contact, map, brochure, video and floor-plan actions use validated stored URLs. There is no simulated reservation action on shared reference inventory. Existing private company reservation/contract unit links (`?unitId=`) keep using the original tenant API, without publishing those records to other companies.

The original Mujez inventory card/profile styles, bilingual layouts, lime/black palette and responsive grids are retained. Editors and archive confirmations use the common accessible admin form/modal styles, with scoped errors and sticky actions. Static design source files remain unreferenced historical fixtures.

Jeeran exports are imported through the backend’s explicit, audited import command. Deployment never runs the bulk import automatically or publishes private tenant inventory. No extra secrets or third-party integrations are required. Imported profiles show their source reference and snapshot date; payment schedules retain actual frequency, currency and fractional years. Repeated imports preserve UUIDs and personal preferences.

Run `npm run check:overlays`, `npm test -- --watch=false`, and `npm run build`. `inventory.spec.ts` verifies real API rendering, direct UUID links, server filters, exact amounts and nulls, preference failures/success, language support, edit permissions and metadata preservation.

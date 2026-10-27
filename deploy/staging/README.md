# Staging deployment

Pushes to `staging` deploy the dashboard. `main` does not trigger this workflow.
Manual runs also require the `staging` branch. Repository-level secrets work even
though the job uses the `staging` environment.

Required secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`.
Use the same staging server connection details as the backend repository.

Optional variables (shown with defaults):

- `SSH_PORT=22`
- `DASHBOARD_RELEASES_PATH=/var/www/mujez-staging/releases`
- `API_URL=https://api-stg.mujez.net`
- `DASHBOARD_URL=https://mujez-stg.mujez.net`

## Optional environment secret

The Git-ignored `.env.staging` contains only public URL settings. If you prefer
editing a whole file, copy it into this repository's `STAGING_ENV` secret:

```sh
pbcopy < /Users/ahmedgamal/mujez/mujez_dashboard/.env.staging
```

Only `API_URL` and `DASHBOARD_URL` are allowed. Never copy the backend environment
into this secret. When present, these keys override the corresponding variables
for the public runtime configuration. `DASHBOARD_URL` in GitHub variables still
controls the deployment smoke check and must match the hosting domain.
Changing a secret does not start a workflow; push to `staging` or run it manually.
If no `STAGING_ENV` secret exists, the variables/defaults are sufficient.

The build creates `runtime-config.json` with public URLs. The app loads this file
before bootstrapping and exposes `RUNTIME_CONFIG` for future API services to
inject. No credentials are embedded. The existing UI is still the Angular starter
page, and no business API integration or login is added by this deployment work.

For a local staging build:

```sh
node --env-file=.env.staging scripts/write-runtime-config.mjs
npm run build
```

`public/runtime-config.json` in Git contains localhost defaults; configuration
generation replaces it for the build. Restore localhost values after local testing.

## Release behavior

The workflow builds with Node 24, verifies the SSH host key, uploads the static
build to a new release, and atomically switches `/var/www/mujez-staging/current`.
The remote check verifies the release marker through local Nginx over HTTPS and
restores the previous symlink on failure. The runner also verifies the public URL.
A public-network failure after activation is reported for investigation.

Releases remain under `/var/www/mujez-staging/releases`. Previous releases are
retained for rollback. No database or backend environment file is uploaded by
this workflow. Existing Nginx/TLS configuration is preserved.

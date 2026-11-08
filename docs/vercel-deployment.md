# Deploying Veilstrike on Vercel

Import `eminentcodes/veilStrike` and use `main` as the production branch.
Leave the Vercel **Root Directory** empty so installation runs from the
repository root and uses the workspace lockfile.

The root `vercel.json` selects Vite and sets:

- Install command: `npm ci --include=dev`
- Build command: `npm run build --workspace @veilstrike/web`
- Output directory: `apps/web/dist`

This builds the current React application. The root `index.html` and `assets/`
contain an older export and should not be selected as the deployment output.
The application uses hash routes, including `#lobby`, `#guide`, and `#roadmap`.

If the project already uses `apps/web` as its Root Directory, its own
`vercel.json` uses the same installation command, `npm run build`, and `dist`
as its output directory. Both configurations explicitly install development
dependencies because TypeScript and Vite are needed during the build, including
when `NODE_ENV` is `production` or npm is configured to omit development packages.
This addresses the reported `tsc: command not found` failure.

## Online PvP

Vercel hosts the web application. The persistent WebSocket arena server needs
a separate Node.js host that supports WebSockets.

On that host, install dependencies, run `npm run build:server`, and start
`npm run start:server`. The server honors the host's `PORT` environment variable.
Its health endpoint is `/health` and its WebSocket endpoint is `/duel`.

In the Vercel project's environment settings, set `VITE_DUEL_SERVER_URL` to the
server's secure WebSocket URL, for example `wss://your-arena-host.example/duel`,
then redeploy. This URL is bundled into the client at build time. Quick Match
against AI works without a separate PvP server.

If a deployment fails, open its build logs and check the first error. Confirm
the Root Directory and the build/output settings above before retrying.

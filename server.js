/**
 * Custom entrypoint for the Next.js standalone server.
 *
 * The generated `.next/standalone/server.js` binds using
 * `process.env.HOSTNAME`, which Railway (and Docker in general) sets to the
 * container's internal hostname rather than a routable address. That causes
 * the Next.js server to listen on `localhost`/container-hostname only,
 * making it unreachable from Railway's healthcheck probe and any external
 * reverse proxy, even though the app logs "Ready".
 *
 * This wrapper forces the server to bind to `0.0.0.0` (all interfaces)
 * while keeping the configured port, then delegates to the standalone
 * server. It works under both Node.js and Bun.
 */

const HOST = "0.0.0.0";
const PORT = process.env.PORT || "8080";

// Force the bind address regardless of what the container/runtime injected
// into HOSTNAME (e.g. a container ID), so the server is reachable from
// outside the container.
process.env.HOSTNAME = HOST;
process.env.PORT = PORT;
process.env.NODE_ENV = process.env.NODE_ENV || "production";

const runtime =
  typeof Bun !== "undefined"
    ? `Bun ${Bun.version}`
    : `Node.js ${process.version}`;

console.log("[server] Starting Next.js standalone server");
console.log(`[server] Runtime: ${runtime}`);
console.log(`[server] Binding to ${HOST}:${PORT} (all interfaces)`);

// Delegate to the built-in Next.js standalone server. Requiring it (instead
// of spawning it) keeps everything in a single process while still
// respecting the HOSTNAME/PORT env vars we just forced above.
require("./.next/standalone/server.js");

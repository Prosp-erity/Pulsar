// Wrapper around the Next.js standalone server that forces the server to
// bind to all network interfaces (0.0.0.0) instead of the container's
// internal hostname.
//
// Next.js standalone servers default to listening on `process.env.HOSTNAME`.
// Railway sets HOSTNAME to the container's internal hostname (e.g.
// e715c718948d), which causes the server to bind to loopback only and be
// unreachable by Railway's healthcheck probes and external traffic.
//
// Forcing HOSTNAME to 0.0.0.0 here, before requiring the standalone server,
// ensures it binds to all interfaces while still respecting Railway's PORT.

process.env.HOSTNAME = "0.0.0.0";
process.env.PORT = process.env.PORT || "8080";

console.log(
  `[server.js] Starting Next.js standalone server on ${process.env.HOSTNAME}:${process.env.PORT}`
);

require("./.next/standalone/server.js");

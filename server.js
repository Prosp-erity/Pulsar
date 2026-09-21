// Custom server wrapper to fix binding on Railway
// Next.js standalone reads process.env.HOSTNAME to determine bind address.
// Railway sets HOSTNAME to the container's internal hostname, which causes
// the server to listen on localhost only and fail healthchecks.
// This wrapper forces HOSTNAME=0.0.0.0 to listen on all interfaces.

const port = process.env.PORT || 8080;
process.env.HOSTNAME = '0.0.0.0';

console.log(`Starting Next.js standalone server...`);
console.log(`Binding to: 0.0.0.0:${port}`);

// Require the generated standalone server
require('./.next/standalone/server');

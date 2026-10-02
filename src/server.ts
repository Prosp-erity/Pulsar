// Custom server entry point that starts the trading engine
// This ensures the engine starts when the server starts, not when a page is loaded

import next from "next";
import { createServer } from "http";
import { parse } from "url";

// Import the trading engine early to trigger initialization
import "@/lib/server/trading";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Start listening
  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });

  // Handle graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("\n[PULSAR] Received SIGTERM, shutting down gracefully...");
    
    // Import here to avoid circular dependency
    const { gracefulShutdown } = await import("@/lib/server/trading/trading-engine");
    await gracefulShutdown();
    
    server.close(() => {
      console.log("[PULSAR] Server closed");
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error("[PULSAR] Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  });

  process.on("SIGINT", async () => {
    console.log("\n[PULSAR] Received SIGINT, shutting down gracefully...");
    
    const { gracefulShutdown } = await import("@/lib/server/trading/trading-engine");
    await gracefulShutdown();
    
    server.close(() => {
      console.log("[PULSAR] Server closed");
      process.exit(0);
    });
    
    setTimeout(() => {
      console.error("[PULSAR] Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  });
});

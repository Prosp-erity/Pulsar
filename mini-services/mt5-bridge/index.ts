// Pulsar MT5 Bridge — REST API server
//
// This mini-service acts as a bridge between the Pulsar trading app
// and a MetaTrader 5 terminal running the PulsarBridge EA.
//
// Architecture:
//   App  →  REST API (this server, port 3030)  →  MT5 EA (polls for orders)
//   MT5 EA  →  REST API (posts results)  →  App
//
// The EA in MT5 polls GET /api/pending for orders.
// When it gets one, it executes it and POSTs the result to /api/result.
// The app sends orders via POST /api/order and reads status via GET /api/status.

import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync } from "fs";

const PORT = 3030;
const STATE_FILE = "/tmp/pulsar-mt5-bridge-state.json";

interface PendingOrder {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  stopLoss: number;
  takeProfit: number;
  createdAt: number;
}

interface ExecutionResult {
  orderId: string;
  success: boolean;
  ticket?: number;
  error?: string;
}

interface EAStatus {
  connected: boolean;
  lastSeen: number;
  accountBalance?: number;
  accountEquity?: number;
  accountCurrency?: string;
  server?: string;
  openPositions?: number;
}

interface BridgeState {
  pendingOrders: PendingOrder[];
  results: ExecutionResult[];
  eaStatus: EAStatus;
}

function loadState(): BridgeState {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    } catch {}
  }
  return {
    pendingOrders: [],
    results: [],
    eaStatus: { connected: false, lastSeen: 0 },
  };
}

function saveState(state: BridgeState) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch {}
}

let state = loadState();

const server = createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // GET /api/status — App checks if EA is connected
  if (url.pathname === "/api/status" && req.method === "GET") {
    const eaAlive = Date.now() - state.eaStatus.lastSeen < 10000;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        eaConnected: eaAlive,
        ...state.eaStatus,
        pendingOrders: state.pendingOrders.length,
      }),
    );
    return;
  }

  // GET /api/pending — EA polls for pending orders
  if (url.pathname === "/api/pending" && req.method === "GET") {
    // Update EA last seen
    state.eaStatus.connected = true;
    state.eaStatus.lastSeen = Date.now();
    saveState(state);

    // Return oldest pending order (FIFO)
    const order = state.pendingOrders.shift();
    if (order) saveState(state);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(order ? JSON.stringify(order) : JSON.stringify(null));
    return;
  }

  // POST /api/order — App sends an order to be executed
  if (url.pathname === "/api/order" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const order = JSON.parse(body) as PendingOrder;
        order.id = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        order.createdAt = Date.now();
        state.pendingOrders.push(order);
        saveState(state);

        console.log(`[bridge] Order queued: ${order.side} ${order.volume} ${order.symbol}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, orderId: order.id }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid order JSON" }));
      }
    });
    return;
  }

  // POST /api/result — EA reports execution result
  if (url.pathname === "/api/result" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const result = JSON.parse(body) as ExecutionResult;
        state.results.push(result);
        // Keep only last 100 results
        if (state.results.length > 100) state.results = state.results.slice(-100);
        saveState(state);

        console.log(
          `[bridge] Result: ${result.orderId} → ${result.success ? `ticket #${result.ticket}` : result.error}`,
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid result JSON" }));
      }
    });
    return;
  }

  // POST /api/heartbeat — EA sends account status
  if (url.pathname === "/api/heartbeat" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        state.eaStatus = {
          connected: true,
          lastSeen: Date.now(),
          accountBalance: data.balance,
          accountEquity: data.equity,
          accountCurrency: data.currency,
          server: data.server,
          openPositions: data.openPositions,
        };
        saveState(state);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch {
        res.writeHead(400);
        res.end("Invalid JSON");
      }
    });
    return;
  }

  // POST /api/close — App requests closing a position
  if (url.pathname === "/api/close" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { ticket } = JSON.parse(body);
        // Add close order to pending queue
        state.pendingOrders.push({
          id: `close_${Date.now()}`,
          symbol: "",
          side: "BUY",
          volume: 0,
          stopLoss: 0,
          takeProfit: 0,
          createdAt: Date.now(),
          // @ts-ignore — closeOrder flag
          closeOrder: true,
          ticket: ticket,
        });
        saveState(state);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch {
        res.writeHead(400);
        res.end("Invalid JSON");
      }
    });
    return;
  }

  // GET /api/results — App checks execution results
  if (url.pathname === "/api/results" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(state.results));
    return;
  }

  // Health check
  if (url.pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        service: "Pulsar MT5 Bridge",
        status: "running",
        port: PORT,
        eaConnected: Date.now() - state.eaStatus.lastSeen < 10000,
        pendingOrders: state.pendingOrders.length,
      }),
    );
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║   Pulsar MT5 Bridge — Port ${PORT}      ║`);
  console.log(`╠══════════════════════════════════════╣`);
  console.log(`║  REST API:  http://localhost:${PORT}    ║`);
  console.log(`║  EA Polls:  GET /api/pending         ║`);
  console.log(`║  App Sends: POST /api/order          ║`);
  console.log(`║  EA Reports: POST /api/result        ║`);
  console.log(`║  Heartbeat: POST /api/heartbeat       ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
  console.log(`Waiting for MT5 EA to connect...\n`);
});

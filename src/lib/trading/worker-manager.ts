// Creates a Web Worker from an inline blob. This bypasses the need for
// webpack/turbopack worker loading configuration and works universally.
//
// The worker runs a setInterval timer that is NOT subject to browser
// background-tab throttling. When the tab is inactive, browsers throttle
// main-thread timers to ~1Hz or slower, but worker timers continue at
// full speed.

const WORKER_CODE = `
let timerId = null;
let currentMs = 1500;

self.onmessage = function(e) {
  var type = e.data.type;
  var ms = e.data.ms;

  if (type === 'start') {
    if (ms) currentMs = ms;
    if (timerId) clearInterval(timerId);
    timerId = setInterval(function() {
      self.postMessage({ type: 'tick', timestamp: Date.now() });
    }, currentMs);
    self.postMessage({ type: 'tick', timestamp: Date.now() });
  } else if (type === 'stop') {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  } else if (type === 'setInterval' && ms) {
    currentMs = ms;
    if (timerId) {
      clearInterval(timerId);
      timerId = setInterval(function() {
        self.postMessage({ type: 'tick', timestamp: Date.now() });
      }, currentMs);
    }
  }
};
`;

let workerInstance: Worker | null = null;

export function getTickWorker(): Worker | null {
  if (typeof window === "undefined") return null;
  if (workerInstance) return workerInstance;
  try {
    const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    workerInstance = new Worker(url);
    // Don't revoke the URL — the worker needs it alive
    return workerInstance;
  } catch {
    // Worker creation failed (e.g., in some sandboxed environments)
    return null;
  }
}

export function destroyTickWorker() {
  if (workerInstance) {
    workerInstance.postMessage({ type: "stop" });
    workerInstance.terminate();
    workerInstance = null;
  }
}

// Web Worker that runs a high-precision timer immune to browser
// background-tab throttling. Browsers throttle setInterval in inactive
// tabs (often to once per second or slower), which causes the trading
// engine to stall when the user switches tabs. Web Workers are NOT
// subject to this throttling, so the tick loop continues at full speed
// even when the tab is in the background.

let timerId: ReturnType<typeof setInterval> | null = null;
let currentMs = 1500;

self.onmessage = (e: MessageEvent) => {
  const { type, ms } = e.data as { type: string; ms?: number };

  if (type === "start") {
    if (ms) currentMs = ms;
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      self.postMessage({ type: "tick", timestamp: Date.now() });
    }, currentMs);
    // Fire one immediate tick
    self.postMessage({ type: "tick", timestamp: Date.now() });
  } else if (type === "stop") {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  } else if (type === "setInterval" && ms) {
    currentMs = ms;
    if (timerId) {
      clearInterval(timerId);
      timerId = setInterval(() => {
        self.postMessage({ type: "tick", timestamp: Date.now() });
      }, currentMs);
    }
  }
};

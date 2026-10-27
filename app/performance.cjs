const os = require('node:os');
const { spawn } = require('node:child_process');

// Windows reports each process/engine separately. Task Manager style GPU load is
// the busiest engine, not the sum of 3D + decode + copy (which double-counts work).
function gpuPercent(rows) {
  if (!Array.isArray(rows)) return null;
  const engines = new Map();
  for (const row of rows) {
    const match = String(row.Name || '').match(/(luid_0x[\da-f]+_0x[\da-f]+_phys_\d+_eng_\d+)_engtype_/i);
    const value = Number(row.UtilizationPercentage);
    if (!match || row.UtilizationPercentage == null || row.UtilizationPercentage === '' || !Number.isFinite(value) || value < 0) continue;
    const key = match[1].toLowerCase();
    engines.set(key, (engines.get(key) || 0) + value);
  }
  return engines.size ? Math.round(Math.min(100, Math.max(...engines.values()))) : null;
}

function cpuPercent(before, after) {
  if (!before.length || before.length !== after.length) return null;
  let idle = 0, total = 0;
  for (let i = 0; i < after.length; i++) {
    for (const key of Object.keys(after[i].times)) total += after[i].times[key] - before[i].times[key];
    idle += after[i].times.idle - before[i].times.idle;
  }
  return total > 0 && idle >= 0 ? Math.round(Math.max(0, Math.min(100, (1 - idle / total) * 100))) : null;
}

function windowsGpuScript(parentPid) {
  if (!Number.isSafeInteger(parentPid) || parentPid <= 0) throw Error('Invalid parent PID');
  // CIM class/property names stay the same on non-English Windows installations.
  // A persistent, hidden helper avoids launching PowerShell on every UI update.
  return `
$ErrorActionPreference = 'Stop'
while (Get-Process -Id ${parentPid} -ErrorAction SilentlyContinue) {
  try {
    $rows = @(Get-CimInstance -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -OperationTimeoutSec 3 | Select-Object Name, UtilizationPercentage)
    [Console]::Out.WriteLine((ConvertTo-Json -InputObject @{ rows = $rows } -Depth 4 -Compress))
  } catch {
    [Console]::Out.WriteLine('{"error":"unavailable"}')
  }
  Start-Sleep -Seconds 2
}`;
}

function createPerformanceMonitor(onUpdate) {
  let before = os.cpus(), child, buffer = '', lastGpuAt = 0;
  let current = { cpu: null, ram: null, gpu: null, gpuStatus: process.platform === 'win32' ? 'waiting' : 'unsupported' };
  if (process.platform === 'win32') {
    child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', windowsGpuScript(process.pid)], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    const unavailable = () => { current = { ...current, gpu: null, gpuStatus: 'unavailable' }; };
    child.on('error', unavailable);
    child.on('exit', unavailable);
    // Keep stderr drained; an unsupported driver must not block the player.
    child.stderr.resume();
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      if (buffer.length > 2 * 1024 * 1024) { buffer = ''; unavailable(); return; }
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try {
          const data = JSON.parse(line), value = gpuPercent(data.rows);
          lastGpuAt = Date.now();
          current = { ...current, gpu: value, gpuStatus: value === null ? 'unavailable' : 'ready' };
        } catch { unavailable(); }
      }
    });
  }
  const timer = setInterval(() => {
    const after = os.cpus(), total = os.totalmem();
    current = { ...current, cpu: cpuPercent(before, after), ram: total ? Math.round((1 - os.freemem() / total) * 100) : null };
    before = after;
    if (process.platform === 'win32' && ((lastGpuAt && Date.now() - lastGpuAt > 8000) || (!lastGpuAt && current.gpuStatus === 'waiting' && Date.now() - started > 10000))) {
      current = { ...current, gpu: null, gpuStatus: 'unavailable' };
    }
    onUpdate({ ...current });
  }, 1000);
  const started = Date.now();
  return { get: () => ({ ...current }), diagnostics: () => ({ helperResponded: lastGpuAt > 0 }), stop: () => { clearInterval(timer); child?.kill(); } };
}
module.exports = { gpuPercent, cpuPercent, windowsGpuScript, createPerformanceMonitor };

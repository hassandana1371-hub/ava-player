const assert = require('node:assert/strict');
const { createPerformanceMonitor } = require('../app/performance.cjs');
if (process.platform !== 'win32') {
  console.log('SKIP Windows CIM integration: this test requires Windows.');
} else {
  let samples = 0, monitor;
  const timeout = setTimeout(() => { monitor.stop(); console.error('FAIL Windows GPU helper did not produce a response'); process.exitCode = 1; }, 25000);
  monitor = createPerformanceMonitor(stats => {
    try {
      samples++;
      assert(Number.isFinite(stats.cpu) && stats.cpu >= 0 && stats.cpu <= 100);
      assert(Number.isFinite(stats.ram) && stats.ram >= 0 && stats.ram <= 100);
      if (samples >= 3 && monitor.diagnostics().helperResponded) {
        assert(['ready', 'unavailable'].includes(stats.gpuStatus));
        if (stats.gpuStatus === 'ready') assert(Number.isFinite(stats.gpu) && stats.gpu >= 0 && stats.gpu <= 100);
        else assert.equal(stats.gpu, null);
        clearTimeout(timeout); monitor.stop();
        console.log('PASS Windows PowerShell/CIM helper responded; CPU/RAM sampled; GPU status:', stats.gpuStatus, 'value:', stats.gpu);
      }
    } catch (error) { clearTimeout(timeout); monitor.stop(); console.error(error); process.exitCode = 1; }
  });
}

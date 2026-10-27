const { test } = require('node:test');
const assert = require('node:assert/strict');
const { gpuPercent, cpuPercent } = require('../app/performance.cjs');
const row = (pid, engine, value, gpu='0x0001', type='3D') => ({Name:`pid_${pid}_luid_0x00000000_${gpu}_phys_0_eng_${engine}_engtype_${type}`,UtilizationPercentage:value});
test('GPU combines processes on the same engine without summing parallel engines',()=>{
 assert.equal(gpuPercent([row(1,0,20),row(2,0,30),row(1,1,45,'0x0001','VideoDecode')]),50);
});
test('multi-GPU load is the busiest adapter engine and is clamped to 100 percent',()=>{
 assert.equal(gpuPercent([row(1,0,50),row(2,0,80,'0x0002')]),80);
 assert.equal(gpuPercent([row(1,0,80),row(2,0,60)]),100);
});
test('unavailable GPU data differs from a measured idle GPU',()=>{
 assert.equal(gpuPercent([]),null);assert.equal(gpuPercent(undefined),null);
 assert.equal(gpuPercent([{Name:'unexpected',UtilizationPercentage:50},row(1,0,null),row(2,1,'bad')]),null);
 assert.equal(gpuPercent([row(1,0,0)]),0);
});
test('CPU measurement uses elapsed ticks across cores and tolerates hot-plug/reset',()=>{
 const cpu=(idle,user)=>({times:{idle,user,sys:0,nice:0,irq:0}});
 const before=[cpu(0,0),cpu(0,0)],after=[cpu(50,50),cpu(100,0)];
 assert.equal(cpuPercent(before,after),25);
 assert.equal(cpuPercent(after,after),null);
 assert.equal(cpuPercent(before,[cpu(1,0)]),null);
 assert.equal(cpuPercent(after,before),null);
});

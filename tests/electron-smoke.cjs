const {_electron}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ava-smoke-'));let app;
 const launch=()=>_electron.launch({executablePath:require('electron'),args:['.','--no-sandbox','--ozone-platform=headless','--disable-gpu','--user-data-dir='+temp],env:{...process.env,XDG_CONFIG_HOME:temp,XDG_CACHE_HOME:temp},timeout:30000});
 try{
 app=await launch();const p=await app.firstWindow(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')console.log('Renderer:',m.text());});await p.waitForSelector('.lane');await p.waitForSelector('#splash',{state:'detached'});assert.equal(await p.locator('.lane').count(),5);await p.waitForFunction(()=>document.querySelector('.brand img').naturalWidth>0);await p.setViewportSize({width:1500,height:1050});
 await app.evaluate(({dialog},files)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:files});},['test.png','test.mp4','test.pdf'].map(f=>path.join(__dirname,'fixtures',f)));
 await p.click('#import');await p.waitForFunction(()=>document.querySelectorAll('.media-card').length===3);let s=await p.evaluate(()=>window.ava.init());const video=s.media.find(m=>m.kind==='video'),image=s.media.find(m=>m.kind==='image'),pdf=s.media.find(m=>m.kind==='pdf');

 // Hardware telemetry must never fabricate GPU load on an unsupported machine.
 await p.waitForFunction(()=>/\d+%/.test(document.querySelector('#cpu-value').textContent)&&/\d+%/.test(document.querySelector('#ram-value').textContent));
 if(process.platform!=='win32')assert.equal(await p.locator('#gpu-value').textContent(),'—');
 const originalCard=await p.locator('.media-card').filter({hasText:'test.png'}).elementHandle();
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));w.webContents.send('stats',{gpu:37,cpu:22,ram:48,gpuStatus:'ready'});});
 await p.waitForFunction(()=>document.querySelector('#gpu-value').textContent==='37%');
 await p.evaluate(()=>window.ava.action(4,'volume',0.6));
 assert(await originalCard.evaluate(el=>el===document.querySelector(`[data-media-id="${el.dataset.mediaId}"]`)),'bank DOM identity survives resource/state updates');
 // Real mouse drag-and-drop, including starting over the image thumbnail.
 const imageCard=p.locator(`.media-card[data-media-id="${image.id}"]`);
 await imageCard.dragTo(p.locator('.preview').nth(3));
 s=await p.evaluate(()=>window.ava.init());assert.equal(s.lanes[3].previewId,image.id);assert.equal(s.lanes[3].mediaId,null);
 for(let lane=0;lane<5;lane++){
   await imageCard.dragTo(p.locator('.final').nth(lane));
   await p.waitForFunction(({lane,id})=>window.ava.init().then(s=>s.lanes[lane].mediaId===id&&s.lanes[lane].playing),{lane,id:image.id});
 }
 await p.locator('[data-action=pause]').nth(4).click();
 await imageCard.dragTo(p.locator('.final').nth(4),{sourcePosition:{x:30,y:20}});
 assert.equal((await p.evaluate(()=>window.ava.init())).lanes[4].playing,true);
 assert.equal(await p.locator('.dragover').count(),0);
 console.log('PASS real mouse drags: bank to all five finals, preview-only cue, thumbnail drag, repeated drop, stable cards and isolated telemetry updates');
 // Use real UI for cue and take; cue must not replace live output.
 await p.locator('.media-card').filter({hasText:'test.png'}).click();await p.locator('.preview').first().click();assert.equal((await p.evaluate(()=>window.ava.init())).lanes[0].mediaId,image.id);await p.locator('.take').first().click();await p.waitForFunction(()=>document.querySelector('.final img')?.naturalWidth===640);
 for(let i=0;i<5;i++)await p.locator(`.media-card[data-media-id="${video.id}"]`).dragTo(p.locator('.final').nth(i));await p.waitForFunction(()=>[...document.querySelectorAll('.final video')].length===5&&[...document.querySelectorAll('.final video')].every(v=>v.currentTime>0.2&&v.videoWidth===320));
 await p.locator('[data-action=pause]').first().click();const paused=await p.locator('.final video').first().evaluate(v=>v.currentTime);await p.waitForTimeout(600);assert(Math.abs(await p.locator('.final video').first().evaluate(v=>v.currentTime)-paused)<0.4);await p.locator('[data-action=play]').first().click();
 await p.locator('.audio').nth(2).click();await p.waitForFunction(()=>[...document.querySelectorAll('.final video')].filter(v=>!v.muted).length===1);assert.equal((await p.evaluate(()=>window.ava.init())).audioLane,2);
 await p.locator('.fit').first().selectOption('fill');assert.equal(await p.locator('.final video').first().evaluate(v=>v.style.objectFit),'fill');
 await p.locator(`.media-card[data-media-id="${pdf.id}"]`).dragTo(p.locator('.final').nth(1));await p.waitForFunction(()=>document.querySelectorAll('.final canvas').length===1&&document.querySelector('.final canvas').width>0);await p.waitForFunction(()=>document.querySelector('.final canvas')?.getContext('2d').getImageData(10,10,1,1).data[2]===255);await p.evaluate(async()=>{await window.ava.action(1,'pause');await window.ava.action(1,'seek',5.1);});await p.waitForFunction(()=>document.querySelector('.final canvas')?.getContext('2d').getImageData(10,10,1,1).data[0]===255);assert.equal(await p.locator('.final .media-error').count(),0);

 // Rapid replacements cancel old PDF renders and release detached video decoders.
 await p.evaluate(async ids=>{for(let i=0;i<12;i++)await window.ava.action(3,'load',ids[i%ids.length]);await window.ava.action(3,'load',ids[0]);},[video.id,pdf.id,image.id]);
 await p.locator('.final').nth(3).locator('video').waitFor();await p.waitForFunction(()=>document.querySelectorAll('.final')[3].querySelector('video')?.videoWidth===320);
 assert.equal(await p.locator('.final .media-error').count(),0);
 const display=s.monitors[0].id;await p.evaluate(async id=>{await window.ava.action(0,'monitorId',id);await window.ava.action(2,'monitorId',id);},display);await p.waitForTimeout(600);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),3);assert.equal(await p.locator('.monitor-note.warning').count(),2);
 const output=app.windows().find(w=>w.url().includes('output.html?lane=0'));await output.waitForSelector('video');assert.equal(await output.locator('video').evaluate(v=>v.muted),true);await output.waitForFunction(()=>document.querySelector('video').videoWidth===320&&document.querySelector('video').currentTime>0);await p.screenshot({path:path.join(__dirname,'..','test-results','playing.png'),fullPage:true});

 // Actual external output renderer accepts a drop and updates the same live lane.
 await output.evaluate(id=>{const transfer=new DataTransfer();transfer.setData('application/x-ava-media-id',id);document.querySelector('#output').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));},image.id);
 await output.waitForFunction(()=>document.querySelector('#output img')?.naturalWidth===640);
 assert.equal((await p.evaluate(()=>window.ava.init())).lanes[0].mediaId,image.id);
 await p.click('#all-black');assert.equal(await p.locator('.final.blacked').count(),5);await output.waitForSelector('.blacked');
 // Disconnect a display: actual handler must close affected output windows and clear selectors.
 await app.evaluate(({screen})=>{screen.getAllDisplays=()=>[];screen.emit('display-removed');});await p.waitForFunction(()=>document.querySelector('#display-count').textContent.includes('0'));assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),1);
 await p.screenshot({path:path.join(__dirname,'..','test-results','control.png'),fullPage:true});assert.deepEqual(errors,[]);await app.close();app=null;
 app=await launch();const restored=await app.firstWindow();await restored.waitForSelector('.lane');s=await restored.evaluate(()=>window.ava.init());assert.equal(s.media.length,3);assert(s.lanes.every(l=>!l.playing&&l.monitorId===null));
 console.log('PASS native Electron: bank import, image/video/PDF rendering, five independent video lanes, cue/take, pause/resume, audio isolation, fit, duplicate outputs, hot unplug, blackout, session restore.');
 }finally{if(app)await app.close();fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

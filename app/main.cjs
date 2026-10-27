const {app,BrowserWindow,ipcMain,screen,dialog,protocol,net}=require('electron');
const path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url'),{randomUUID}=require('node:crypto'),{execFile}=require('node:child_process');
const {emptyLane,position,updateLane}=require('./state.cjs');
const {createPerformanceMonitor}=require('./performance.cjs');
let performanceMonitor;
protocol.registerSchemesAsPrivileged([{scheme:'ava',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
let control;const outputs=new Map(),media=new Map();let lanes=Array.from({length:5},(_,i)=>emptyLane(i)),audioLane=null;
const root=path.resolve(__dirname,'..');
function monitors(){return screen.getAllDisplays().map((d,i)=>({id:String(d.id),name:`نمایشگر ${i+1}${d.id===screen.getPrimaryDisplay().id?' · اصلی':''}`,width:Math.round(d.size.width*d.scaleFactor),height:Math.round(d.size.height*d.scaleFactor)}));}
function state(){return {lanes,media:[...media.values()].map(({file,...m})=>m),monitors:monitors(),audioLane};}
function persist(){
 const file=path.join(app.getPath('userData'),'session.json');
 try{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify({media:[...media.values()],lanes:lanes.map(l=>({...l,offset:position(l),playing:false,monitorId:null})),audioLane}));fs.renameSync(file+'.tmp',file);}catch(e){console.error('Cannot save session:',e.message);}
}
function restore(){try{const saved=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'session.json'),'utf8'));for(const m of saved.media||[])if(m.id&&m.file&&fs.existsSync(m.file))media.set(m.id,m);lanes=lanes.map((l,i)=>({...l,...saved.lanes?.[i],id:i,playing:false,monitorId:null,mediaId:media.has(saved.lanes?.[i]?.mediaId)?saved.lanes[i].mediaId:null,previewId:media.has(saved.lanes?.[i]?.previewId)?saved.lanes[i].previewId:null}));audioLane=saved.audioLane??null;}catch{}}
function broadcast(){persist();for(const w of BrowserWindow.getAllWindows())if(!w.isDestroyed())w.webContents.send('state',state());}
function makeWindow(extra={}){const w=new BrowserWindow({width:1500,height:1000,minWidth:1000,minHeight:720,backgroundColor:'#090d16',icon:path.join(root,'assets/ava.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false},...extra});w.setMenuBarVisibility(false);w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());return w;}
function output(lane,raise=false){
 const d=screen.getAllDisplays().find(d=>String(d.id)===lane.monitorId);let w=outputs.get(lane.id);
 if(!d){if(w){outputs.delete(lane.id);w.destroy();}return;}
 if(!w){w=makeWindow({minWidth:1,minHeight:1,frame:false,skipTaskbar:true,...d.bounds});outputs.set(lane.id,w);w.on('closed',()=>{if(outputs.get(lane.id)===w){outputs.delete(lane.id);lanes[lane.id].monitorId=null;broadcast();}});w.loadURL(`ava://app/app/output.html?lane=${lane.id}`);w.webContents.on('before-input-event',(_,e)=>{if(e.key==='Escape'&&e.type==='keyDown'){lanes[lane.id].monitorId=null;outputs.delete(lane.id);w.destroy();broadcast();}});}
 w.setFullScreen(false);w.setBounds(d.bounds);w.setFullScreen(true);if(raise){w.show();w.moveTop();}
}
function convertOffice(file){return new Promise((resolve,reject)=>{
 const candidates=process.platform==='win32'?[path.join(process.env.PROGRAMFILES||'C:\\Program Files','LibreOffice/program/soffice.exe'),path.join(process.env['PROGRAMFILES(X86)']||'C:\\Program Files (x86)','LibreOffice/program/soffice.exe')]:['/usr/bin/libreoffice','/usr/bin/soffice'];
 const bin=candidates.find(f=>fs.existsSync(f));if(!bin)return reject(Error('برای ورود پاورپوینت، LibreOffice را نصب کنید و دوباره امتحان کنید. انیمیشن و صدای اسلایدها در تبدیل PDF حفظ نمی‌شود.'));
 const dir=path.join(app.getPath('userData'),'slides',randomUUID());fs.mkdirSync(dir,{recursive:true});
 execFile(bin,['-env:UserInstallation='+pathToFileURL(path.join(dir,'profile')).href,'--headless','--convert-to','pdf','--outdir',dir,file],{timeout:120000},(err)=>{const pdf=path.join(dir,path.basename(file,path.extname(file))+'.pdf');if(err||!fs.existsSync(pdf))reject(Error('تبدیل پاورپوینت انجام نشد. فایل را به PDF تبدیل و وارد کنید.'));else resolve(pdf);});
});}
async function importFiles(files){
 if(!files){const r=await dialog.showOpenDialog(control,{properties:['openFile','multiSelections'],filters:[{name:'رسانه',extensions:['mp4','mov','m4v','webm','mkv','mp3','wav','ogg','jpg','jpeg','png','webp','gif','bmp','pdf','ppt','pptx']}]});if(r.canceled)return {errors:[],added:[]};files=r.filePaths;}
 const errors=[],added=[];
 for(const file of files){try{if(typeof file!=='string'||!fs.statSync(file).isFile())continue;const ext=path.extname(file).toLowerCase();let kind=/^\.(mp4|mov|m4v|webm|mkv)$/.test(ext)?'video':/^\.(mp3|wav|ogg)$/.test(ext)?'audio':/^\.(png|jpe?g|webp|gif|bmp)$/.test(ext)?'image':ext==='.pdf'?'pdf':/^\.pptx?$/.test(ext)?'office':null;if(!kind)throw Error('این قالب پشتیبانی نمی‌شود.');let playable=file;if(kind==='office'){playable=await convertOffice(file);kind='pdf';}const id=randomUUID();media.set(id,{id,name:path.basename(file),kind,file:playable,url:`ava://app/media/${id}`});added.push(id);}catch(e){errors.push(path.basename(file)+': '+e.message);}}
 broadcast();return {errors,added};
}
app.whenReady().then(async()=>{
 restore();
 performanceMonitor=createPerformanceMonitor(data=>{if(control&&!control.isDestroyed())control.webContents.send('stats',data);});
 ipcMain.handle('stats',()=>performanceMonitor.get());
 protocol.handle('ava',request=>{const u=new URL(request.url);let file;if(u.hostname==='app'&&u.pathname.startsWith('/media/'))file=media.get(u.pathname.slice(7))?.file;else if(u.hostname==='app'){const resolved=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(resolved.startsWith(root+path.sep)&&['/app/','/assets/','/node_modules/pdfjs-dist/'].some(p=>u.pathname.startsWith(p)))file=resolved;}
 if(!file)return new Response('Not found',{status:404});return net.fetch(pathToFileURL(file).href,{headers:request.headers});});
 ipcMain.handle('init',()=>state());ipcMain.handle('import',(_,files)=>importFiles(files));
 ipcMain.handle('action',(_,v)=>{if(!Number.isInteger(v.id)||!lanes[v.id])return;if(['cue','load'].includes(v.action)&&!media.has(v.value))return;if(v.action==='monitorId'&&v.value!==null&&!monitors().some(m=>m.id===v.value))return;lanes[v.id]=updateLane(lanes[v.id],v.action,v.value);if(v.action==='monitorId'||v.action==='take'||v.action==='load')output(lanes[v.id],true);broadcast();});
 ipcMain.handle('audio',(_,id)=>{audioLane=id===null||lanes[id]?id:null;broadcast();});
 ipcMain.handle('blackout',()=>{lanes=lanes.map(l=>({...l,blackout:true}));broadcast();});
 ipcMain.handle('remove',(_,id)=>{if(lanes.some(l=>l.mediaId===id))return {error:'این فایل روی خروجی فعال است؛ ابتدا فایل دیگری اجرا کنید.'};media.delete(id);lanes=lanes.map(l=>({...l,previewId:l.previewId===id?null:l.previewId}));broadcast();return {};});
 ipcMain.on('close-output',e=>{const w=BrowserWindow.fromWebContents(e.sender);if(w!==control)w?.close();});
 control=makeWindow();control.on('closed',()=>app.quit());await control.loadURL('ava://app/app/index.html');
 for(const event of ['display-added','display-removed','display-metrics-changed'])screen.on(event,()=>{const ids=monitors().map(m=>m.id);lanes=lanes.map(l=>ids.includes(l.monitorId)?l:{...l,monitorId:null});for(const l of lanes)output(l);broadcast();});
});
app.on('before-quit',()=>{persist();performanceMonitor?.stop();});
app.on('window-all-closed',()=>app.quit());

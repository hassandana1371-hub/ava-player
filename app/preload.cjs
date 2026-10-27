const {contextBridge,ipcRenderer,webUtils}=require('electron');
contextBridge.exposeInMainWorld('ava',{
  init:()=>ipcRenderer.invoke('init'),
  importFiles:()=>ipcRenderer.invoke('import'),
  dropFiles:files=>ipcRenderer.invoke('import',Array.from(files).map(f=>webUtils.getPathForFile(f))),
  action:(id,action,value)=>ipcRenderer.invoke('action',{id,action,value}),
  audio:id=>ipcRenderer.invoke('audio',id),
  blackout:()=>ipcRenderer.invoke('blackout'),
  remove:id=>ipcRenderer.invoke('remove',id),
  closeOutput:()=>ipcRenderer.send('close-output'),
  onState:fn=>{const h=(_,s)=>fn(s);ipcRenderer.on('state',h);return()=>ipcRenderer.removeListener('state',h);}
});

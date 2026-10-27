import {Player} from './media.js';
const id=Number(new URL(location.href).searchParams.get('lane'));const player=new Player(document.querySelector('#output'));
function render(s){const l=s.lanes[id];if(l)player.set(l,s.media.find(m=>m.id===l.mediaId));}
window.ava.onState(render);render(await window.ava.init());document.onkeydown=e=>{if(e.key==='Escape')window.ava.closeOutput();};

import { Player } from './media.js';
import { bindDropTarget, clearDrag } from './drop.js';
const id = Number(new URL(location.href).searchParams.get('lane'));
const host = document.querySelector('#output'), player = new Player(host);
function render(s) { const lane = s.lanes[id]; if (lane) player.set(lane, s.media.find(m => m.id === lane.mediaId)); }
function error(message) { host.dataset.dropLabel = message; host.classList.add('dragover'); setTimeout(clearDrag, 4000); }
bindDropTarget(host, {
  label: `رها کنید: پخش روی خروجی ${id + 1}`,
  onMedia: mediaId => window.ava.action(id, 'load', mediaId),
  onFiles: async files => {
    const result = await window.ava.dropFiles(files);
    if (result.added?.length) await window.ava.action(id, 'load', result.added[0]);
    if (result.errors.length) error(result.errors.join('\n'));
  }, onError: error
});
window.ava.onState(render); render(await window.ava.init());
document.addEventListener('dragend', clearDrag);
document.ondragover = e => e.preventDefault();
document.ondrop = e => e.preventDefault();
document.onkeydown = e => { if (e.key === 'Escape') window.ava.closeOutput(); };

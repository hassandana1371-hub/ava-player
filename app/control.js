import { Player } from './media.js';
import { MEDIA_TYPE, bindDropTarget, clearDrag } from './drop.js';
const $ = s => document.querySelector(s);
let state, selected = null, filter = 'all';
const players = [], previews = [], cards = new Map();
const call = (id, action, value) => window.ava.action(id, action, value).catch(e => toast(e.message));
function toast(text) {
  $('#toast').textContent = text; $('#toast').hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').hidden = true, 7000);
}
async function importToLane(files, id, action) {
  const result = await window.ava.dropFiles(files);
  if (result.errors.length) toast(result.errors.join('\n'));
  if (result.added?.length) await call(id, action, result.added[0]);
}
for (let id = 0; id < 5; id++) {
  const lane = document.createElement('article'); lane.className = 'lane'; lane.dataset.id = id;
  lane.innerHTML = `<div class="lane-title"><span>لاین ${id + 1}</span><b class="live-tag">FINAL</b></div><div class="final screen" aria-label="خروجی نهایی لاین ${id + 1}"></div><div class="playing-name filename">بدون رسانه</div><select class="monitor" aria-label="نمایشگر لاین ${id + 1}"></select><div class="monitor-note"></div><div class="preview-label"><span>پیش‌نمایش</span><small>PREVIEW</small></div><div class="preview screen" tabindex="0" role="button" aria-label="آماده کردن فایل در لاین ${id + 1}"></div><div class="cue-name filename">فایلی آماده نشده</div><button class="take primary">ارسال به خروجی ↗</button><div class="transport"><button data-action="play" title="پخش" aria-label="پخش">▶</button><button data-action="pause" title="مکث" aria-label="مکث">Ⅱ</button><button data-action="stop" title="توقف" aria-label="توقف">■</button><button class="black">سیاه</button></div><div class="seek-row"><input class="seek" type="range" min="0" max="1" value="0" step="0.1" aria-label="زمان پخش"><span class="clock">00:00</span></div><label class="check"><input class="loop" type="checkbox" checked> تکرار پخش <span>LOOP</span></label><label class="field">اندازهٔ تصویر<select class="fit"><option value="contain">کامل با حفظ نسبت</option><option value="cover">پرکردن با برش</option><option value="fill">کشیدن تا لبه‌ها</option></select></label><label class="field">زمان هر اسلاید (ثانیه)<input class="slide-seconds" type="number" value="5" min="1" max="60"></label><button class="audio">♫ صدای این لاین</button><input class="volume" type="range" min="0" max="1" step="0.01" value="0.8" aria-label="بلندی صدا">`;
  $('#lanes').append(lane); const q = s => lane.querySelector(s);
  players[id] = new Player(q('.final'), { audio: true }); previews[id] = new Player(q('.preview'), { preview: true });
  q('.monitor').onchange = e => call(id, 'monitorId', e.target.value || null);
  q('.take').onclick = () => call(id, 'take');
  for (const b of lane.querySelectorAll('[data-action]')) b.onclick = () => call(id, b.dataset.action);
  q('.black').onclick = () => call(id, 'blackout', !state.lanes[id].blackout);
  q('.loop').onchange = e => call(id, 'loop', e.target.checked);
  q('.fit').onchange = e => call(id, 'fit', e.target.value);
  q('.slide-seconds').onchange = e => call(id, 'slideSeconds', e.target.value);
  q('.volume').oninput = e => call(id, 'volume', e.target.value);
  q('.seek').onchange = e => call(id, 'seek', e.target.value);
  q('.audio').onclick = () => window.ava.audio(state.audioLane === id ? null : id);
  const cue = () => selected ? call(id, 'cue', selected) : toast('ابتدا یک فایل از بانک انتخاب کنید.');
  q('.preview').onclick = cue;
  q('.preview').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cue(); } };
  for (const [selector, action, label] of [['.final', 'load', 'پخش فوری روی خروجی'], ['.preview', 'cue', 'فقط آماده‌سازی در پیش‌نمایش']]) {
    bindDropTarget(q(selector), {
      label: `${label} ${id + 1}`,
      onMedia: mediaId => call(id, action, mediaId),
      onFiles: files => importToLane(files, id, action), onError: toast
    });
  }
}
function render(s) {
  state = s; $('#display-count').textContent = `● ${s.monitors.length} نمایشگر متصل`;
  $('#audio-label').textContent = s.audioLane === null ? 'بی‌صدا' : `لاین ${s.audioLane + 1}`;
  for (const l of s.lanes) {
    const el = document.querySelector(`.lane[data-id="${l.id}"]`), q = t => el.querySelector(t);
    const media = s.media.find(m => m.id === l.mediaId), cue = s.media.find(m => m.id === l.previewId);
    players[l.id].set(l, media, s.audioLane === l.id); previews[l.id].set(l, cue);
    q('.playing-name').textContent = media?.name || 'بدون رسانه'; q('.cue-name').textContent = cue?.name || 'فایلی آماده نشده'; q('.take').disabled = !cue;
    // Do not replace the selector while the user is interacting with it.
    const select = q('.monitor'), optionsKey = JSON.stringify(s.monitors);
    if (select.dataset.optionsKey !== optionsKey) {
      select.replaceChildren(new Option('بدون خروجی خارجی', ''), ...s.monitors.map(m => new Option(`${m.name} · ${m.width}×${m.height}`, m.id)));
      select.dataset.optionsKey = optionsKey;
    }
    select.value = l.monitorId || '';
    const dup = l.monitorId && s.lanes.filter(x => x.monitorId === l.monitorId).length > 1;
    q('.monitor-note').textContent = dup ? 'نمایشگر مشترک؛ آخرین ارسال روی بقیه است' : l.monitorId ? 'خروجی تمام‌صفحه فعال' : 'فقط میز کنترل';
    q('.monitor-note').classList.toggle('warning', !!dup);
    q('.loop').checked = l.loop; q('.fit').value = l.fit; q('.slide-seconds').value = l.slideSeconds; q('.volume').value = l.volume;
    q('.black').classList.toggle('active', l.blackout); q('.audio').classList.toggle('active', s.audioLane === l.id);
    el.classList.toggle('is-playing', l.playing && !l.blackout);
  }
  renderBank();
}
function createCard(m) {
  const item = document.createElement('article'); item.className = 'media-card'; item.draggable = true; item.dataset.mediaId = m.id;
  item.ondragstart = e => {
    selected = m.id; item.classList.add('dragging'); document.body.classList.add('bank-dragging');
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(MEDIA_TYPE, m.id); e.dataTransfer.setData('text/plain', 'ava-media:' + m.id);
  };
  item.ondragend = clearDrag;
  const thumb = document.createElement('div'); thumb.className = 'thumb';
  if (m.kind === 'image') { const img = document.createElement('img'); img.src = m.url; img.alt = ''; img.draggable = false; thumb.append(img); }
  else thumb.textContent = { video: '▶', audio: '♫', pdf: '▤' }[m.kind];
  item.append(thumb);
  const title = document.createElement('strong'); title.textContent = m.name; title.title = m.name; item.append(title);
  const bottom = document.createElement('div'); bottom.className = 'card-bottom';
  const type = document.createElement('small'); type.textContent = { video: 'ویدئو', audio: 'صدا', pdf: 'اسلاید', image: 'تصویر' }[m.kind]; bottom.append(type);
  const del = document.createElement('button'); del.textContent = '×'; del.title = 'حذف از بانک'; del.draggable = false;
  del.onclick = async e => { e.stopPropagation(); const r = await window.ava.remove(m.id); if (r?.error) toast(r.error); };
  bottom.append(del); item.append(bottom);
  item.onclick = () => { selected = m.id; renderBank(); toast('فایل انتخاب شد؛ روی پیش‌نمایش لاین مقصد کلیک کنید یا آن را روی خروجی بکشید.'); };
  return item;
}
function renderBank() {
  const bank = $('#bank-grid'), present = new Set(state.media.map(m => m.id));
  for (const [id, card] of cards) if (!present.has(id)) { card.remove(); cards.delete(id); }
  if (selected && !present.has(selected)) selected = null;
  const list = state.media.filter(m => (filter === 'all' || m.kind === filter) && m.name.toLowerCase().includes($('#search').value.toLowerCase()));
  const visible = new Set(list.map(m => m.id));
  for (const [id, card] of cards) if (!visible.has(id)) card.remove();
  list.forEach((m, index) => {
    let item = cards.get(m.id);
    if (!item) { item = createCard(m); cards.set(m.id, item); }
    item.classList.toggle('selected', selected === m.id);
    // Reuse the exact same DOM node, including during playback/status updates.
    if (bank.children[index] !== item) bank.insertBefore(item, bank.children[index] || null);
  });
  $('#media-count').textContent = `${state.media.length} فایل`; $('#bank-empty').hidden = list.length > 0;
}
function renderStats(stats) {
  const percent = value => Number.isFinite(value) ? `${value}%` : '—';
  $('#gpu-value').textContent = percent(stats.gpu); $('#cpu-value').textContent = percent(stats.cpu); $('#ram-value').textContent = percent(stats.ram);
  $('#performance').dataset.gpuStatus = stats.gpuStatus;
  $('#gpu-meter').title = stats.gpuStatus === 'ready' ? 'مصرف GPU کل سیستم؛ بالاترین موتور فعال در کارت‌های گرافیک' : stats.gpuStatus === 'waiting' ? 'در حال دریافت مصرف GPU از ویندوز…' : 'اطلاعات مصرف GPU از سیستم یا درایور دریافت نشد؛ عدد صفر نمایش داده نمی‌شود.';
}
$('#import').onclick = async () => {
  const b = $('#import'); b.disabled = true; b.textContent = 'در حال ورود…';
  try { const r = await window.ava.importFiles(); if (r.errors.length) toast(r.errors.join('\n')); }
  catch (e) { toast(e.message); } finally { b.disabled = false; b.textContent = '＋ افزودن فایل'; }
};
$('#search').oninput = renderBank;
for (const b of document.querySelectorAll('[data-filter]')) b.onclick = () => { filter = b.dataset.filter; for (const x of document.querySelectorAll('[data-filter]')) x.classList.toggle('selected', x === b); renderBank(); };
$('#all-black').onclick = () => window.ava.blackout(); $('#help').onclick = () => $('#guide').showModal(); $('#close-guide').onclick = () => $('#guide').close();
document.addEventListener('dragend', clearDrag);
document.ondragover = e => e.preventDefault();
document.ondrop = async e => {
  e.preventDefault(); clearDrag();
  if (e.dataTransfer.files.length) {
    try { const r = await window.ava.dropFiles(Array.from(e.dataTransfer.files)); if (r.errors.length) toast(r.errors.join('\n')); }
    catch (err) { toast(err.message); }
  }
};
const format = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
setInterval(() => {
  if (!state) return;
  for (const l of state.lanes) {
    const el = document.querySelector(`.lane[data-id="${l.id}"]`), d = players[l.id].duration(), raw = players[l.id].time(), t = d ? (l.loop ? raw % d : Math.min(raw, d)) : raw;
    el.querySelector('.clock').textContent = format(t); const range = el.querySelector('.seek'); range.disabled = !d;
    if (document.activeElement !== range) { range.max = d || 1; range.value = t; }
  }
}, 500);
window.ava.onState(render); render(await window.ava.init());
window.ava.onStats(renderStats); renderStats(await window.ava.getStats());
setTimeout(() => $('#splash').remove(), 1500);

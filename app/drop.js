export const MEDIA_TYPE = 'application/x-ava-media-id';
export function transferId(transfer) {
  return transfer?.getData(MEDIA_TYPE) || transfer?.getData('text/ava-id') ||
    (transfer?.getData('text/plain')?.startsWith('ava-media:') ? transfer.getData('text/plain').slice(10) : '');
}
function accepts(transfer) {
  return [...(transfer?.types || [])].some(t => [MEDIA_TYPE, 'text/ava-id', 'text/plain', 'Files'].includes(t));
}
export function clearDrag() {
  document.body.classList.remove('bank-dragging');
  for (const el of document.querySelectorAll('.dragover, .dragging')) el.classList.remove('dragover', 'dragging');
}
export function bindDropTarget(host, { label, onMedia, onFiles, onError }) {
  host.dataset.dropLabel = label;
  host.classList.add('drop-target');
  for (const type of ['dragenter', 'dragover']) host.addEventListener(type, e => {
    if (!accepts(e.dataTransfer)) return;
    e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy';
    host.classList.add('dragover');
  });
  host.addEventListener('dragleave', e => {
    if (!host.contains(e.relatedTarget)) host.classList.remove('dragover');
  });
  host.addEventListener('drop', async e => {
    e.preventDefault(); e.stopPropagation(); clearDrag();
    try {
      const id = transferId(e.dataTransfer);
      if (id) await onMedia(id);
      else if (e.dataTransfer.files.length) await onFiles(Array.from(e.dataTransfer.files));
    } catch (error) { onError(error.message); }
  });
}

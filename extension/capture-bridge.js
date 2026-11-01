// Isolated world: screenshot pixels are never exposed to the website's MAIN world.
'use strict';
let busy = false;
chrome.runtime.onMessage.addListener(message => {
  if (message?.type === 'nlsc-start-capture') window.postMessage({ type: 'nlsc-start-capture' }, location.origin);
});
window.addEventListener('message', async event => {
  const m = event.data;
  if (event.source !== window || event.origin !== location.origin || !['nlsc-save-map', 'nlsc-check-map-capture'].includes(m?.type) || typeof m.id !== 'string') return;
  if (busy) return;
  busy = true;
  try {
    if (m.type === 'nlsc-check-map-capture') {
      const result = await chrome.runtime.sendMessage({ type: 'nlsc-capture-check' });
      if (!result?.ok) throw Error(result?.error || '無法確認截圖授權');
      window.postMessage({ type: 'nlsc-map-saved', id: m.id, ok: true }, location.origin);
      return;
    }
    const geometry = globalThis.NLSCCaptureGeometry;
    const vp = geometry.viewport();
    if (!geometry.sameViewport(m.viewport, vp)) throw Error(`截圖前視窗或捲動位置已變更（預期 ${m.viewport?.width}×${m.viewport?.height}；目前 ${vp.width}×${vp.height}；捲動 ${vp.scrollX},${vp.scrollY}），請重新截圖`);
    const r = geometry.clipRect(m.rect, vp);
    if (!geometry.sameRect(r, m.rect)) throw Error(`截圖裁切範圍已變更（要求 ${geometry.rectText(m.rect)}；可見 ${geometry.rectText(r)}），請重新截圖`);
    if (document.visibilityState !== 'visible') throw Error('請保持地圖分頁在前景');
    const result = await chrome.runtime.sendMessage({ type: 'nlsc-capture' });
    if (!result?.ok) throw Error(result?.error || '截圖失敗');
    const img = new Image();
    img.src = result.dataUrl;
    await img.decode();
    if (!geometry.sameViewport(vp, geometry.viewport()) || document.visibilityState !== 'visible') throw Error('截圖期間視窗、捲動位置或分頁變更，未儲存本張圖片，請重試');
    const sx = img.naturalWidth / vp.width, sy = img.naturalHeight / vp.height;
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx <= 0 || sy <= 0 || Math.abs(sx - sy) > Math.max(sx, sy) * 0.02) throw Error(`截圖像素比例不一致（圖片 ${img.naturalWidth}×${img.naturalHeight}；視窗 ${vp.width}×${vp.height}），請重試`);
    const canvas = document.createElement('canvas');
    const left = Math.max(0, Math.floor(r.x * sx)), top = Math.max(0, Math.floor(r.y * sy));
    const right = Math.min(img.naturalWidth, Math.ceil((r.x + r.width) * sx));
    const bottom = Math.min(img.naturalHeight, Math.ceil((r.y + r.height) * sy));
    canvas.width = right - left;
    canvas.height = bottom - top;
    canvas.getContext('2d').drawImage(img, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    const saved = await chrome.runtime.sendMessage({ type: 'nlsc-download', dataUrl: canvas.toDataURL('image/png'), filename: m.filename });
    if (!saved?.ok) throw Error(saved?.error || '下載失敗');
    window.postMessage({ type: 'nlsc-map-saved', id: m.id, ok: true }, location.origin);
  } catch (error) {
    console.warn('NLSC 地圖截圖失敗', { error: error.message, rect: m.rect, viewport: m.viewport, currentViewport: { width: innerWidth, height: innerHeight } });
    window.postMessage({ type: 'nlsc-map-saved', id: m.id, ok: false, error: error.message }, location.origin);
  } finally { busy = false; }
});

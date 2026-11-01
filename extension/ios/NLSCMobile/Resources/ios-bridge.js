(() => {
  'use strict';
  if (location.origin !== 'https://maps.nlsc.gov.tw' || location.pathname !== '/T09/mapshow.action') return;
  const native = payload => window.webkit.messageHandlers.nlsc.postMessage(payload);
  window.NLSCiOS = Object.freeze({ exportFile: (text, filename) => native({ type: 'export', text, filename }) });
  let busy = false;
  window.addEventListener('message', async event => {
    const m = event.data;
    if (event.source !== window || event.origin !== location.origin ||
        !['nlsc-save-map', 'nlsc-check-map-capture'].includes(m?.type) || typeof m.id !== 'string') return;
    const reply = value => window.postMessage({ type: 'nlsc-map-saved', id: m.id, ...value }, location.origin);
    if (busy) { reply({ ok: false, error: '正在儲存另一張圖片' }); return; }
    busy = true;
    try {
      if (document.visibilityState !== 'visible') throw Error('請保持 App 在前景');
      if (m.type === 'nlsc-check-map-capture') {
        await native({ type: 'check' });
      } else {
        const g = window.NLSCCaptureGeometry, vp = g.viewport();
        if (!g.sameViewport(m.viewport, vp) || !g.sameRect(m.rect, g.clipRect(m.rect, vp))) throw Error('畫面尺寸已變更，請重新截圖');
        await native({ type: 'capture', rect: m.rect, viewport: vp, filename: m.filename });
      }
      reply({ ok: true });
    } catch (error) { reply({ ok: false, error: String(error.message || error) }); }
    finally { busy = false; }
  });
})();

(() => {
  if (location.origin !== 'https://maps.nlsc.gov.tw' || location.pathname !== '/T09/mapshow.action') return;
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.append(meta); }
  meta.content = 'width=device-width, initial-scale=1';
  const style = document.createElement('style');
  style.textContent = `
    #nlsc-integrated-panel { max-width:calc(100vw - 16px); max-height:calc(100dvh - 16px); overflow:auto !important; }
    #nlsc-integrated-panel button { min-height:44px; font-size:14px !important; }
    #nlsc-integrated-panel textarea { font-size:16px !important; }
    #nlsc-header { touch-action:none; min-height:32px; }
    #nlsc-toggle-btn { padding:10px !important; }
  `;
  document.head.append(style);
  window.NLSCRecallPanel = () => {
    const panel = document.getElementById('nlsc-integrated-panel');
    if (!panel) return;
    Object.assign(panel.style, { left: 'auto', right: '8px', top: '8px', bottom: 'auto' });
    document.getElementById('nlsc-body').style.display = 'block';
    document.getElementById('nlsc-toggle-btn').textContent = '收合 ▲';
  };
  const attach = () => {
    const header = document.getElementById('nlsc-header');
    if (!header) return false;
    window.NLSCRecallPanel();
    const panel = header.parentElement;
    let drag;
    header.addEventListener('pointerdown', e => {
      if (e.target.closest('#nlsc-toggle-btn') || e.pointerType === 'mouse') return;
      const rect = panel.getBoundingClientRect();
      drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
      header.setPointerCapture(e.pointerId);
    });
    header.addEventListener('pointermove', e => {
      if (!drag) return;
      panel.style.right = 'auto';
      panel.style.left = Math.max(0, Math.min(innerWidth - panel.offsetWidth, drag.left + e.clientX - drag.x)) + 'px';
      panel.style.top = Math.max(0, Math.min(innerHeight - header.offsetHeight, drag.top + e.clientY - drag.y)) + 'px';
    });
    const end = () => { drag = null; };
    header.addEventListener('pointerup', end);
    header.addEventListener('pointercancel', end);
    window.addEventListener('resize', window.NLSCRecallPanel);
    return true;
  };
  if (!attach()) {
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();

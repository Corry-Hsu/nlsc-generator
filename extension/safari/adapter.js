(() => {
  'use strict';
  let pending = null;
  let lastExportURL = null;
  const button = (label, action) => {
    const el = document.createElement('button');
    el.textContent = label;
    el.style.cssText = 'min-height:44px;margin:4px;padding:8px;color:white;background:#2c5f8a;border:0;border-radius:6px;font-size:15px';
    el.onclick = action;
    return el;
  };
  const box = id => {
    document.getElementById(id)?.remove();
    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'position:fixed;z-index:2147483647;left:8px;right:8px;bottom:8px;background:white;color:#142c42;padding:12px;border:2px solid #2c5f8a;border-radius:8px;font:14px -apple-system,sans-serif;max-height:70vh;overflow:auto;box-shadow:0 2px 12px #3338';
    document.body.append(el);
    return el;
  };
  window.NLSCiOS = Object.freeze({
    exportFile: async (text, filename) => {
      const blob = new Blob([text], { type: 'application/vnd.ms-excel' });
      if (lastExportURL) URL.revokeObjectURL(lastExportURL);
      lastExportURL = URL.createObjectURL(blob);
      const panel = box('nlsc-safari-export');
      const title = document.createElement('p');
      title.textContent = `Excel 已備妥：${filename}。點下載後查看 Safari 下載項目；此檔為原版 Excel XML。`;
      const link = document.createElement('a');
      link.href = lastExportURL; link.download = filename; link.textContent = '下載 Excel XML';
      link.style.cssText = 'display:inline-block;padding:14px;color:#2c5f8a';
      panel.append(title, link);
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        panel.append(button('分享／儲存到檔案', async () => {
          try { await navigator.share({ files: [file] }); }
          catch (error) { if (error.name !== 'AbortError') title.textContent = '分享失敗，請使用下載連結：' + error.message; }
        }));
      }
      panel.append(button('關閉', () => panel.remove()));
    }
  });
  const cancel = message => pending?.finish(false, message);
  window.addEventListener('message', event => {
    const m = event.data;
    if (event.source !== window || event.origin !== location.origin || typeof m?.id !== 'string' ||
        !['nlsc-save-map', 'nlsc-check-map-capture'].includes(m.type)) return;
    const reply = (ok, error) => window.postMessage({ type: 'nlsc-map-saved', id: m.id, ok, error }, location.origin);
    if (pending) { reply(false, '請先完成目前的手動截圖'); return; }
    if (document.visibilityState !== 'visible') { reply(false, '請保持 Safari 在前景'); return; }
    if (m.type === 'nlsc-check-map-capture') {
      const proceed = confirm('Safari 版無法自動儲存畫面。接下來每行會自動取景，你需要自行按 iPhone 截圖鍵，再點「已截圖，下一張」。要開始嗎？');
      reply(proceed, proceed ? undefined : '已取消手動截圖'); return;
    }
    const g = window.NLSCCaptureGeometry;
    try {
      if (!g.sameViewport(m.viewport, g.viewport()) || !g.sameRect(m.rect, g.clipRect(m.rect, g.viewport()))) throw Error('畫面已變更，請重試');
    } catch (error) { reply(false, error.message); return; }
    const panel = box('nlsc-safari-capture');
    const title = document.createElement('div');
    title.textContent = `本張：${m.filename}。點「隱藏提示 5 秒」，按 iPhone 截圖鍵；提示回來後再點下一張。截圖為整個手機畫面，請至相片裁切，檔名不會自動套用。`;
    panel.append(title);
    let timer, hiddenTimer;
    const finish = (ok, error) => {
      if (!pending || pending.id !== m.id) return;
      clearTimeout(timer); clearTimeout(hiddenTimer); pending = null; panel.remove();
      document.getElementById('nlsc-safari-recall')?.style.removeProperty('visibility');
      reply(ok, error);
    };
    pending = { id: m.id, finish };
    timer = setTimeout(() => finish(false, '手動截圖等待超過 10 分鐘'), 590000);
    panel.append(button('隱藏提示 5 秒', () => {
      panel.style.visibility = 'hidden';
      const recall = document.getElementById('nlsc-safari-recall');
      if (recall) recall.style.visibility = 'hidden';
      clearTimeout(hiddenTimer);
      hiddenTimer = setTimeout(() => { panel.style.visibility = ''; if (recall) recall.style.visibility = ''; }, 5000);
    }), button('已截圖，下一張', () => {
      try {
        if (!g.sameViewport(m.viewport, g.viewport())) throw Error('截圖期間畫面已變更，請重新執行');
        finish(true);
      } catch (error) { finish(false, error.message); }
    }), button('停止並還原地圖', () => finish(false, '使用者停止手動截圖')));
  });
  window.addEventListener('resize', () => cancel('畫面方向或大小已變更，請重新執行'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') cancel('已離開 Safari，手動取景停止'); });
  const recall = button('面板', () => window.NLSCRecallPanel?.());
  recall.id = 'nlsc-safari-recall';
  recall.style.cssText += ';position:fixed;right:8px;bottom:8px;z-index:2147483646';
  document.body.append(recall);
})();

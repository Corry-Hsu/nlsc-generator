// ==UserScript==
// @name         NLSC 地號與面積助手（iPhone Safari）
// @namespace    https://github.com/Corry-Hsu/nlsc-generator
// @version      1.2.0
// @description  批次查地號、擷取面積、Excel XML 匯出及逐行手動截圖取景
// @match        https://maps.nlsc.gov.tw/T09/mapshow.action*
// @run-at       document-end
// @inject-into  page
// @noframes
// ==/UserScript==

(() => {
if (location.origin !== "https://maps.nlsc.gov.tw" || location.pathname !== "/T09/mapshow.action" || window.__nlscSafariLoaded) return;
window.__nlscSafariLoaded = true;
// Shared by MAIN and isolated worlds; all coordinates are CSS pixels.
(function () {
  'use strict';
  const EPSILON = 1;
  const rectText = r => r ? `x=${Number(r.x).toFixed(1)}, y=${Number(r.y).toFixed(1)}, ${Number(r.width).toFixed(1)}×${Number(r.height).toFixed(1)}` : '無';
  function viewport() {
    const width = innerWidth, height = innerHeight;
    if (globalThis.visualViewport && Math.abs(globalThis.visualViewport.scale - 1) > 0.01) throw Error('目前使用觸控放大，請先結束觸控縮放再截圖');
    return { width, height, clipWidth: Math.min(width, document.documentElement?.clientWidth || width), clipHeight: Math.min(height, document.documentElement?.clientHeight || height), scrollX: globalThis.scrollX || 0, scrollY: globalThis.scrollY || 0 };
  }
  function sameViewport(a, b) {
    return a && b && ['width', 'height', 'clipWidth', 'clipHeight', 'scrollX', 'scrollY'].every(k => Number.isFinite(a[k]) && Number.isFinite(b[k]) && Math.abs(a[k] - b[k]) <= EPSILON);
  }
  function sameRect(a, b) {
    return a && b && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(a[k]) && Number.isFinite(b[k]) && Math.abs(a[k] - b[k]) <= EPSILON);
  }
  function clipRect(rect, vp, minimum = 100) {
    if (!rect || ![rect.x, rect.y, rect.width, rect.height, vp?.width, vp?.height, vp?.clipWidth, vp?.clipHeight].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0 || vp.width <= 0 || vp.height <= 0 || vp.clipWidth <= 0 || vp.clipHeight <= 0) throw Error(`地圖座標或尺寸無效（${rectText(rect)}）`);
    const x = Math.max(0, rect.x), y = Math.max(0, rect.y);
    const right = Math.min(vp.width, vp.clipWidth, rect.x + rect.width);
    const bottom = Math.min(vp.height, vp.clipHeight, rect.y + rect.height);
    const visible = { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
    if (visible.width < minimum || visible.height < minimum) throw Error(`地圖可見區域不足 ${minimum}px（地圖 ${rectText(rect)}；視窗 ${vp.width}×${vp.height}；可見 ${rectText(visible)}）`);
    return visible;
  }
  function fit(extent, size, mapRect, crop, minResolution = 0) {
    if (!Array.isArray(size) || size.length !== 2 || !size.every(n => Number.isFinite(n) && n > 0)) throw Error('地圖繪製尺寸無效');
    const sx = size[0] / mapRect.width, sy = size[1] / mapRect.height;
    const resolution = Math.max((extent[2] - extent[0]) / ((crop.width - 80) * sx), (extent[3] - extent[1]) / ((crop.height - 80) * sy), minResolution);
    const pixelX = (crop.x - mapRect.x + crop.width / 2) * sx;
    const pixelY = (crop.y - mapRect.y + crop.height / 2) * sy;
    return { resolution, center: [(extent[0] + extent[2]) / 2 - (pixelX - size[0] / 2) * resolution, (extent[1] + extent[3]) / 2 + (pixelY - size[1] / 2) * resolution] };
  }
  function contains(extent, size, mapRect, crop, center, resolution) {
    if (!center || !Number.isFinite(resolution) || resolution <= 0) return false;
    const left = mapRect.x + (size[0] / 2 + (extent[0] - center[0]) / resolution) * mapRect.width / size[0];
    const right = mapRect.x + (size[0] / 2 + (extent[2] - center[0]) / resolution) * mapRect.width / size[0];
    const top = mapRect.y + (size[1] / 2 - (extent[3] - center[1]) / resolution) * mapRect.height / size[1];
    const bottom = mapRect.y + (size[1] / 2 - (extent[1] - center[1]) / resolution) * mapRect.height / size[1];
    return left >= crop.x - EPSILON && right <= crop.x + crop.width + EPSILON && top >= crop.y - EPSILON && bottom <= crop.y + crop.height + EPSILON;
  }
  globalThis.NLSCCaptureGeometry = Object.freeze({ viewport, sameViewport, sameRect, clipRect, fit, contains, rectText });
})();

;
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

;
(function () {
  'use strict';
  const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  // ── 1. 基礎 DOM 與等待輔助 ─────────────────────────────────
  const $ = id => document.getElementById(id);
  const fire = (e, t) => e.dispatchEvent(new Event(t, { bubbles: true }));
  const wait = m => new Promise(r => setTimeout(r, m));
  const c = x => String(x ?? "").replace(/\s+/g, " ").trim();
  const v = e => {
    if (!e?.isConnected || e.hidden) return false;
    for (let n = e; n && n.nodeType === Node.ELEMENT_NODE; n = n.parentElement) {
      let x = getComputedStyle(n);
      if (x.display === "none" || x.visibility === "hidden" || x.visibility === "collapse") return false;
    }
    return true;
  };
  const w = (f, t = 2e4, m = "逾時") => new Promise((r, j) => {
    let a = Date.now(), q = setInterval(() => {
      try {
        let x = f();
        if (x) { clearInterval(q); r(x); }
        else if (Date.now() - a > t) { clearInterval(q); j(Error(m)); }
      } catch (e) { clearInterval(q); j(e); }
    }, 100);
  });
  const b = (r, n) => [...r.querySelectorAll('button,a,input[type="button"]')].find(e => v(e) && c(e.value || e.textContent || e.getAttribute("aria-label")) === n);
  const txt = x => [...document.querySelectorAll("body *")].find(e => v(e) && c(e.textContent) === x);
  const dlg = () => [...document.querySelectorAll('[role="dialog"],.ui-dialog')].filter(d => v(d) && d.querySelector('a[href^="#qryLand_tab2_"]') && c(d.textContent).includes("基本資訊")).slice(-1)[0];
  // 選項特徵與 DOM 輪詢不依賴面板可見度，也支援只有一個有效選項。
  const waitOptionsSmart = async (parent, value, childId, timeout = 15000) => {
    const child = $(childId);
    if (!parent || !child) throw new Error(`找不到選單元素 (#${childId})`);
    const hasValidOptions = el => !el?.disabled && [...(el?.options || [])].some(o =>
      String(o.value ?? '').trim() !== '' && !o.disabled &&
      !/載入中|讀取中|loading|請選擇|請選取/i.test(String(o.text ?? o.textContent ?? '')));
    const getSig = el => JSON.stringify([Boolean(el?.disabled), [...(el?.options || [])].map(o =>
      [o.value, o.text ?? o.textContent ?? '', Boolean(o.disabled)])]);
    if (parent.value === value && hasValidOptions(child)) return true;
    const beforeSig = getSig(child);
    parent.value = value;
    if (parent.value !== value) throw new Error(`找不到選單項 (${value})`);
    fire(parent, 'change');
    const startedAt = Date.now();
    let refreshed = !hasValidOptions(child), stableSig = null, stableSince = startedAt;
    while (Date.now() - startedAt < timeout) {
      if (parent.value !== value) throw new Error(`等待選單期間上層條件已變更 (#${childId})`);
      const current = $(childId), signature = getSig(current);
      if (current !== child || signature !== beforeSig || !hasValidOptions(current)) refreshed = true;
      if (refreshed && hasValidOptions(current)) {
        if (signature !== stableSig) { stableSig = signature; stableSince = Date.now(); }
        else if (Date.now() - stableSince >= 150) return true;
      } else stableSig = null;
      await wait(100);
    }
    throw new Error(`切換選單項 (${value}) 逾時：等待 ${timeout / 1000} 秒仍無有效且穩定的選項 (#${childId})`);
  };

  const resultRows = () => [...document.querySelectorAll('tr')]
    .filter(r => r.isConnected && /\d+(?:-\d+)?\s*地號/.test(c(r.textContent)));
  const landKey = value => String(value).trim().split('-').map(x => String(Number(x))).join('-');
  const matchesResult = (row, snapshot) => {
    const text = c(row.textContent).replace(/\s+/g, '');
    const section = c(snapshot.sectionText).replace(/\s+/g, '');
    const match = text.match(/段(?:[^\d]*?)(\d+(?:-\d+)?)地號/);
    const code = String(snapshot.section || '').replace(/-0$/, '').match(/(\d+)$/)?.[1];
    const resultCode = text.match(/\([A-Z]*[_-]?(\d+)(?:-\d+)?\)/)?.[1];
    return text.includes(section) && match && landKey(match[1]) === landKey(snapshot.landcode) &&
      code && resultCode && Number(code) === Number(resultCode);
  };
  let batchBusy = false;
  let captureBusy = false;
  let areaBusy = false;
  let queryUncertain = false;
  let inputGroups = [];
  let queriedItems = [];
  const coloredParcels = new Map();
  const parcelNames = new Map();
  const requestParcel = Symbol('nlscParcel');
  const parcelId = (office, section, land) => [office, String(section).replace(/-0$/, ''), land].join('/');
  const validExtent = e => Array.isArray(e) && e.length === 4 && e.every(Number.isFinite) && e[2] > e[0] && e[3] > e[1];
  const mergeExtents = extents => extents.reduce((a, e) => [Math.min(a[0], e[0]), Math.min(a[1], e[1]), Math.max(a[2], e[2]), Math.max(a[3], e[3])], [Infinity, Infinity, -Infinity, -Infinity]);

  // Observe actual tint responses, rather than assuming every query result is colored.
  w(() => win.cadastralMgr?.catchPropertyRefactor && win.cadastralMgr, 60000, '著色元件未就緒').then(manager => {
    const originalRequest = manager.catchPropertyRefactor;
    const originalRender = manager._renderFirstGroupPayload;
    if (typeof originalRender !== 'function') return;
    manager.catchPropertyRefactor = function (office, section, land, options = {}) {
      const key = parcelId(office, section, land);
      const selected = $('section')?.value || '';
      const [selectedOffice, selectedSection] = selected.split('_');
      if (!options.imgflag && selectedOffice === String(office) &&
          String(selectedSection).split('-')[0] === String(section).split('-')[0]) {
        parcelNames.set(key, {
          town: $('area_office')?.selectedOptions?.[0]?.text,
          section: $('section')?.selectedOptions?.[0]?.text,
          land: $('landcode')?.value
        });
      }
      return originalRequest.call(this, office, section, land, { ...options, [requestParcel]: key });
    };
    manager._renderFirstGroupPayload = function (json, options) {
      const before = new Set(this.groupLayer.getLayers().getArray());
      const result = originalRender.call(this, json, options);
      const key = options[requestParcel];
      if (options.imgflag && key) {
        const layers = this.groupLayer.getLayers().getArray().filter(layer => !before.has(layer));
        if (layers.length) coloredParcels.set(key, { key, layers, ...parcelNames.get(key) });
      }
      return result;
    };
  }).catch(error => console.warn('NLSC 截圖追蹤未啟動', error));

  function saveMapImage(rect, filename, viewport, type = 'nlsc-save-map') {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const finish = (error) => {
        clearTimeout(timer);
        window.removeEventListener('message', receive);
        error ? reject(Error(error)) : resolve();
      };
      const receive = event => {
        if (event.source === window && event.origin === location.origin && event.data?.type === 'nlsc-map-saved' && event.data.id === id) finish(event.data.ok ? null : event.data.error || '截圖失敗');
      };
      const timer = setTimeout(() => finish('等待手動截圖超過 10 分鐘，已停止並還原地圖'), 600000);
      window.addEventListener('message', receive);
      window.postMessage({ type, id, rect, filename, viewport }, location.origin);
    });
  }

  function waitForMap(map) {
    return new Promise((resolve, reject) => {
      const done = () => { clearTimeout(timer); map.un('rendercomplete', done); resolve(); };
      const timer = setTimeout(() => { map.un('rendercomplete', done); reject(Error('地圖載入逾時，未儲存本張圖片')); }, 30000);
      map.on('rendercomplete', done);
      map.renderSync();
    });
  }

  async function prepareMapCapture(map, extent) {
    const geometry = win.NLSCCaptureGeometry;
    if (!geometry) throw Error('截圖模組未載入，請重新載入外掛及網頁');
    const view = map.getView();
    const element = map.getViewport?.() || map.getTargetElement();
    let lastChange = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      map.updateSize();
      const viewport = geometry.viewport();
      const rect = element.getBoundingClientRect();
      const crop = geometry.clipRect(rect, viewport, 160);
      const size = map.getSize()?.slice();
      view.setRotation(0);
      let fit = geometry.fit(extent, size, rect, crop, view.getMinResolution?.() || 0);
      // Some map versions snap resolutions. Recompute the offset using that resolution.
      if (view.getConstrainedResolution) fit = geometry.fit(extent, size, rect, crop, view.getConstrainedResolution(fit.resolution, 1));
      view.setResolution(fit.resolution);
      view.setCenter(fit.center);
      await waitForMap(map);
      await wait(800);
      const currentViewport = geometry.viewport();
      const currentRect = element.getBoundingClientRect();
      const currentSize = map.getSize();
      if (!geometry.sameViewport(viewport, currentViewport) || !geometry.sameRect(rect, currentRect) || !currentSize || currentSize.some((n, i) => n !== size[i])) {
        lastChange = `地圖由 ${geometry.rectText(rect)} 變為 ${geometry.rectText(currentRect)}；視窗由 ${viewport.width}×${viewport.height} 變為 ${currentViewport.width}×${currentViewport.height}`;
        continue;
      }
      if (Math.abs(view.getRotation()) > 0.0001 || !geometry.contains(extent, size, rect, crop, view.getCenter(), view.getResolution())) throw Error(`著色範圍無法完整放入可見地圖（可見 ${geometry.rectText(crop)}；縮放解析度 ${view.getResolution()}），未儲存本張圖片`);
      return { rect: crop, viewport: currentViewport };
    }
    throw Error(`地圖版面持續變動，重新取景 3 次仍未穩定（${lastChange}），請等待網站版面穩定後重試`);
  }

  async function captureSections(onProgress) {
    if (captureBusy || batchBusy || areaBusy) throw Error('請等待目前作業完成');
    const manager = win.cadastralMgr, map = manager?.map;
    if (!map || !manager.groupLayer?.getVisible()) throw Error('找不到可見的著色地圖');
    const live = new Set(manager.groupLayer.getLayers().getArray());
    const groups = new Map();
    for (const parcel of coloredParcels.values()) {
      const layers = parcel.layers.filter(layer => live.has(layer) && layer.getVisible() && layer.getOpacity() > 0 && layer.getSource());
      if (!layers.length) continue;
      if (!parcel.town || !parcel.section || !/^\d+(?:-\d+)?$/.test(parcel.land || '')) throw Error('部分著色地號缺少鄉鎮資料，請重新查詢並著色後再截圖');
      const extents = layers.map(layer => layer.getSource().getImageExtent?.()).filter(validExtent);
      if (extents.length !== layers.length) throw Error('無法辨識著色地號範圍，請重新查詢並著色');
      const memberships = inputGroups.length ? inputGroups.filter(g => g.townName === parcel.town && g.section === parcel.section && g.lands.some(land => landKey(land) === landKey(parcel.land))) : [{ id: parcel.town + '/' + parcel.section }];
      for (const membership of memberships) {
      const key = membership.id;
      if (!groups.has(key)) groups.set(key, { town: parcel.town, section: parcel.section, lands: new Set(), layers: new Set(), extents: [] });
      const group = groups.get(key);
      group.lands.add(parcel.land);
      layers.forEach(layer => group.layers.add(layer));
      group.extents.push(...extents);
      }
    }
    for (const expected of inputGroups) {
      const actual = groups.get(expected.id);
      if (!actual || expected.lands.some(land => ![...actual.lands].some(value => landKey(value) === landKey(land)))) throw Error(`第 ${expected.id} 組尚有地號未著色，請完成查詢及擷取面積後再截圖`);
      actual.lands = new Set(expected.lands);
    }
    if (!groups.size) throw Error('尚無可辨識的著色地號。請先查詢，再按「擷取面積」或網站的「著色」');
    captureBusy = true;
    const view = map.getView();
    const previous = { center: view.getCenter()?.slice(), resolution: view.getResolution(), rotation: view.getRotation() };
    const visibility = new Map(manager.groupLayer.getLayers().getArray().map(layer => [layer, layer.getVisible()]));
    const panel = $('nlsc-integrated-panel');
    const panelVisibility = panel?.style.visibility;
    const interactions = map.getInteractions().getArray().map(i => [i, i.getActive()]);
    let completed = 0;
    try {
      // Check browser permission before changing any view, layer or interaction.
      await saveMapImage(null, null, null, 'nlsc-check-map-capture');
      interactions.forEach(([i]) => i.setActive(false));
      for (const group of (inputGroups.length ? inputGroups.map(g => groups.get(g.id)) : groups.values())) {
        if (document.visibilityState !== 'visible') throw Error('請保持此分頁在前景');
        onProgress?.(completed + 1, groups.size, group);
        visibility.forEach((_, layer) => layer.setVisible(group.layers.has(layer)));
        if (panel) panel.style.visibility = 'hidden';
        const extent = mergeExtents(group.extents);
        const capture = await prepareMapCapture(map, extent);
        const lands = [...group.lands];
        const filename = `${group.town}_${group.section}_${lands.join('、')}`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
        if (filename.length > 170) throw Error('地號過多，檔名超過限制，請將該行分批處理');
        await saveMapImage(capture.rect, filename + '.png', capture.viewport);
        completed++;
      }
      return completed;
    } catch (error) {
      console.warn('NLSC 地段截圖停止', { completed, total: groups.size, error: error.message });
      throw Error(`已確認 ${completed}/${groups.size} 組手動截圖；${error.message}`);
    } finally {
      visibility.forEach((visible, layer) => layer.setVisible(visible));
      if (previous.center) view.setCenter(previous.center);
      view.setResolution(previous.resolution);
      view.setRotation(previous.rotation);
      interactions.forEach(([i, active]) => i.setActive(active));
      if (panel) panel.style.visibility = panelVisibility;
      captureBusy = false;
    }
  }
  // ── 2. 鄉鎮代碼與文字解析器 ───────────────────────────────
  const TOWNS = {
    '三地門鄉':'T26','九如鄉':'T08','內埔鄉':'T13','六龜鄉':'T34',
    '南州鄉':'T20','屏東市':'T01','來義鄉':'T30','佳冬鄉':'T21',
    '枋山鄉':'T25','枋寮鄉':'T16','東港鎮':'T03','林邊鄉':'T19',
    '泰武鄉':'T29','春日鄉':'T31','獅子鄉':'T32','琉球鄉':'T22',
    '牡丹鄉':'T33','瑪家鄉':'T28','萬丹鄉':'T05','萬巒鄉':'T12',
    '竹田鄉':'T14','里港鄉':'T09','長治鄉':'T06','恆春鎮':'T04',
    '崁頂鄉':'T18','新園鄉':'T17','新埤鄉':'T15','潮州鎮':'T02',
    '滿州鄉':'T24','麟洛鄉':'T07','霧臺鄉':'T27','霧台鄉':'T27',
    '高樹鄉':'T11','鹽埔鄉':'T10','車城鄉':'T23'
  };
  const TOWN_ALIASES = { '滿洲鄉': '滿州鄉' };
  const TOWN_KEYS = [...Object.keys(TOWNS), ...Object.keys(TOWN_ALIASES)].sort((a, b) => b.length - a.length);

  function matchTown(str) {
    for (const inputName of TOWN_KEYS) {
      if (str.startsWith(inputName)) {
        const name = TOWN_ALIASES[inputName] || inputName;
        return { name, code: TOWNS[name], rest: str.slice(inputName.length) };
      }
    }
    return null;
  }

  function parseGroup(raw) {
    const str = raw.trim().replace(/\s+/g, '');
    const town = matchTown(str);
    if (!town) return { error: `無法辨識鄉鎮名：「${raw.trim().slice(0, 6)}…」` };

    const rest = town.rest.trim();
    const m = rest.match(/^(.+段)([\s\S]*)/);
    if (!m) return { error: `找不到地段名（需含「段」字）：「${rest.slice(0, 10)}」` };

    const section = m[1];
    const landsRaw = m[2];
    const lands = [...new Set(landsRaw.split(/[、，,\s\t\u3000]+/).map(s => s.trim()).filter(Boolean))];
    if (lands.length === 0) return { error: `地段「${section}」底下沒有地號` };

    return { townName: town.name, townCode: town.code, section, lands };
  }

  function parseInputToBatch(input) {
    const rawGroups = input.split(/[\n；;]+/).map(s => s.trim()).filter(Boolean);
    if (rawGroups.length === 0) return { error: '請先輸入地號清單' };

    const groups = [];
    for (const raw of rawGroups) {
      const g = parseGroup(raw);
      if (g.error) return { error: g.error };
      groups.push({ ...g, id: groups.length + 1 });
    }

    const batchList = [];
    for (const g of groups) {
      g.lands.forEach(land => {
        batchList.push({ town: g.townCode, townName: g.townName, section: g.section, land, groupId: g.id, groupLands: g.lands });
      });
    }
    return { batchList, firstTown: groups[0]?.townCode };
  }

  // ── 3. 核心 nlsc 物件 ──────────────────────────────────────
  win.nlsc = {
    version: "1.1.3",
    info() {
      const o = {
        city: $('city')?.value,
        cityText: $('city')?.selectedOptions?.[0]?.text,
        area: $('area_office')?.value,
        areaText: $('area_office')?.selectedOptions?.[0]?.text,
        section: $('section')?.value,
        sectionText: $('section')?.selectedOptions?.[0]?.text,
        sectioncode: $('sectioncode')?.value,
        landcode: $('landcode')?.value
      };
      console.table(o);
      return o;
    },
    async setCity(c) {
      const e = $('city');
      if (!e) throw '找不到縣市選單 (#city)';
      if (!/^[A-Z]$/.test(c)) {
        const m = [...e.options].find(o => o.text === c);
        if (!m) throw '找不到縣市:' + c;
        c = m.value;
      }
      await waitOptionsSmart(e, c, 'area_office');
      return '縣市=' + c;
    },
    async setTown(c) {
      const e = $('area_office');
      if (!e) throw '找不到鄉鎮選單 (#area_office)';
      if (!/^T\d{2}$/.test(c)) c = TOWNS[c] || c;
      await waitOptionsSmart(e, c, 'section');
      return '鄉鎮=' + c;
    },
    sections() {
      const s = $('section');
      return s ? [...s.options].filter(o => o.value).map(o => ({ code: o.value, name: o.text })) : [];
    },
    setSection(c) {
      const s = $('section');
      if (!s) throw '找不到地段選單 (#section)';
      const o = [...s.options].find(o => o.value === c) || [...s.options].find(o => o.text === c);
      if (!o) throw '找不到地段:' + c;
      s.value = o.value;
      fire(s, 'change');
      return '地段=' + o.value + ' ' + o.text;
    },
    setLand(l) {
      const i = $('landcode');
      if (!i) throw '找不到地號輸入框 (#landcode)';
      i.focus();
      i.value = String(l);
      fire(i, 'input');
      fire(i, 'change');
      return '地號=' + l;
    },
    locate() {
      const b = $('div_cross_query');
      if (!b) throw '找不到定位按鈕 (#div_cross_query)';
      b.click();
      return '定位';
    },
    async queryBatch(list, d = 1800, onProgress = null) {
      if (batchBusy || captureBusy || areaBusy) throw new Error('請等待目前作業完成');
      if (queryUncertain) throw new Error('上一筆查詢逾時或結果不一致，請重新整理頁面後重試');
      batchBusy = true;
      const results = [];
      queriedItems = [];
      win.nlscAreaResults = [];
      inputGroups = [...new Map(list.filter(x => x.groupId != null).map(x => [x.groupId, { id: x.groupId, townName: x.townName, section: x.section, lands: x.groupLands }])).values()];
      let inFlight = false;
      try {
        await this.setCity('T');
        for (let idx = 0; idx < list.length; idx++) {
          const item = Object.freeze({ ...list[idx] });
          if (!item.town || !item.section || item.land == null || !/^\d+(?:-\d+)?$/.test(String(item.land))) {
            throw new Error('地號資料不完整或格式錯誤');
          }
          if (onProgress) onProgress(idx + 1, list.length, item);
          const prior = results.find(x => x.town === item.town && x.section === item.section && landKey(x.land) === landKey(item.land));
          if (prior) { results.push({ ...prior, ...item }); continue; }
          await this.setTown(item.town);
          this.setSection(item.section);
          this.setLand(item.land);
          const snapshot = Object.freeze({ ...this.info() });
          if (snapshot.area !== item.town || snapshot.sectionText !== item.section ||
              landKey(snapshot.landcode) !== landKey(item.land)) {
            throw new Error('查詢條件與輸入不一致，已停止查詢');
          }
          const before = new Map(resultRows().map(row => [row, c(row.textContent)]));
          inFlight = true;
          this.locate();
          const row = await w(() => resultRows().find(row =>
            (!before.has(row) || before.get(row) !== c(row.textContent)) &&
            matchesResult(row, snapshot)), 30000,
            '未收到符合本筆地段／地號的查詢結果，已停止；請重新整理頁面後重試');
          // Keep the form on this parcel until its result has settled.
          const text = c(row.textContent);
          await wait(Math.max(500, Number(d) || 0));
          const current = this.info();
          if (!row.isConnected || c(row.textContent) !== text ||
              !matchesResult(row, snapshot) || current.area !== snapshot.area ||
              current.section !== snapshot.section || current.sectionText !== snapshot.sectionText ||
              landKey(current.landcode) !== landKey(snapshot.landcode)) {
            throw new Error('查詢期間條件或結果被變更，已停止；請重新整理頁面後重試');
          }
          results.push({ ...item, snapshot, resultText: text });
          inFlight = false;
        }
        queriedItems = results;
        console.log('查詢完成 ' + results.length + ' 筆');
        return results;
      } catch (error) {
        if (inFlight) queryUncertain = true;
        throw error;
      } finally {
        batchBusy = false;
      }
    },
    async collectAreas(d = 700, onProgress = null) {
      if (batchBusy || captureBusy || areaBusy) throw new Error('請等待目前作業完成');
      areaBusy = true;
      try {
      let rows = [...document.querySelectorAll("tr")].filter(r => v(r) && b(r, "詳細..") && b(r, "著色")), a = [];
      const work = inputGroups.length ? queriedItems.map(item => ({ item, row: rows.find(row => matchesResult(row, item.snapshot)) })) : rows.map(row => ({ row }));
      if (inputGroups.length && (!work.length || work.some(x => !x.row))) throw Error('清單查詢尚未完成或查詢結果已移除，請重新執行查詢定位');
      const cachedAreas = new Map();
      for (let idx = 0; idx < work.length; idx++) {
        let { row: r, item } = work[idx];
        const metadata = item ? { 清單序號: item.groupId, 清單地段號: `${item.townName}${item.section} ${item.groupLands.join("、")}` } : {};
        let m = c(r.textContent).match(/([^\s()]+段[^\s()]*)\s+([\d]+(?:-[\d]+)?)地號/);
        if (!m) continue;
        if (onProgress) onProgress(idx + 1, work.length, `${m[1]} ${m[2]}`);
        try {
          const area = cachedAreas.has(r) ? cachedAreas.get(r) : await read(r);
          cachedAreas.set(r, area);
          a.push({ ...metadata, 地段: m[1], 地號: m[2], "面積(㎡)": area, 著色確認: "是", 狀態: "完成", 錯誤: "" });
        } catch (e) {
          a.push({ ...metadata, 地段: m[1], 地號: m[2], "面積(㎡)": "", 著色確認: "否", 狀態: "失敗", 錯誤: e.message });
          console.error(m[1], m[2], e);
        }
        await wait(d);
      }
      win.nlscAreaResults = a;
      console.table(a);
      console.table(sum(a));
      return a;
      } finally { areaBusy = false; }
    },
    captureSections,
    exportAreaExcel(f = "nlsc-area-results.xml") {
      let a = win.nlscAreaResults || [];
      if (!a.length) throw new Error("目前沒有可匯出的面積資料，請先執行［擷取面積］");
      if (win.NLSCiOS) {
        const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sh("逐筆結果", a)}${sh("清單加總", sum(a))}</Workbook>`;
        return win.NLSCiOS.exportFile(xml, f);
      }
      let x = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sh("逐筆結果", a)}${sh("清單加總", sum(a))}</Workbook>`,
          u = URL.createObjectURL(new Blob([x], { type: "application/vnd.ms-excel" })),
          e = document.createElement("a");
      e.href = u;
      e.download = f;
      e.click();
      setTimeout(() => URL.revokeObjectURL(u), 1e3);
    },
    TOWNS: TOWNS
  };

  async function read(r) {
    b(r, "著色")?.click();
    let y = await w(() => txt("資料著色中"), 1500).then(() => 1, () => 0);
    y ? await w(() => !txt("資料著色中"), 2e4, "著色逾時") : await wait(700);
    b(r, "詳細..")?.click();
    let d = await w(dlg, 2e4, "詳細視窗未出現"),
        t = d.querySelector('a[href^="#qryLand_tab2_"]');
    t.click();
    let a = await w(() => {
      let p = document.querySelector(t.hash);
      if (!p || !v(p)) p = d;
      let m = c(p.textContent).replaceAll(",", "").match(/面積\s*([\d.]+)\s*(?:平方公尺|㎡)/);
      return m && +m[1];
    }, 2e4, "找不到面積"),
    x = d.querySelector(".ui-dialog-titlebar-close") || b(d, "Close");
    x?.click();
    return a;
  }

  function sum(a) {
    let g = {};
    a.forEach(x => {
      const key = x.清單序號 ?? x.地段;
      if (!g[key]) g[key] = [];
      g[key].push(x);
    });
    return Object.values(g).map(r => {
      let n = r.filter(x => x.狀態 === "完成").map(x => +x["面積(㎡)"]),
          t = n.reduce((a, b) => a + b, 0);
      return {
        ...(r[0]?.清單序號 != null ? { 清單序號: r[0].清單序號, 清單地段號: r[0].清單地段號 } : {}),
        地段: r[0]?.地段,
        地號數: r.length,
        狀態: n.length === r.length ? "完成" : "未完成（含擷取失敗地號）",
        各筆面積: r.map(x => `${x.地號}: ${x.狀態 === "完成" ? (+x["面積(㎡)"]).toFixed(2) : "擷取失敗"}`).join("；"),
        加總計算式: n.length === r.length ? `${n.map(x => x.toFixed(2)).join(" + ")} = ${t.toFixed(2)} ㎡` : "尚有失敗地號，無法計算完整合計",
        "合計(㎡)": n.length === r.length ? +t.toFixed(2) : ""
      };
    });
  }

  const esc = x => String(x ?? "").replace(/[<>&'"]/g, x => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[x]);
  const sh = (n, a) => {
    let k = a.length ? Object.keys(a[0]) : ["無資料"],
        d = x => `<Cell><Data ss:Type="${typeof x === "number" ? "Number" : "String"}">${esc(x)}</Data></Cell>`;
    return `<Worksheet ss:Name="${n}"><Table><Row>${k.map(d).join("")}</Row>${a.map(r => `<Row>${k.map(k => d(r[k])).join("")}</Row>`).join("")}</Table></Worksheet>`;
  };

  // ── 4. 建立強化邊界錨定與快捷召回的懸浮面板 ───────────────
  function createUI() {
    if (document.getElementById('nlsc-integrated-panel')) return;
    if (!document.body) {
      setTimeout(createUI, 500);
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'nlsc-integrated-panel';
    panel.style.cssText = `
      position: fixed; z-index: 2147483647;
      width: 320px; background: #ffffff; border: 1px solid #d8d4cc;
      border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.22);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", sans-serif;
      font-size: 13px; color: #1a1816; overflow: hidden;
    `;

    // 重設回右上角標準位置的共用函式
    function resetToDefaultPos() {
      panel.style.left = 'auto';
      panel.style.bottom = 'auto';
      panel.style.top = '12px';
      panel.style.right = '18px';
      localStorage.removeItem('nlsc_panel_anchor');
    }

    // 讀取相對邊界錨定設定
    try {
      const anchor = JSON.parse(localStorage.getItem('nlsc_panel_anchor') || 'null');
      if (anchor && typeof anchor.top === 'number') {
        const winW = document.documentElement.clientWidth || window.innerWidth;
        const winH = document.documentElement.clientHeight || window.innerHeight;

        // 垂直安全檢驗
        if (anchor.top >= 0 && anchor.top < winH - 60) {
          panel.style.top = anchor.top + 'px';
        } else {
          panel.style.top = '12px';
        }

        // 水平錨定（右側優先，徹底避免漂移到虛空）
        if (anchor.isRight && typeof anchor.right === 'number' && anchor.right >= 0 && anchor.right < winW - 80) {
          panel.style.left = 'auto';
          panel.style.right = anchor.right + 'px';
        } else if (!anchor.isRight && typeof anchor.left === 'number' && anchor.left >= 0 && anchor.left < winW - 80) {
          panel.style.right = 'auto';
          panel.style.left = anchor.left + 'px';
        } else {
          resetToDefaultPos();
        }
      } else {
        resetToDefaultPos();
      }
    } catch (e) {
      resetToDefaultPos();
    }

    panel.innerHTML = `
      <div id="nlsc-header" style="background: #2c5f8a; color: #fff; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none;">
        <span style="font-weight: 600; letter-spacing: 0.03em;">✥ NLSC 地號與面積助手</span>
        <div style="display: flex; gap: 4px; align-items: center;">
          <span id="nlsc-toggle-btn" style="font-size: 11px; padding: 2px 5px; cursor: pointer; background: rgba(255,255,255,0.2); border-radius: 3px;">收合 ▲</span>
        </div>
      </div>
      <div id="nlsc-body" style="padding: 12px;">
        <label style="display: block; font-size: 11px; font-weight: 600; color: #6b6560; margin-bottom: 5px;">輸入地號清單</label>
        <textarea id="nlsc-input" placeholder="屏東市光明段 477、512&#10;屏東市龍華段 1385" style="width: 100%; box-sizing: border-box; height: 80px; font-family: monospace; font-size: 12px; line-height: 1.5; border: 1px solid #d8d4cc; border-radius: 4px; padding: 6px; background: #fbfaf8; resize: vertical; outline: none;"></textarea>
        
        <div style="display: flex; gap: 6px; margin-top: 8px;">
          <button id="btn-batch-query" style="flex: 2; padding: 6px; background: #2c5f8a; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">開始查詢定位</button>
          <button id="btn-input-clear" style="flex: 1; padding: 6px; background: #f5f3ee; color: #6b6560; border: 1px solid #d8d4cc; border-radius: 4px; cursor: pointer; font-size: 12px;">清空</button>
        </div>

        <div style="border-top: 1px solid #eee; margin: 10px 0;"></div>

        <div style="display: flex; gap: 6px;">
          <button id="btn-collect-area" style="flex: 1; padding: 6px; background: #2d6a4f; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">擷取面積</button>
          <button id="btn-export-excel" style="flex: 1; padding: 6px; background: #1a3d5c; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">匯出 Excel</button>
        </div>
        <button id="btn-capture-sections" style="width:100%;margin-top:8px;padding:7px;background:#72502d;color:white;border:0;border-radius:4px;cursor:pointer;">逐行取景（手動截圖）</button>
        <div style="font-size:11px;color:#6b6560;margin-top:5px;">Safari 版會逐行取景；每張需自行按 iPhone 截圖鍵。Excel 請從匯出視窗下載或分享。建議橫向操作。</div>

        <div id="nlsc-status-box" style="margin-top: 10px; padding: 6px 8px; background: #f5f3ee; border-radius: 4px; font-size: 11px; color: #6b6560; min-height: 18px; word-break: break-all;">
          系統就緒 v1.1.3｜智慧選單＋隱藏結果讀取｜右下角「面板」可召回
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    const header = document.getElementById('nlsc-header');
    const body = document.getElementById('nlsc-body');
    const toggleBtn = document.getElementById('nlsc-toggle-btn');
    const inputEl = document.getElementById('nlsc-input');
    const statusBox = document.getElementById('nlsc-status-box');

    // 記憶文字還原
    const savedText = localStorage.getItem('nlsc_last_input');
    if (savedText) inputEl.value = savedText;
    inputEl.addEventListener('input', () => {
      localStorage.setItem('nlsc_last_input', inputEl.value);
    });

    const setStatus = (msg, color = '#6b6560') => {
      statusBox.style.color = color;
      statusBox.innerText = msg;
    };

    // 鍵盤快捷鍵 Alt + Q 召回防呆
    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'q' || e.key === 'Q')) {
        resetToDefaultPos();
        body.style.display = 'block';
        toggleBtn.innerText = '收合 ▲';
        setStatus('已透過快捷鍵 Alt+Q 召回');
      }
    });

    // 拖曳處理（以可視區邊界相對錨定）
    let isDragging = false, startX, startY, initLeft, initTop;
    header.addEventListener('mousedown', (e) => {
      if (e.target.id === 'nlsc-toggle-btn') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      initLeft = rect.left;
      initTop = rect.top;

      panel.style.right = 'auto';
      panel.style.left = initLeft + 'px';
      panel.style.top = initTop + 'px';

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
      if (!isDragging) return;
      const winW = document.documentElement.clientWidth || window.innerWidth;
      const winH = document.documentElement.clientHeight || window.innerHeight;

      let newLeft = initLeft + (e.clientX - startX);
      let newTop = initTop + (e.clientY - startY);

      newLeft = Math.max(0, Math.min(winW - panel.offsetWidth, newLeft));
      newTop = Math.max(0, Math.min(winH - 40, newTop));

      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
    }

    function onMouseUp() {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const rect = panel.getBoundingClientRect();
      const winW = document.documentElement.clientWidth || window.innerWidth;

      // 判斷面板靠近螢幕左側還是右側，存入相對錨定
      const isRight = rect.left > (winW / 2);
      const anchorData = {
        isRight: isRight,
        top: Math.round(rect.top),
        right: Math.round(winW - rect.right),
        left: Math.round(rect.left)
      };

      localStorage.setItem('nlsc_panel_anchor', JSON.stringify(anchorData));
      localStorage.removeItem('nlsc_panel_pos');
    }

    // 收合 / 展開
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      toggleBtn.innerText = isHidden ? '收合 ▲' : '展開 ▼';
    };

    // 清空輸入
    document.getElementById('btn-input-clear').onclick = () => {
      inputEl.value = '';
      localStorage.removeItem('nlsc_last_input');
      setStatus('已清空輸入內容');
      inputEl.focus();
    };

    // 批次查詢
    document.getElementById('btn-batch-query').onclick = async () => {
      if (batchBusy) return;
      const rawText = inputEl.value;
      const parsed = parseInputToBatch(rawText);

      if (parsed.error) {
        setStatus(`⚠ ${parsed.error}`, '#8b2020');
        return;
      }

      setStatus(`準備查詢，共 ${parsed.batchList.length} 筆...`, '#2c5f8a');
      const controls = [...panel.querySelectorAll('button,textarea')];
      controls.forEach(el => el.disabled = true);
      try {
        await win.nlsc.queryBatch(parsed.batchList, 1800, (curr, total, item) => {
          setStatus(`查詢進度: ${curr}/${total} (${item.section} ${item.land})`, '#2c5f8a');
        });
        setStatus(`查詢完成！共 ${parsed.batchList.length} 筆，可點擊［擷取面積］`, '#2d6a4f');
      } catch (err) {
        setStatus(`查詢失敗: ${err.message || err}`, '#8b2020');
        console.error(err);
      } finally {
        controls.forEach(el => el.disabled = false);
      }
    };

    // 擷取面積
    document.getElementById('btn-collect-area').onclick = async () => {
      if (batchBusy || captureBusy || areaBusy) return;
      const controls = [...panel.querySelectorAll('button,textarea')];
      controls.forEach(el => el.disabled = true);
      setStatus('開始檢查並爬取面積...', '#2d6a4f');
      try {
        await win.nlsc.collectAreas(700, (curr, total, name) => {
          setStatus(`爬取進度: ${curr}/${total} (${name})`, '#2d6a4f');
        });
        const len = win.nlscAreaResults?.length || 0;
        setStatus(`面積擷取完成！共 ${len} 筆，可點擊［匯出 Excel］`, '#2d6a4f');
      } catch (err) {
        setStatus(`爬取失敗: ${err.message || err}`, '#8b2020');
        console.error(err);
      } finally {
        controls.forEach(el => el.disabled = false);
      }
    };

    document.getElementById('btn-capture-sections').onclick = async () => {
      if (batchBusy || captureBusy || areaBusy) return;
      const controls = [...panel.querySelectorAll('button,textarea')];
      controls.forEach(el => el.disabled = true);
      try {
        const count = await win.nlsc.captureSections((curr, total, group) => setStatus(`截圖 ${curr}/${total}：${group.town}${group.section}`, '#72502d'));
        setStatus(`已完成 ${count} 組取景；手動截圖請至「相片」查看`, '#2d6a4f');
      } catch (error) {
        setStatus(`截圖停止：${error.message}`, '#8b2020');
      } finally { controls.forEach(el => el.disabled = false); }
    };
    window.addEventListener('message', event => {
      if (event.source === window && event.origin === location.origin && event.data?.type === 'nlsc-start-capture') document.getElementById('btn-capture-sections').click();
    });

    // 匯出 Excel
    document.getElementById('btn-export-excel').onclick = async () => {
      try {
        await win.nlsc.exportAreaExcel();
        setStatus('Excel 已準備好，請在匯出視窗下載或分享', '#2d6a4f');
      } catch (err) {
        setStatus(`匯出失敗: ${err.message || err}`, '#8b2020');
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(createUI, 800));
  } else {
    setTimeout(createUI, 800);
  }
})();

;
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

})();

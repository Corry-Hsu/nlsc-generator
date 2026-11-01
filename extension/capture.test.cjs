const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(fail = false, options = {}) {
  const layer = extent => ({ visible: true, getVisible() { return this.visible; }, setVisible(v) { this.visible = v; }, getOpacity: () => 1, getSource: () => ({ getImageExtent: () => extent }) });
  const a = layer([0, 0, 100, 100]), b = layer([100, 0, 200, 100]), other = layer([500, 500, 600, 600]);
  const layers = [a, b, other];
  const view = { center: [900, 800], resolution: 10, rotation: 0.3, getCenter() { return this.center; }, getResolution() { return this.resolution; }, getRotation() { return this.rotation; }, setCenter(v) { this.center = options.fixedCenter || v; }, setResolution(v) { this.resolution = v; }, setRotation(v) { this.rotation = v; }, getMinResolution: () => 0.01 };
  const listeners = new Map(), files = [];
  const panel = { style: { visibility: '' } };
  const interaction = { active: true, getActive() { return this.active; }, setActive(v) { this.active = v; } };
  const defaultRect = { x: 0, y: 0, width: 1000, height: 700 };
  const map = { getView: () => view, getInteractions: () => ({ getArray: () => [interaction] }), updateSize() {}, getSize: () => options.size || [1000, 700], on: (name, cb) => listeners.set(name, cb), un: name => listeners.delete(name), renderSync: () => { options.onRender?.(); listeners.get('rendercomplete')?.(); }, getViewport: () => ({ getBoundingClientRect: () => options.rect || defaultRect }), getTargetElement: () => ({ getBoundingClientRect: () => options.targetRect || defaultRect }) };
  const manager = { map, groupLayer: { getVisible: () => true, getLayers: () => ({ getArray: () => layers }) } };
  const events = new Set();
  const window = { cadastralMgr: manager, addEventListener: (_, cb) => events.add(cb), removeEventListener: (_, cb) => events.delete(cb), postMessage(message) {
    const check = message.type === 'nlsc-check-map-capture';
    if (!check) files.push({ ...message, visible: layers.map(l => l.visible), center: [...view.center], resolution: view.resolution });
    queueMicrotask(() => events.forEach(cb => cb({ source: window, origin: 'https://maps.nlsc.gov.tw', data: { type: 'nlsc-map-saved', id: message.id, ok: check ? !options.permissionError : !fail, error: check ? '尚未取得本頁截圖授權' : '測試下載失敗' } })));
  } };
  const ctx = vm.createContext({ window, document: { visibilityState: 'visible', getElementById: id => id === 'nlsc-integrated-panel' ? panel : null }, location: { origin: 'https://maps.nlsc.gov.tw' }, crypto: require('node:crypto').webcrypto, innerWidth: 1000, innerHeight: 700, console, setInterval, clearInterval, setTimeout: (cb, delay) => setTimeout(cb, delay === 800 ? 1 : delay), clearTimeout });
  vm.runInContext(fs.readFileSync('capture-geometry.js', 'utf8'), ctx);
  window.NLSCCaptureGeometry = ctx.NLSCCaptureGeometry;
  let src = fs.readFileSync('content.js', 'utf8').split('  // ── 2.')[0];
  const hookStart = src.indexOf('  w(() => win.cadastralMgr');
  const hookEnd = src.indexOf('\n\n  function saveMapImage', hookStart);
  src = src.slice(0, hookStart) + src.slice(hookEnd);
  vm.runInContext(src + '\nwindow.test = { captureSections, coloredParcels, parcelId, setGroups: groups => inputGroups = groups };})();', ctx);
  const records = window.test.coloredParcels;
  records.set('a', { town: '屏東市', section: '光明段', land: '477', layers: [a] });
  records.set('b', { town: '屏東市', section: '光明段', land: '512', layers: [b] });
  records.set('other', { town: '潮州鎮', section: '光明段', land: '24', layers: [other] });
  return { setGroups: window.test.setGroups, run: window.test.captureSections, files, view, layers, panel, interaction, records, parcelId: window.test.parcelId };
}

test('同鄉鎮同地段合併，完整取景，隔離其他著色並還原視角', async () => {
  const s = setup();
  assert.equal(await s.run(), 2);
  assert.equal(s.files[0].filename, '屏東市_光明段_477、512.png');
  assert.equal(s.files[1].filename, '潮州鎮_光明段_24.png');
  assert.deepEqual(s.files[0].visible, [true, true, false]);
  assert.deepEqual(s.files[1].visible, [false, false, true]);
  assert.ok(s.files[0].resolution >= 200 / 920);
  assert.deepEqual(Array.from(s.view.center), [900, 800]);
  assert.equal(s.view.resolution, 10);
  assert.equal(s.view.rotation, 0.3);
  assert.ok(s.layers.every(l => l.visible));
  assert.equal(s.panel.style.visibility, '');
  assert.equal(s.interaction.active, true);
});

test('下載失敗仍還原圖層、面板、互動及鎖定狀態', async () => {
  const s = setup(true);
  await assert.rejects(s.run(), /已送出 0\/2.*測試下載失敗/);
  assert.ok(s.layers.every(l => l.visible));
  assert.equal(s.panel.style.visibility, '');
  assert.equal(s.interaction.active, true);
  await assert.rejects(s.run(), /測試下載失敗/);
});

test('未授權時不調整地圖或送出圖片下載', async () => {
  let renders = 0;
  const s = setup(false, { permissionError: true, onRender() { renders++; } });
  await assert.rejects(s.run(), /尚未取得本頁截圖授權/);
  assert.equal(renders, 0);
  assert.equal(s.files.length, 0);
  assert.deepEqual(Array.from(s.view.center), [900, 800]);
  assert.equal(s.view.resolution, 10);
  assert.ok(s.layers.every(l => l.visible));
  assert.equal(s.interaction.active, true);
});

test('不擷取隱藏著色，缺少鄉鎮資訊時停止', async () => {
  const s = setup();
  s.layers[2].setVisible(false);
  assert.equal(await s.run(), 1);
  assert.equal(s.layers[2].visible, false);
  s.records.get('a').town = '';
  await assert.rejects(s.run(), /缺少鄉鎮資料/);
});

test('地段代碼 -0 與網站著色代碼相容', () => {
  const s = setup();
  assert.equal(s.parcelId('TA', '0035-0', '00240000'), s.parcelId('TA', '0035', '00240000'));
});

test('地圖超出右下邊界及微小負座標，重新取景於可見區域', async () => {
  const rect = { x: -0.4, y: 70.2, width: 1200, height: 900 };
  const size = [1200, 900];
  const s = setup(false, { rect, size });
  assert.equal(await s.run(), 2);
  const first = s.files[0];
  assert.equal(first.rect.x, 0);
  assert.equal(first.rect.y, rect.y);
  assert.equal(first.rect.width, 1000);
  assert.equal(first.rect.height, 700 - rect.y);
  // Project both opposite parcel corners independently into screenshot CSS pixels.
  for (const [x, y] of [[0, 0], [200, 100]]) {
    const px = rect.x + size[0] / 2 + (x - first.center[0]) / first.resolution;
    const py = rect.y + size[1] / 2 - (y - first.center[1]) / first.resolution;
    assert.ok(px >= first.rect.x + 39.9 && px <= 1000 - 39.9);
    assert.ok(py >= first.rect.y + 39.9 && py <= 700 - 39.9);
  }
  assert.deepEqual(Array.from(s.view.center), [900, 800]);
});

test('使用實際 OpenLayers viewport，不使用較大的外層容器', async () => {
  const s = setup(false, { targetRect: { x: -300, y: -100, width: 2000, height: 1000 } });
  assert.equal(await s.run(), 2);
  assert.deepEqual(JSON.parse(JSON.stringify(s.files[0].rect)), { x: 0, y: 0, width: 1000, height: 700 });
});

test('載入期間地圖版面改變時重新取景', async () => {
  let count = 0;
  const options = { onRender() { if (++count === 1) options.rect = { x: 100, y: 50, width: 1100, height: 800 }; } };
  const s = setup(false, options);
  assert.equal(await s.run(), 2);
  assert.equal(count, 3);
  assert.equal(s.files[0].rect.x, 100);
  assert.equal(s.files[0].rect.width, 900);
});

test('完全離開畫面時顯示實際範圍，並還原作業狀態', async () => {
  const s = setup(false, { rect: { x: 1200, y: 0, width: 1000, height: 700 } });
  await assert.rejects(s.run(), /可見區域不足.*x=1200.*視窗 1000×700/);
  assert.equal(s.files.length, 0);
  assert.ok(s.layers.every(l => l.visible));
  assert.equal(s.interaction.active, true);
});

test('CSS 顯示尺寸與地圖繪製尺寸不同時，地號仍完整入鏡', async () => {
  const rect = { x: 100, y: 50, width: 800, height: 800 }, size = [1600, 1600];
  const s = setup(false, { rect, size });
  await s.run();
  const first = s.files[0];
  for (const [x, y] of [[0, 0], [200, 100]]) {
    const px = rect.x + (size[0] / 2 + (x - first.center[0]) / first.resolution) * rect.width / size[0];
    const py = rect.y + (size[1] / 2 - (y - first.center[1]) / first.resolution) * rect.height / size[1];
    assert.ok(px >= first.rect.x + 39.9 && px <= first.rect.x + first.rect.width - 39.9);
    assert.ok(py >= first.rect.y + 39.9 && py <= first.rect.y + first.rect.height - 39.9);
  }
});

test('版面持續變動時最多重新取景三次，不下載錯位圖片', async () => {
  let count = 0;
  const options = { onRender() { options.rect = { x: ++count * 10, y: 0, width: 1000, height: 700 }; } };
  const s = setup(false, options);
  await assert.rejects(s.run(), /重新取景 3 次仍未穩定/);
  assert.equal(count, 3);
  assert.equal(s.files.length, 0);
  assert.equal(s.panel.style.visibility, '');
});

test('地圖中心限制使地號無法入鏡時，停止並還原', async () => {
  const s = setup(false, { fixedCenter: [900, 800] });
  await assert.rejects(s.run(), /著色範圍無法完整放入可見地圖/);
  assert.equal(s.files.length, 0);
  assert.equal(s.view.resolution, 10);
  assert.equal(s.view.rotation, 0.3);
});

test('網站一般查詢後著色回應，可追蹤鄉鎮、地段及新增圖層', async () => {
  const layers = [], colored = new Map();
  const manager = {
    groupLayer: { getLayers: () => ({ getArray: () => layers }) },
    catchPropertyRefactor(office, section, land, options) { this._renderFirstGroupPayload([], options); },
    _renderFirstGroupPayload(json, options) { if (options.imgflag) layers.push({ tint: true }); }
  };
  const selected = { section: { value: 'TA_0035', selectedOptions: [{ text: '檳榔腳段一小段' }] }, area_office: { selectedOptions: [{ text: '屏東市' }] }, landcode: { value: '24' } };
  const src = fs.readFileSync('content.js', 'utf8');
  const start = src.indexOf('  w(() => win.cadastralMgr');
  const end = src.indexOf('\n\n  function saveMapImage', start);
  const ctx = vm.createContext({ win: { cadastralMgr: manager }, w: () => Promise.resolve(manager), $: id => selected[id], parcelNames: new Map(), coloredParcels: colored, requestParcel: Symbol(), parcelId: (o, s, l) => [o, s.replace(/-0$/, ''), l].join('/'), console });
  vm.runInContext(src.slice(start, end), ctx);
  await Promise.resolve();
  manager.catchPropertyRefactor('TA', '0035-0', '00240000', { imgflag: false });
  manager.catchPropertyRefactor('TA', '0035', '00240000', { imgflag: true });
  const record = colored.get('TA/0035/00240000');
  assert.equal(record.town, '屏東市');
  assert.equal(record.section, '檳榔腳段一小段');
  assert.equal(record.land, '24');
  assert.equal(record.layers.length, 1);
});


test('每行一組：同地段拆成不同圖片，且保留輸入地號順序', async () => {
  const s = setup();
  s.setGroups([
    { id: 1, townName: '屏東市', section: '光明段', lands: ['477'] },
    { id: 2, townName: '潮州鎮', section: '光明段', lands: ['24'] },
    { id: 3, townName: '屏東市', section: '光明段', lands: ['512', '477'] }
  ]);
  assert.equal(await s.run(), 3);
  assert.deepEqual(s.files.map(x => x.filename), ['屏東市_光明段_477.png', '潮州鎮_光明段_24.png', '屏東市_光明段_512、477.png']);
  assert.deepEqual(s.files[0].visible, [true, false, false]);
  assert.deepEqual(s.files[2].visible, [true, true, false]);
});

test('清單缺少著色地號時，在下載及移動地圖前停止', async () => {
  const s = setup();
  s.setGroups([{ id: 1, townName: '屏東市', section: '光明段', lands: ['477', '600'] }]);
  await assert.rejects(s.run(), /尚有地號未著色/);
  assert.equal(s.files.length, 0);
});

test('面積同地段不同行分開加總', () => {
  const source = fs.readFileSync('content.js', 'utf8');
  const start = source.indexOf('  function sum(a)');
  const end = source.indexOf('  const esc =', start);
  const sum = vm.runInNewContext(source.slice(start, end) + ';sum');
  const rows = [
    { 清單序號: 1, 地段: '光明段', 地號: '477', '面積(㎡)': 10, 狀態: '完成' },
    { 清單序號: 1, 地段: '光明段', 地號: '512', '面積(㎡)': 20, 狀態: '完成' },
    { 清單序號: 2, 地段: '龍華段', 地號: '1385', '面積(㎡)': 40, 狀態: '完成' },
    { 清單序號: 3, 地段: '光明段', 地號: '600', '面積(㎡)': 50, 狀態: '完成' },
    { 清單序號: 3, 地段: '光明段', 地號: '601', '面積(㎡)': 60, 狀態: '完成' }
  ];
  assert.deepEqual(Array.from(sum(rows), x => x['合計(㎡)']), [30, 40, 110]);
});

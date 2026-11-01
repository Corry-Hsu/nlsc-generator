const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(options = {}) {
  let handler, ctx;
  const calls = [], replies = [], draws = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => draws.push(args.slice(1)) }), toDataURL: () => 'data:image/png;base64,test' };
  const window = { addEventListener: (_, cb) => { handler = cb; }, postMessage: m => replies.push(m) };
  ctx = vm.createContext({ window, innerWidth: 1000, innerHeight: 700, scrollX: 0, scrollY: 0, console: { warn() {} },
    document: { documentElement: { clientWidth: options.clientWidth || 1000, clientHeight: 700 }, visibilityState: 'visible', createElement: () => canvas },
    location: { origin: 'https://maps.nlsc.gov.tw' },
    Image: class { constructor() { this.naturalWidth = options.width || 2000; this.naturalHeight = options.height || 1400; } async decode() { options.onDecode?.(ctx); } },
    chrome: { runtime: { onMessage: { addListener() {} }, async sendMessage(m) { calls.push(m); return m.type === 'nlsc-capture' ? { ok: true, dataUrl: 'data:image/png;base64,capture' } : { ok: true }; } } }
  });
  vm.runInContext(fs.readFileSync('capture-geometry.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('capture-bridge.js', 'utf8'), ctx);
  const run = async (rect = { x: 0, y: 70.2, width: 1000, height: 629.8 }) => {
    const viewport = ctx.NLSCCaptureGeometry.viewport();
    await handler({ source: window, origin: 'https://maps.nlsc.gov.tw', data: { type: 'nlsc-save-map', id: 'test', rect, viewport, filename: '屏東市_光明段_477.png' } });
  };
  return { run, calls, replies, canvas, draws };
}

test('依實際截圖像素裁切，支援 1、1.25、2 倍螢幕比例', async () => {
  for (const scale of [1, 1.25, 2]) {
    const s = setup({ width: 1000 * scale, height: 700 * scale });
    await s.run();
    assert.equal(s.replies[0].ok, true);
    assert.equal(s.canvas.width, 1000 * scale);
    assert.equal(s.canvas.height, 700 * scale - Math.floor(70.2 * scale));
    assert.equal(s.calls[1].type, 'nlsc-download');
    assert.equal(s.calls[1].filename, '屏東市_光明段_477.png');
    assert.equal(s.replies[0].dataUrl, undefined);
  }
});

test('小數負值及邊界誤差可安全裁齊', async () => {
  const s = setup();
  await s.run({ x: -0.4, y: -0.2, width: 1000.8, height: 700.4 });
  assert.equal(s.replies[0].ok, true);
  assert.equal(s.canvas.width, 2000);
  assert.equal(s.canvas.height, 1400);
});

test('捲軸不納入地圖圖片', async () => {
  const s = setup({ clientWidth: 985 });
  await s.run({ x: 0, y: 0, width: 985, height: 700 });
  assert.equal(s.replies[0].ok, true);
  assert.equal(s.canvas.width, 1970);
});

test('明顯越界的裁切請求不會直接截掉地號', async () => {
  const s = setup();
  await s.run({ x: -100, y: 0, width: 1000, height: 700 });
  assert.equal(s.replies[0].ok, false);
  assert.match(s.replies[0].error, /要求 x=-100.*可見/);
  assert.equal(s.calls.length, 0);
});

test('截圖後視窗縮放或捲動時停止，避免下載錯位圖片', async () => {
  for (const onDecode of [ctx => { ctx.innerWidth = 900; }, ctx => { ctx.scrollY = 50; }]) {
    const s = setup({ onDecode });
    await s.run();
    assert.equal(s.replies[0].ok, false);
    assert.match(s.replies[0].error, /視窗、捲動位置或分頁變更/);
    assert.equal(s.calls.length, 1);
  }
});

test('截圖像素尺寸比例異常時停止下載', async () => {
  const s = setup({ width: 2000, height: 1000 });
  await s.run();
  assert.equal(s.replies[0].ok, false);
  assert.match(s.replies[0].error, /像素比例不一致/);
  assert.equal(s.calls.length, 1);
});

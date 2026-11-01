const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup({ same = false, update = () => {}, invalidValue = false } = {}) {
  let clock = 0, changes = 0;
  const child = { hidden: true, options: [{ value: 'old', text: '舊地段' }] };
  let value = same ? 'T01' : 'T02';
  const parent = { get value() { return value; }, set value(v) { value = invalidValue ? '' : v; } };
  const source = fs.readFileSync('content.js', 'utf8');
  const start = source.indexOf('  const waitOptionsSmart =');
  const end = source.indexOf('  const resultRows', start);
  const run = vm.runInNewContext(source.slice(start, end) + ';waitOptionsSmart', {
    $: () => child, Date: { now: () => clock },
    fire: () => { changes++; update(child, 0, parent); },
    wait: async ms => { clock += ms; update(child, clock, parent); }
  });
  return { child, parent, run: timeout => run(parent, 'T01', 'section', timeout), changes: () => changes };
}
test('隱藏選單同鄉鎮且有效時直接通過', async () => {
  const s = setup({ same: true }); await s.run(); assert.equal(s.changes(), 0);
});
test('非空載入選項與停用選項不通過，單一有效選項可通過', async () => {
  const s = setup({ update: (child, t) => {
    child.options = t < 300 ? [{ value: 'loading', text: '載入中...' }] :
      t < 600 ? [{ value: 'disabled', text: '新地段', disabled: true }] : [{ value: 'only', text: '新地段' }];
  }});
  await s.run(1000); assert.equal(s.changes(), 1); assert.equal(s.child.options[0].value, 'only');
});
test('value 相同但文字不同也視為選項更新', async () => {
  const s = setup({ update: child => { child.options = [{ value: 'old', text: '新地段' }]; } });
  await s.run(500);
});
test('過渡狀態後恢復相同選項亦能通過', async () => {
  const s = setup({ update: (child, t) => { child.options = t < 200 ? [] : [{ value: 'old', text: '舊地段' }]; } });
  await s.run(1000);
});
test('選項短暫有效後回到載入中不會提早通過', async () => {
  const s = setup({ update: (child, t) => { child.options = t === 100 ? [{ value: 'new', text: '新地段' }] : [{ value: 'loading', text: '載入中...' }]; } });
  await assert.rejects(s.run(500), /逾時/);
});
test('預設等待15秒後提供明確錯誤', async () => {
  const s = setup(); await assert.rejects(s.run(), /15 秒.*section/);
});
test('不存在的父選項與外部修改會明確停止', async () => {
  const s = setup({ invalidValue: true }); await assert.rejects(s.run(), /找不到選單項/);
  const changed = setup({ update: (child, t, parent) => { if (t > 0) parent.value = 'T03'; } });
  await assert.rejects(changed.run(), /上層條件已變更/);
});


// Exercise the real setCity/setTown/queryBatch path, with CSS access forbidden.
function hiddenQuerySetup(legacyVisibility = false) {
  const rows = [], switches = [];
  const select = (value, options) => ({
    value, options, hidden: true,
    get selectedOptions() { return this.options.filter(o => o.value === this.value); },
    dispatchEvent() {}
  });
  const elements = {
    city: select('T', [{ value: 'T', text: '屏東縣' }]),
    area_office: select('T02', [{ value: 'T01', text: '屏東市' }, { value: 'T02', text: '潮州鎮' }]),
    section: select('B_456-0', [{ value: 'B_456-0', text: '舊地段' }]),
    landcode: { value: '', focus() {}, dispatchEvent() {} }
  };
  elements.area_office.dispatchEvent = () => {
    switches.push(elements.area_office.value);
    elements.section.options = [{ value: 'A_123-0', text: '光明段' }];
    elements.section.value = 'A_123-0';
  };
  elements.div_cross_query = { click() {
    rows.push({ isConnected: true, hidden: false, nodeType: 1,
      textContent: '光明段 ' + elements.landcode.value + '地號 (A_123-0)' });
  }};
  const window = {};
  let source = fs.readFileSync('content.js', 'utf8');
  const hookStart = source.indexOf('  w(() => win.cadastralMgr');
  const hookEnd = source.indexOf('\n\n  function saveMapImage', hookStart);
  source = source.slice(0, hookStart) + source.slice(hookEnd);
  source = source.slice(0, source.indexOf('  async function read(r)')) + '})();';
  if (legacyVisibility) source = source.replace('r.isConnected && /', 'v(r) && /');
  vm.runInNewContext(source, {
    window, document: { getElementById: id => elements[id], querySelectorAll: () => rows },
    Node: { ELEMENT_NODE: 1 },
    getComputedStyle: () => { throw Error('禁止讀取 CSS 可見度'); },
    Event: class {}, console: { log() {}, table() {} },
    setTimeout: cb => setTimeout(cb, 1), clearTimeout,
    setInterval: cb => setInterval(cb, 1), clearInterval
  });
  const list = ['477', '512'].map(land => ({ town: 'T01', townName: '屏東市', section: '光明段', land, groupId: 1, groupLands: ['477', '512'] }));
  return { run: () => window.nlsc.queryBatch(list, 0), switches };
}
test('回歸重現：結果讀取依賴 CSS 時，收合網站面板會中斷批次查詢', async () => {
  const s = hiddenQuerySetup(true);
  await assert.rejects(s.run(), /禁止讀取 CSS 可見度/);
});
test('收合網站面板仍完成完整批次查詢，單選項與重複鄉鎮均不讀 CSS', async () => {
  const s = hiddenQuerySetup();
  const results = await s.run();
  assert.equal(results.length, 2);
  assert.deepEqual(Array.from(results, x => x.land), ['477', '512']);
  assert.deepEqual(s.switches, ['T01']);
});

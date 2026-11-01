'use strict';
const allowed = url => /^https:\/\/maps\.nlsc\.gov\.tw\/T09\/mapshow\.action(?:[?#]|$)/.test(url || '');
chrome.action.onClicked.addListener(async tab => {
  if (!allowed(tab.url)) return;
  try {
    // Invoking the browser action grants activeTab. A page button cannot grant it.
    await chrome.tabs.sendMessage(tab.id, { type: 'nlsc-start-capture' }, { frameId: 0 });
  } catch (error) {
    await chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
    await chrome.action.setTitle({ tabId: tab.id, title: '尚未連接網頁，請重新整理 NLSC 網頁後再點一次外掛圖示' });
  }
});
let lastCapture = 0;
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!allowed(sender.url) || !sender.tab || sender.frameId !== 0) return;
  if (!['nlsc-capture', 'nlsc-capture-check', 'nlsc-download'].includes(message.type)) return;
  (async () => {
    const [active] = await chrome.tabs.query({ active: true, windowId: sender.tab.windowId });
    if (active?.id !== sender.tab.id) throw Error('請保持國土測繪網站分頁在前景');
    if (message.type === 'nlsc-capture' || message.type === 'nlsc-capture-check') {
      if (Date.now() - lastCapture < 600) throw Error('截圖過於頻繁，請稍後重試');
      lastCapture = Date.now();
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
        const [after] = await chrome.tabs.query({ active: true, windowId: sender.tab.windowId });
        if (after?.id !== sender.tab.id) throw Error('截圖時切換了分頁，已停止');
        await chrome.action.setBadgeText({ tabId: sender.tab.id, text: 'ON' });
        await chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#2d6a4f' });
        await chrome.action.setTitle({ tabId: sender.tab.id, title: '本頁截圖權限已確認；點擊開始依地段批次截圖' });
        return message.type === 'nlsc-capture-check' ? { ready: true } : { dataUrl };
      } catch (e) {
        if (/activeTab|all_urls|permission/i.test(e.message)) {
          await chrome.action.setBadgeText({ tabId: sender.tab.id, text: '!' });
          throw Error('尚未取得本頁截圖授權。請點 Edge／Chrome 右上角「擴充功能」（拼圖），再點「NLSC 測繪自動化小工具」名稱或圖示，即會授權並開始截圖；也可按 Alt+Shift+S。網頁內的棕色按鈕無法取得此授權。');
        }
        throw Error('瀏覽器截圖失敗：' + e.message);
      }
    }
    if (typeof message.dataUrl !== 'string' || !message.dataUrl.startsWith('data:image/png;base64,') || message.dataUrl.length > 60000000) throw Error('圖片格式或大小不符');
    const filename = String(message.filename || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    if (!filename.endsWith('.png') || filename.length > 200) throw Error('圖片檔名不符');
    const downloadId = await chrome.downloads.download({ url: message.dataUrl, filename, saveAs: false, conflictAction: 'uniquify' });
    return { downloadId };
  })().then(value => respond({ ok: true, ...value }), error => respond({ ok: false, error: error.message }));
  return true;
});

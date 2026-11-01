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

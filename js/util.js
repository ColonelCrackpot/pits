'use strict';
// ============================== small helpers ==============================
const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hyp = (x, y) => Math.sqrt(x * x + y * y);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const shadeCache = {};
function shade(hex, amt) {
  const key = hex + amt;
  if (shadeCache[key]) return shadeCache[key];
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return shadeCache[key] = `rgb(${r},${g},${b})`;
}

/*
Settings panel (gear button, top-right of the page).

Currently holds one setting: the double-click delay — the longest gap
between two clicks on the same country that still counts as a
double-click. The value is remembered in the browser's localStorage
between visits; if storage is unavailable (e.g. private browsing) the
setting still works, it just resets to the default on reload.
*/

import { initPanel } from './panels.js';

const DEFAULT_DOUBLE_CLICK_DELAY_MS = 250;
const STORAGE_KEY = 'worldMapGame.doubleClickDelayMs';

let doubleClickDelayMs = loadDoubleClickDelay();

// Read by handler.js on every click, so slider changes apply immediately.
export function getDoubleClickDelay() {
  return doubleClickDelayMs;
}

export function initSettings() {
  // Opening/closing the panel (shared with the info panel, see panels.js).
  initPanel('settings', 'settings-button', 'settings-panel');

  const slider = document.getElementById('double-click-delay');
  const valueEl = document.getElementById('double-click-delay-value');

  // Clamp a stored value into the slider's current range, in case the
  // range in index.html was changed since it was saved.
  doubleClickDelayMs = Math.min(Math.max(doubleClickDelayMs, Number(slider.min)), Number(slider.max));
  slider.value = doubleClickDelayMs;
  valueEl.textContent = `${doubleClickDelayMs} ms`;

  slider.addEventListener('input', () => {
    doubleClickDelayMs = Number(slider.value);
    valueEl.textContent = `${doubleClickDelayMs} ms`;
    saveDoubleClickDelay(doubleClickDelayMs);
  });
}

function loadDoubleClickDelay() {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    if (stored > 0) return stored;
  } catch (err) {
    // Storage blocked — fall back to the default.
  }
  return DEFAULT_DOUBLE_CLICK_DELAY_MS;
}

function saveDoubleClickDelay(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch (err) {
    // Storage blocked — the setting just won't survive a reload.
  }
}

/*
Settings panel (gear button, top-right of the page).

Two tabs of sliders:
Mouse
- Double-click speed: the longest gap between two clicks on the same
  country that still counts as a double-click.
- Scroll zoom speed: how far each mouse-wheel notch zooms, as a
  percentage of the normal speed.
Keyboard
- Pan speed / Zoom speed: how fast the arrow keys and the + / - keys
  move the map, as a percentage of the normal speed.

The values are remembered in the browser's localStorage between visits;
if storage is unavailable (e.g. private browsing) the settings still
work, they just reset to the defaults on reload.
*/

import { initPanel, initTabs } from './panels.js';

const settings = {
  doubleClickDelayMs: {
    sliderId: 'double-click-delay',
    valueId: 'double-click-delay-value',
    storageKey: 'worldMapGame.doubleClickDelayMs',
    defaultValue: 250,
    format: value => `${value} ms`,
    value: null
  },
  scrollZoomPercent: {
    sliderId: 'scroll-zoom-speed',
    valueId: 'scroll-zoom-speed-value',
    storageKey: 'worldMapGame.scrollZoomPercent',
    defaultValue: 100,
    format: value => `${value}%`,
    value: null
  },
  keyPanPercent: {
    sliderId: 'key-pan-speed',
    valueId: 'key-pan-speed-value',
    storageKey: 'worldMapGame.keyPanPercent',
    defaultValue: 100,
    format: value => `${value}%`,
    value: null
  },
  keyZoomPercent: {
    sliderId: 'key-zoom-speed',
    valueId: 'key-zoom-speed-value',
    storageKey: 'worldMapGame.keyZoomPercent',
    defaultValue: 100,
    format: value => `${value}%`,
    value: null
  }
};

for (const setting of Object.values(settings)) setting.value = load(setting);

// Read by handler.js on every click, so slider changes apply immediately.
export function getDoubleClickDelay() {
  return settings.doubleClickDelayMs.value;
}

// Read by the scroll-wheel zoom in main.js on every notch: 100 = normal
// speed, 200 = twice as far per notch, and so on.
export function getScrollZoomPercent() {
  return settings.scrollZoomPercent.value;
}

// Read by the keyboard navigation in main.js on every frame: 100 = normal
// speed for the arrow keys (pan) and the + / - keys (zoom).
export function getKeyPanPercent() {
  return settings.keyPanPercent.value;
}

export function getKeyZoomPercent() {
  return settings.keyZoomPercent.value;
}

export function initSettings() {
  // Opening/closing the panel (shared with the info panel, see panels.js),
  // and its Mouse / Keyboard tabs.
  initPanel('settings', 'settings-button', 'settings-panel');
  initTabs(document.querySelector('#settings-panel [role="tablist"]'));

  for (const setting of Object.values(settings)) initSlider(setting);
}

function initSlider(setting) {
  const slider = document.getElementById(setting.sliderId);
  const valueEl = document.getElementById(setting.valueId);

  // Clamp a stored value into the slider's current range, in case the
  // range in index.html was changed since it was saved.
  setting.value = Math.min(Math.max(setting.value, Number(slider.min)), Number(slider.max));
  slider.value = setting.value;
  valueEl.textContent = setting.format(setting.value);

  slider.addEventListener('input', () => {
    setting.value = Number(slider.value);
    valueEl.textContent = setting.format(setting.value);
    save(setting);
  });
}

function load(setting) {
  try {
    const stored = Number(localStorage.getItem(setting.storageKey));
    if (stored > 0) return stored;
  } catch (err) {
    // Storage blocked — fall back to the default.
  }
  return setting.defaultValue;
}

function save(setting) {
  try {
    localStorage.setItem(setting.storageKey, String(setting.value));
  } catch (err) {
    // Storage blocked — the setting just won't survive a reload.
  }
}

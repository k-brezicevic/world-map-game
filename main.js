/*
Clickland — based on MapLibre mapping library.

It renders country polygons from a public-domain GeoJSON dataset 
(Natural Earth, via jsDelivr CDN) using MapLibre's WebGL renderer.

It uses Natural Earth's 10m resolution countries dataset, which is 
the highest detail tier Natural Earth offers.

Since this is all loaded as one static GeoJSON blob, it re-renders 
the same already-loaded vertices at a larger scale and doesn't fetch 
additional detail while zooming in.
*/

import { adjust } from './adjust.js';
import { initSettings, getScrollZoomPercent, getKeyPanPercent, getKeyZoomPercent } from './settings.js';
import { initPanel, initTabs } from './panels.js';
import { isInteractive } from './handler.js';
import { startGame } from './game.js';

const COUNTRIES_GEOJSON_URL =
  'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_admin_0_countries.geojson';

// A few large, well-known lakes, saved locally from Natural Earth's
// ne_10m_lakes (the same detail level as the countries): the Great Lakes
// (Superior, Michigan, Huron with Georgian Bay, Erie, Ontario, and Lake
// Saint Clair between Huron and Erie), Lake Victoria and Lake Baikal.
// The country shapes include most lakes as land (e.g. the Great Lakes are
// part of the US and Canada), so the lakes are drawn on top in the ocean
// colour. The Caspian Sea isn't in this data: the country shapes already
// leave it out.
const LAKES_GEOJSON_URL = 'data/lakes.geojson';

document.addEventListener('DOMContentLoaded', main);

async function main() {

  // The info, settings and About (logo) panels work independently of the
  // map, so set them up first.
  initPanel('about', 'logo', 'about-panel');
  initPanel('info', 'info-button', 'info-panel');
  initTabs(document.querySelector('#info-panel [role="tablist"]'));
  initSettings();

  // Temporary status text for testing purposes.
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Loading map data…';

  // The spinner over the map area fades out once the map has loaded, or
  // if loading fails (the status line then says why).
  const loadingEl = document.getElementById('map-loading');
  const hideLoading = () => loadingEl.classList.add('done');

  // Start the lakes download straight away so it runs in parallel with the
  // countries. If it fails, the map still works, just without lakes.
  const lakesPromise = fetch(LAKES_GEOJSON_URL)
    .then(response => {
      if (!response.ok) throw new Error(`Failed to load ${LAKES_GEOJSON_URL}: HTTP ${response.status}`);
      return response.json();
    })
    .catch(err => {
      console.warn('Lakes unavailable — showing the map without them.', err);
      return null;
    });

  let countriesGeoJsonData;
  try {
    countriesGeoJsonData = await loadAndAdjustCountries(COUNTRIES_GEOJSON_URL);
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Failed to load map data — check the console.';
    hideLoading();
    return;
  }

  // Debug helper, not used by the game itself: run listCountries() in
  // the browser DevTools console to print every country/territory
  // currently in the loaded data — i.e. after adjust.js has already
  // run, so this reflects exactly what's on the map right now. Useful
  // for spotting other entries worth merging or excluding. Non-selectable
  // features (e.g. Antarctica) and the extra marker points of small
  // countries (which would list them twice) are left out.
  window.listCountries = () => {
    const names = countriesGeoJsonData.features
      .filter(f => isInteractive(f) && f.geometry.type !== 'Point')
      .map(f => f.properties.ADMIN || f.properties.NAME || '(unnamed)')
      .sort((a, b) => a.localeCompare(b));
    console.log(`${names.length} countries/territories currently on the map:`);
    console.table(names);
    return names;
  };
  listCountries();

  const lakesGeoJsonData = await lakesPromise;

  // Create new MapLibre map object.
  const map = new maplibregl.Map({
    // Name of <div> element that contains the map.
    container: 'map',
    // Builds JSON style specification, which tells MapLibre how to draw the map.
    style: buildStyle(countriesGeoJsonData, lakesGeoJsonData),
    // Initial position: degrees longitude, degrees latitude.
    center: [0, 20],
    // Initial and lowest map zoom.
    zoom: 1,
    minZoom: 1,
    // Prevents left and right tiling/repeating of the world map when zoomed out.
    renderWorldCopies: false,
    // Prevents default zoom-in using double click.
    doubleClickZoom: false,
    // Prevents rotating (and tilting) the map by dragging with the right
    // mouse button or Ctrl + left mouse button.
    dragRotate: false,
    // Prevents tilting the map by dragging two fingers up/down on touchscreens.
    touchPitch: false,
    // Do not display MapLibre attribution text/icon.
    attributionControl: false
  });

  // Scroll-wheel zoom: MapLibre's built-in version is replaced with a
  // smoother one that glides like the +/- keys (see setupSmoothScrollZoom).
  map.scrollZoom.disable();
  setupSmoothScrollZoom(map);

  // Keep the map north-up: no two-finger twist on touchscreens.
  // Pinch-zoom still works.
  map.touchZoomRotate.disableRotation();

  // Keyboard: MapLibre's own handler only works while the map has focus,
  // so it's replaced by a page-wide one (no rotation either).
  map.keyboard.disable();
  setupKeyboardNavigation(map);

  // Set up the game once the map has finished loading. It replaces the
  // "Loading map data…" status with its own text and shows the Start
  // button; the first country appears when the player presses it.
  map.on('load', () => {
    hideLoading();
    startGame(map, countriesGeoJsonData, {
      titleEl: document.querySelector('header h1'),
      statusEl,
      startButton: document.getElementById('start-button'),
      scoreboard: document.getElementById('scoreboard'),
      results: document.getElementById('results'),
      gameButtons: document.getElementById('game-buttons'),
      logo: document.getElementById('logo')
    });
  });

  // Error handling in case map loading fails.
  map.on('error', e => {
    console.error('MapLibre error:', e.error);
    statusEl.textContent = 'Map failed to load — check the console.';
    hideLoading();
  });
}

// Keyboard zoom and pan that work wherever the focus is on the page, not
// only when the map has it: + / = zoom in, - zoom out, arrow keys pan.
// Movement is continuous: while a key is held the map speeds up smoothly
// to a steady speed, and eases to a stop when it's released (a quick tap
// gives a small step). The keyboard's own auto-repeat is ignored. Several
// keys can be held at once (e.g. two arrows move diagonally).
// Keys are left alone when they belong to something else: form fields
// (e.g. the double-click slider, where arrows change the value), the info
// panel's tabs (arrows switch tabs), and combinations with Ctrl / Cmd /
// Alt (e.g. Ctrl + - is the browser's own zoom). Arrow keys don't scroll
// the page.
function setupKeyboardNavigation(map) {
  const PAN_SPEED = 700;     // pixels per second at full speed
  const ZOOM_SPEED = 2;      // zoom levels per second at full speed
  const SPEED_UP_S = 0.08;   // how quickly it reaches full speed (smaller = faster)
  const SLOW_DOWN_S = 0.15;  // how quickly it comes to a stop

  // Direction each key pushes in: [x, y] for panning, z for zooming.
  const KEYS = {
    ArrowLeft: { x: -1 }, ArrowRight: { x: 1 },
    ArrowUp: { y: -1 }, ArrowDown: { y: 1 },
    '+': { z: 1 }, '=': { z: 1 },
    '-': { z: -1 }, '_': { z: -1 }
  };

  // Held keys by physical key (e.code), with the direction worked out from the
  // character they produced when pressed (e.key, which follows the keyboard
  // layout). Releasing is matched by e.code, because e.key can change in
  // between: press Shift + = for "+", let go of Shift first, and the key
  // comes up as "=".
  const held = new Map();
  const velocity = { x: 0, y: 0, z: 0 };
  let frame = null;
  let lastTime = 0;

  document.addEventListener('keydown', e => {
    if (!(e.key in KEYS)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('input, select, textarea, [contenteditable], [role="tab"]')) return;
    e.preventDefault(); // e.g. arrows scrolling the page, also on auto-repeat
    if (e.repeat) return;
    held.set(e.code, KEYS[e.key]);
    start();
  });

  document.addEventListener('keyup', e => held.delete(e.code));
  // Keys released while another window had focus never send keyup.
  window.addEventListener('blur', () => held.clear());

  function start() {
    if (frame !== null) return;
    lastTime = performance.now();
    frame = requestAnimationFrame(step);
  }

  function step(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05); // seconds; capped after a stall
    lastTime = now;

    // Where each direction is being pushed by the keys held now.
    const target = { x: 0, y: 0, z: 0 };
    for (const d of held.values()) {
      target.x += d.x || 0;
      target.y += d.y || 0;
      target.z += d.z || 0;
    }

    // Ease the current speed towards that: quickly when speeding up,
    // a little more gently when slowing down.
    for (const axis of ['x', 'y', 'z']) {
      const goal = Math.max(-1, Math.min(1, target[axis]));
      const tau = Math.abs(goal) > Math.abs(velocity[axis]) ? SPEED_UP_S : SLOW_DOWN_S;
      velocity[axis] += (goal - velocity[axis]) * (1 - Math.exp(-dt / tau));
    }

    if (velocity.x || velocity.y) {
      // Speeds scaled by the Keyboard tab of the settings (100% = as above).
      const panSpeed = PAN_SPEED * getKeyPanPercent() / 100;
      map.panBy([velocity.x * panSpeed * dt, velocity.y * panSpeed * dt], { duration: 0 });
    }
    if (velocity.z) {
      map.setZoom(map.getZoom() + velocity.z * ZOOM_SPEED * getKeyZoomPercent() / 100 * dt);
    }

    const moving = Math.abs(velocity.x) + Math.abs(velocity.y) + Math.abs(velocity.z) > 0.001;
    if (held.size > 0 || moving) {
      frame = requestAnimationFrame(step);
    } else {
      velocity.x = velocity.y = velocity.z = 0;
      frame = null;
    }
  }
}

// Smooth scroll-wheel zoom. Each wheel notch sets a target zoom level and
// the map glides there with an eased animation, the same way the +/-
// keys do. Notches that arrive while it's still gliding add to the
// same target, so fast scrolling keeps one continuous motion instead of
// restarting with a jolt each time. Zooms towards the mouse pointer.
function setupSmoothScrollZoom(map) {
  // Zoom levels per pixel of wheel movement at normal speed. A typical
  // mouse-wheel notch is 100px, so 0.005 gives half a zoom level per notch.
  // The "Scroll zoom speed" setting scales this (100% = as here).
  const ZOOM_PER_PIXEL = 0.005;
  // Length of the glide after each notch, in milliseconds.
  const DURATION_MS = 350;

  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  let targetZoom = null;
  let lastWheelTime = 0;

  map.getCanvasContainer().addEventListener('wheel', e => {
    e.preventDefault(); // stop the page itself from scrolling

    // Some browsers/devices report the wheel in lines rather than pixels.
    const deltaPx = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;

    // Keep adding to the previous target while the last glide is still
    // running; otherwise start from where the map is now.
    const now = performance.now();
    const startZoom = (targetZoom !== null && now - lastWheelTime < DURATION_MS)
      ? targetZoom
      : map.getZoom();
    lastWheelTime = now;

    targetZoom = Math.min(Math.max(startZoom - deltaPx * ZOOM_PER_PIXEL * getScrollZoomPercent() / 100, map.getMinZoom()), map.getMaxZoom());

    const rect = map.getCanvasContainer().getBoundingClientRect();
    const pointer = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);

    map.easeTo({
      zoom: targetZoom,
      around: pointer, // keep the spot under the mouse fixed while zooming
      duration: DURATION_MS,
      easing: easeOutCubic
    });
  }, { passive: false });
}

async function loadAndAdjustCountries(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  }
  const geojson = await response.json();

  // Merges, splits, removes and renames countries/territories (see adjust.js).
  adjust(geojson);
  return geojson;
}

// Reads a color from a CSS custom property defined in map-style.css.
function getMapColor(varName) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return value;
}

/*
Builds JSON style specification, which tells MapLibre how to draw the map.
*/
function buildStyle(countriesData, lakesData) {
  // Country colour by state, shared by the country shapes and the small
  // country markers.
  const countryColor = [
    'case',
    ['boolean', ['feature-state', 'correct'], false],
    getMapColor('--map-correct'),    // asked-for country, found (green) — while the result is shown
    ['boolean', ['feature-state', 'wrong'], false],
    getMapColor('--map-wrong'),      // asked-for country, missed (red) — while the result is shown
    ['boolean', ['feature-state', 'picked'], false],
    getMapColor('--map-selected'),   // the player's wrong pick (orange, like the selection) — while the result is shown
    ['boolean', ['feature-state', 'selected'], false],
    getMapColor('--map-selected'),   // selected color (single click) — currently highlighted
    ['boolean', ['feature-state', 'found'], false],
    getMapColor('--map-found'),      // answered correctly earlier in the game (darker green)
    ['boolean', ['feature-state', 'missed'], false],
    getMapColor('--map-missed'),     // missed earlier in the game (darker red)
    ['boolean', ['feature-state', 'hover'], false],
    getMapColor('--map-land-hover'), // hover color — only shown on otherwise unselected countries
    getMapColor('--map-land')        // default land color
  ];

  // Small-country circles (marker points, see addSmallCountryMarkers in
  // adjust.js): active only while the country is still too tiny to click
  // as its real shape, i.e. below its markerUntilZoom. MapLibre only lets
  // a size depend on the zoom through a top-level "step", so this checks
  // each whole zoom level (from 0 to MARKER_LAST_ZOOM) and gives the size
  // there (a radius or outline width, in pixels), or 0 once the country is
  // big enough. Both the radius and the outline need it: a circle of
  // radius 0 with an outline would still show as a dot.
  const MARKER_LAST_ZOOM = 14;
  const whileTiny = size => {
    const steps = ['step', ['zoom'], ['case', ['>', ['get', 'markerUntilZoom'], 0.5], size, 0]];
    for (let zoom = 1; zoom <= MARKER_LAST_ZOOM; zoom++) {
      steps.push(zoom, ['case', ['>', ['get', 'markerUntilZoom'], zoom + 0.5], size, 0]);
    }
    return steps;
  };

  // The visible circle only shows when there's something to show: the
  // country hovered (in the hovered-country colour), selected, or
  // answered (green / red). An untouched small country has no circle,
  // so the circles don't give away where the small countries are
  // (except Vatican City, see countries-markers-always below).
  const markerOpacity = [
    'case',
    ['any',
      ['boolean', ['feature-state', 'correct'], false],
      ['boolean', ['feature-state', 'wrong'], false],
      ['boolean', ['feature-state', 'picked'], false],
      ['boolean', ['feature-state', 'selected'], false],
      ['boolean', ['feature-state', 'found'], false],
      ['boolean', ['feature-state', 'missed'], false],
      ['boolean', ['feature-state', 'hover'], false]], 1,
    0
  ];

  // The hovered country gets an outline (feature-state "hover", set in
  // handler.js), but not once it's selected: it's then orange all over.
  const hoverOutlined = ['all',
    ['boolean', ['feature-state', 'hover'], false],
    ['!', ['boolean', ['feature-state', 'selected'], false]]];

  // Small-country circles: a thin dark edge, or while hovered an outline
  // like the country shapes' (see countries-hover-outline), a little
  // brighter so it shows on such a small circle.
  const markerStroke = {
    'circle-stroke-color': ['case', hoverOutlined, getMapColor('--map-marker-hover-outline'), getMapColor('--map-outline')],
    'circle-stroke-width': ['case', hoverOutlined, 1.5, 1]
  };

  return {
    version: 8,
    sources: {
      countries: {
        type: 'geojson',
        data: countriesData,
        // Each feature's map id is its country name. A small country's
        // shape and its marker circle (see addSmallCountryMarkers in
        // adjust.js) then share one id, so hovering, selecting or
        // confirming either one colours both.
        promoteId: 'ADMIN'
      },
      ...(lakesData ? { lakes: { type: 'geojson', data: lakesData } } : {})
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': getMapColor('--map-background')
        }
      },
      {
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': countryColor,
          'fill-opacity': 1
        }
      },
      // Lakes in the ocean colour, over the country fill but under the
      // border lines, so borders running through lakes (e.g. US–Canada
      // across the Great Lakes) stay visible. Clicks on a lake are
      // ignored (see handler.js).
      ...(lakesData ? [{
        id: 'lakes',
        type: 'fill',
        source: 'lakes',
        paint: {
          'fill-color': getMapColor('--map-background')
        }
      }] : []),
      {
        id: 'countries-outline',
        type: 'line',
        source: 'countries',
        paint: {
          'line-color': getMapColor('--map-outline'),
          'line-width': 0.6
        }
      },
      // The outline of the country under the mouse, a little brighter than
      // its hover fill and thicker, so it's clear exactly which country is
      // hovered (e.g. between similar-sized neighbours). Only shown for the
      // hovered country (see hoverOutlined above).
      {
        id: 'countries-hover-outline',
        type: 'line',
        source: 'countries',
        paint: {
          'line-color': getMapColor('--map-hover-outline'),
          'line-width': 1.5,
          'line-opacity': ['case', hoverOutlined, 1, 0]
        }
      },
      // Small countries (e.g. Vatican City, Nauru) shown as a circle in the
      // country's colour while their real shape is too tiny to see: when
      // hovered, selected or answered (see markerOpacity above).
      {
        id: 'countries-markers',
        type: 'circle',
        source: 'countries',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-color': countryColor,
          'circle-radius': whileTiny(5), // pixels
          'circle-opacity': markerOpacity,
          ...markerStroke,
          'circle-stroke-width': whileTiny(markerStroke['circle-stroke-width']),
          'circle-stroke-opacity': markerOpacity
        }
      },
      // Vatican City's circle is also always shown (in whatever colour the
      // country has) once the map is zoomed in to a region (at zoom 6 the
      // view is about 16 degrees wide, e.g. central Italy), until zoom 12,
      // where its real shape starts to be visible.
      {
        id: 'countries-markers-always',
        type: 'circle',
        source: 'countries',
        filter: ['all',
          ['==', ['geometry-type'], 'Point'],
          ['==', ['get', 'ADMIN'], 'Vatican']],
        minzoom: 6,
        maxzoom: 12,
        paint: {
          'circle-color': countryColor,
          'circle-radius': 5, // pixels
          ...markerStroke
        }
      },
      // Invisible, slightly larger click/hover area around each small
      // country, so it can be clicked without pixel-perfect aim. It sits
      // above the country shapes, so inside it the small country wins
      // over a larger neighbour.
      {
        id: 'countries-markers-hit',
        type: 'circle',
        source: 'countries',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': whileTiny(7), // pixels
          'circle-opacity': 0
        }
      }
    ]
  };
}

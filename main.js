/*
World Map Game — based on MapLibre mapping library.

It renders country polygons from a public-domain GeoJSON dataset 
(Natural Earth, via jsDelivr CDN) using MapLibre's WebGL renderer.

It uses Natural Earth's 10m resolution countries dataset, which is 
the highest detail tier Natural Earth offers.

Since this is all loaded as one static GeoJSON blob, it re-renders 
the same already-loaded vertices at a larger scale and doesn't fetch 
additional detail while zooming in.
*/

import { adjust } from './adjust.js';
import { initSettings } from './settings.js';
import { initPanel } from './panels.js';
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

  // The info and settings panels work independently of the map, so set
  // them up first.
  initPanel('info', 'info-button', 'info-panel');
  initSettings();

  // Temporary status text for testing purposes.
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Loading map data…';

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
  // smoother one that glides like the +/- buttons (see setupSmoothScrollZoom).
  map.scrollZoom.disable();
  setupSmoothScrollZoom(map);

  // Keep the map north-up: no two-finger twist on touchscreens and no
  // Shift + arrow keys rotation. Pinch-zoom and arrow-key panning still work.
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();

  // Position of plus/minus zoom button controls.
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  // Set up the game once the map has finished loading. It replaces the
  // "Loading map data…" status with its own text and shows the Start
  // button; the first country appears when the player presses it.
  map.on('load', () => startGame(map, countriesGeoJsonData, {
    titleEl: document.querySelector('header h1'),
    statusEl,
    startButton: document.getElementById('start-button'),
    scoreboard: document.getElementById('scoreboard'),
    results: document.getElementById('results'),
    gameButtons: document.getElementById('game-buttons')
  }));

  // Error handling in case map loading fails.
  map.on('error', e => {
    console.error('MapLibre error:', e.error);
    statusEl.textContent = 'Map failed to load — check the console.';
  });
}

// Smooth scroll-wheel zoom. Each wheel notch sets a target zoom level and
// the map glides there with an eased animation, the same way the +/-
// buttons do. Notches that arrive while it's still gliding add to the
// same target, so fast scrolling keeps one continuous motion instead of
// restarting with a jolt each time. Zooms towards the mouse pointer.
function setupSmoothScrollZoom(map) {
  // Zoom levels per pixel of wheel movement. A typical mouse-wheel notch
  // is 100px, so 0.005 gives half a zoom level per notch (the +/-
  // buttons do a whole level). Higher number means faster zoom.
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

    targetZoom = Math.min(Math.max(startZoom - deltaPx * ZOOM_PER_PIXEL, map.getMinZoom()), map.getMaxZoom());

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

  // Small-country marker circles appear only once the map is zoomed in to
  // a region (at zoom 6 the view is about 16 degrees wide, e.g. central
  // Italy), and hide again from the zoom level where small countries are
  // big enough to see and click as their real shape.
  const MARKER_MIN_ZOOM = 6;
  const MARKER_MAX_ZOOM = 12;

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
      // Small countries (e.g. Vatican City) shown as a circle, since
      // their real shape is too tiny to see or click until zoomed far in.
      {
        id: 'countries-markers',
        type: 'circle',
        source: 'countries',
        filter: ['==', ['geometry-type'], 'Point'],
        minzoom: MARKER_MIN_ZOOM,
        maxzoom: MARKER_MAX_ZOOM,
        paint: {
          'circle-color': countryColor,
          // Radius in pixels.
          'circle-radius': 5,
          'circle-stroke-color': getMapColor('--map-outline'),
          'circle-stroke-width': 1
        }
      },
      // Invisible, larger click/hover area around each marker circle,
      // so the small circles are easy to hit.
      {
        id: 'countries-markers-hit',
        type: 'circle',
        source: 'countries',
        filter: ['==', ['geometry-type'], 'Point'],
        minzoom: MARKER_MIN_ZOOM,
        maxzoom: MARKER_MAX_ZOOM,
        paint: {
          'circle-radius': 10,
          'circle-opacity': 0
        }
      }
    ]
  };
}

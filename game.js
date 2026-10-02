/*
The game: shows the name of a country in the page title, waits for the
player to double-click a country on the map, marks the answer and then
moves on to the next country.

- Countries come in a random order without repeats; after all of them,
  a new round starts in a fresh order.
- Correct answer: the country turns green.
- Wrong answer: the clicked country turns red and the correct one green.
  If the correct country is off-screen, the map pans to it; if it's too
  small to see, a green ring marks where it is.
- Clicks are ignored while a result is shown, then the next country
  appears.
- Answered countries keep a (slightly darker) colour for the rest of the
  round: green if found, red if missed. The wrong guess itself goes back
  to normal, since it wasn't the question. A new round clears them all.

Map colour states used (see countryColor in main.js):
  correct / wrong  - the answer being shown right now (bright green / red)
  found / missed   - countries answered earlier this round (darker)
*/

import { initEventHandling, isInteractive } from './handler.js';

// How long a result stays on the map before the next country appears.
const CORRECT_PAUSE_MS = 1500;
const WRONG_PAUSE_MS = 3000;

export function startGame(map, countriesData, { titleEl, statusEl }) {
  // One entry per country. Small countries also have a marker point with
  // the same name (see adjust.js), which is skipped here.
  const countries = countriesData.features
    .filter(f => isInteractive(f) && f.geometry.type !== 'Point');
  const names = countries.map(f => f.properties.ADMIN);
  const mainPieces = new Map(countries.map(f => [f.properties.ADMIN, mainPiece(f)]));

  const input = initEventHandling(map, { onConfirm: answer });
  addRevealRing(map);

  let queue = [];
  let target = null;
  let round = 1;
  let correct = 0;
  let answered = 0;

  nextCountry();

  function nextCountry() {
    if (queue.length === 0) {
      if (answered > 0) {
        round++;
        // New round: clear the found/missed colours of the last one.
        for (const name of names) setResult(name, { found: false, missed: false });
      }
      queue = shuffle([...names]);
    }
    target = queue.pop();
    titleEl.textContent = target;
    statusEl.textContent = `Double-click it on the map${scoreText()}`;
    input.setLocked(false);
  }

  function answer(guess) {
    input.setLocked(true);
    input.clearSelection();
    answered++;

    const isCorrect = guess === target;
    if (isCorrect) {
      correct++;
      setResult(target, { correct: true });
      statusEl.textContent = `Correct!${scoreText()}`;
    } else {
      setResult(guess, { wrong: true });
      setResult(target, { correct: true });
      statusEl.textContent = `That was ${guess}.${scoreText()}`;
      showIfOffScreen(target);
      ringIfTiny(target);
    }

    const shown = target;
    setTimeout(() => {
      // End of the reveal: the asked country keeps its result colour for
      // the rest of the round; the wrong guess goes back to normal.
      setResult(shown, { correct: false, found: isCorrect, missed: !isCorrect });
      if (!isCorrect) setResult(guess, { wrong: false });
      setRing(null);
      nextCountry();
    }, isCorrect ? CORRECT_PAUSE_MS : WRONG_PAUSE_MS);
  }

  function scoreText() {
    if (answered === 0) return '';
    const roundText = round > 1 ? ` · Round ${round}` : '';
    return ` · Score ${correct} / ${answered}${roundText}`;
  }

  function setResult(countryId, state) {
    map.setFeatureState({ source: 'countries', id: countryId }, state);
  }

  // Pan (keeping the zoom level) so the correct country is on screen.
  function showIfOffScreen(countryId) {
    const piece = mainPieces.get(countryId);
    if (piece && !map.getBounds().contains(piece.centre)) {
      map.easeTo({ center: piece.centre, duration: 800 });
    }
  }

  // A country only a few pixels across at the current zoom (e.g. Mauritius
  // or Vatican City at world view) can't be seen even when coloured green,
  // so a green ring is drawn around it while the answer is shown.
  function ringIfTiny(countryId) {
    const piece = mainPieces.get(countryId);
    if (!piece) return;
    const [w, s, e, n] = piece.bbox;
    const sw = map.project([w, s]);
    const ne = map.project([e, n]);
    const sizePx = Math.max(Math.abs(ne.x - sw.x), Math.abs(ne.y - sw.y));
    if (sizePx < RING_IF_SMALLER_THAN_PX) setRing(piece.centre);
  }

  function setRing(centre) {
    map.getSource('reveal-ring').setData({
      type: 'FeatureCollection',
      features: centre ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: centre } }] : []
    });
  }
}

// Countries smaller than this on screen (width or height, in pixels) get
// a green ring around them when revealed as the correct answer.
const RING_IF_SMALLER_THAN_PX = 12;

// Map layer for the ring, drawn above everything else. Starts empty.
function addRevealRing(map) {
  map.addSource('reveal-ring', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'reveal-ring',
    type: 'circle',
    source: 'reveal-ring',
    paint: {
      'circle-radius': 14,
      'circle-color': 'rgba(0, 0, 0, 0)',
      'circle-stroke-color': getComputedStyle(document.documentElement).getPropertyValue('--map-correct').trim(),
      'circle-stroke-width': 3
    }
  });
}

// A country's largest piece (by bounding box): its bounding box
// [west, south, east, north] and centre. Using the largest piece means
// countries spanning the 180° meridian (e.g. Russia, Fiji) or with
// far-flung islands (e.g. the US) are centred on their main land, not
// somewhere in between.
function mainPiece(feature) {
  const polygons = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
  let best = null;
  let bestArea = -1;
  for (const polygon of polygons) {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of polygon[0]) {
      minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    }
    const area = (maxLng - minLng) * (maxLat - minLat);
    if (area > bestArea) {
      bestArea = area;
      best = {
        bbox: [minLng, minLat, maxLng, maxLat],
        centre: [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
      };
    }
  }
  return best;
}

// Fisher–Yates shuffle (in place).
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

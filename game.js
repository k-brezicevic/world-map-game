/*
The game: shows the name of a country in the page title, waits for the
player to double-click a country on the map, marks the answer and then
moves on to the next country. It begins when the player presses Start.

- Countries come in a random order without repeats; after all of them,
  a new round starts in a fresh order.
- Final colours: green = asked for and found, red = asked for and missed.
- Correct answer: the country turns green.
- Wrong answer: the asked-for country flashes green three times (to show
  where it is), then turns red. The country the player picked stays
  orange (the selection colour) to show where they clicked. If the
  asked-for country is off-screen, the map pans to it; if it's too small
  to see, a ring marks where it is (flashing green, then red).
- Clicks are ignored while a result is shown, then the next country
  appears.
- The scoreboard (top-left) shows, for the current round, the number of
  correct answers, misses and countries remaining.
- Answered countries keep their colour (slightly darker) for the rest of
  the round. The wrong pick goes back to normal, since it wasn't the
  question. A new round clears them all.

Map colour states used (see countryColor in main.js):
  correct / wrong  - the asked-for country while its result is shown
                     (bright green / bright red; after a miss it flashes
                     "correct" first, then settles on "wrong")
  picked           - the player's wrong pick while the result is shown
                     (orange)
  found / missed   - countries answered earlier this round (darker)
*/

import { initEventHandling, isInteractive } from './handler.js';

// How long a result stays on the map before the next country appears.
const CORRECT_PAUSE_MS = 800;
const WRONG_PAUSE_MS = 1500;

// After a miss, the asked-for country flashes green this many times (to
// show where it is), each flash BLINK_MS on and BLINK_MS off, then turns
// red and stays red. The flashing is part of WRONG_PAUSE_MS, not added
// to it.
const BLINK_COUNT = 3;
const BLINK_MS = 150;

/*
Sets up the game once the map has loaded and shows the Start button;
the first country appears when the player presses it.
  titleEl:     the page title, which shows the country to find
  statusEl:    the line under it (the round number, from round 2)
  startButton: the Start button (hidden until the game is ready)
  scoreboard:  the top-left counters (#score-correct, #score-missed,
               #score-remaining), hidden until the game starts
*/
export function startGame(map, countriesData, { titleEl, statusEl, startButton, scoreboard }) {
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
  // Counts for the current round (reset when a new round starts).
  let correct = 0;
  let missed = 0;

  const correctEl = scoreboard.querySelector('#score-correct');
  const missedEl = scoreboard.querySelector('#score-missed');
  const remainingEl = scoreboard.querySelector('#score-remaining');

  // Until Start is pressed, the map can be explored but not answered, and
  // the header shows just the title and the Start button (the status line
  // is hidden, so it doesn't leave an empty gap).
  input.setLocked(true);
  statusEl.hidden = true;
  startButton.hidden = false;
  startButton.addEventListener('click', () => {
    startButton.hidden = true;
    statusEl.hidden = false;
    scoreboard.hidden = false;
    nextCountry();
  }, { once: true });

  function nextCountry() {
    if (queue.length === 0) {
      if (correct + missed > 0) {
        // New round: reset the counts and clear the found/missed colours
        // of the last one.
        round++;
        correct = 0;
        missed = 0;
        for (const name of names) setResult(name, { found: false, missed: false });
      }
      queue = shuffle([...names]);
    }
    target = queue.pop();
    titleEl.textContent = target;
    flashTitle();
    statusEl.textContent = round > 1 ? `Round ${round}` : '';
    updateScoreboard();
    input.setLocked(false);
  }

  function answer(guess) {
    input.setLocked(true);
    input.clearSelection();

    const isCorrect = guess === target;
    if (isCorrect) {
      correct++;
      setResult(target, { correct: true });
    } else {
      missed++;
      setResult(guess, { picked: true });
      showIfOffScreen(target);
      flashThenRed(target, tinyCountryCentre(target));
    }
    updateScoreboard();

    const shown = target;
    setTimeout(() => {
      // End of the reveal: the asked country keeps its result colour for
      // the rest of the round (same colour, slightly darker); the wrong
      // pick goes back to normal.
      setResult(shown, { correct: false, wrong: false, found: isCorrect, missed: !isCorrect });
      if (!isCorrect) setResult(guess, { picked: false });
      setRing(null);
      nextCountry();
    }, isCorrect ? CORRECT_PAUSE_MS : WRONG_PAUSE_MS);
  }

  // Briefly flashes the title (see h1.flash in page-style.css) so the
  // player notices the new country. Removing the class and forcing a
  // layout restarts the animation even if it's still running.
  function flashTitle() {
    titleEl.classList.remove('flash');
    void titleEl.offsetWidth;
    titleEl.classList.add('flash');
  }

  // Remaining = countries in this round not answered yet (including the
  // one currently asked).
  function updateScoreboard() {
    correctEl.textContent = correct;
    missedEl.textContent = missed;
    remainingEl.textContent = names.length - correct - missed;
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
  // or Vatican City at world view) can't be seen even when coloured, so it
  // gets a ring around it while the answer is shown. Returns where the
  // ring goes, or null if the country is big enough to see.
  function tinyCountryCentre(countryId) {
    const piece = mainPieces.get(countryId);
    if (!piece) return null;
    const [w, s, e, n] = piece.bbox;
    const sw = map.project([w, s]);
    const ne = map.project([e, n]);
    const sizePx = Math.max(Math.abs(ne.x - sw.x), Math.abs(ne.y - sw.y));
    return sizePx < RING_IF_SMALLER_THAN_PX ? piece.centre : null;
  }

  // The missed country (and its ring, if it has one) flashes green
  // BLINK_COUNT times - green, off, green, off, ... - then turns red and
  // stays red for the rest of the pause.
  function flashThenRed(countryId, ringCentre) {
    const show = colour => {
      setResult(countryId, { correct: colour === 'green', wrong: colour === 'red' });
      if (ringCentre) setRing(colour === 'off' ? null : ringCentre, colour);
    };
    show('green');
    for (let i = 1; i < BLINK_COUNT * 2; i++) {
      const colour = i % 2 === 1 ? 'off' : 'green';
      setTimeout(() => show(colour), i * BLINK_MS);
    }
    setTimeout(() => show('red'), BLINK_COUNT * 2 * BLINK_MS);
  }

  // colour: 'green' or 'red'.
  function setRing(centre, colour) {
    map.getSource('reveal-ring').setData({
      type: 'FeatureCollection',
      features: centre ? [{ type: 'Feature', properties: { colour }, geometry: { type: 'Point', coordinates: centre } }] : []
    });
  }
}

// Countries smaller than this on screen (width or height, in pixels) get
// a ring around them when revealed as the missed answer.
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
      // Same colour as the country it marks: green while flashing, then red.
      'circle-stroke-color': [
        'match', ['get', 'colour'],
        'green', getComputedStyle(document.documentElement).getPropertyValue('--map-correct').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--map-wrong').trim()
      ],
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

/*
The game: shows the name of a country in the page title, waits for the
player to double-click a country on the map, marks the answer and then
moves on to the next country. It begins when the player presses Start.

- Countries come in a random order without repeats. After all of them,
  the game ends: a results card over the map shows the percentage
  answered correctly and the counts, with "Play again" and "View map"
  buttons. The scoreboard and map colours stay as they are, and the
  title goes back to "World Map Game" with a "Play again" button under
  it (for when the card has been closed). A new game uses a fresh order.
- Final colours: green = asked for and found, red = asked for and missed.
- Correct answer: the country turns green.
- Wrong answer: the asked-for country flashes green three times (to show
  where it is), then turns red. The country the player picked stays
  orange (the selection colour) to show where they clicked. If the
  asked-for country is off-screen, the map pans to it; if it's too small
  to see, a ring marks where it is (flashing green, then red).
- For territories, an info icon after the name shows whose they are on
  hover or click ("Territory of Denmark" for Greenland).
- Under the country name: "Skip" puts the country at the end of the list
  (it comes back after all the others), and "I don't know" counts it as
  a miss, revealed like a wrong answer.
- Clicks (and those buttons) are ignored while a result is shown, then
  the next country appears.
- The scoreboard (top-left) shows the number of correct answers, misses
  and countries remaining in the game.
- Answered countries keep their colour (slightly darker) for the rest of
  the game. The wrong pick goes back to normal, since it wasn't the
  question. A new game clears them all.

Map colour states used (see countryColor in main.js):
  correct / wrong  - the asked-for country while its result is shown
                     (bright green / bright red; after a miss it flashes
                     "correct" first, then settles on "wrong")
  picked           - the player's wrong pick while the result is shown
                     (orange)
  found / missed   - countries answered earlier in the game (darker)
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

// Countries in the game that are territories of another state. While one
// is being asked, a small info icon after its name shows "Territory of
// <state>" on hover or click (see territoryInfo). Kept as an explicit list
// rather than read from the map data's SOVEREIGNT field, which would also
// label e.g. Palestine (as Israel).
const TERRITORY_OF = {
  'Greenland': 'Denmark',
  'Puerto Rico': 'the United States',
  'Falkland Islands': 'the United Kingdom',
  'French Guiana': 'France',
  'New Caledonia': 'France'
};

/*
Sets up the game once the map has loaded and shows the Start button;
the first country appears when the player presses it.
  titleEl:     the page title, which shows the country to find
  statusEl:    the line under it (hidden during a game)
  startButton: the Start button (hidden until the game is ready); it
               returns as "Play again" when the game ends
  scoreboard:  the top-left counters (#score-correct, #score-missed,
               #score-remaining), hidden until the game starts
  results:     the results card shown over the map when the game ends
  gameButtons: the "Skip" (#skip-button) and "I don't know"
               (#dont-know-button) buttons, shown during a game
*/
export function startGame(map, countriesData, { titleEl, statusEl, startButton, scoreboard, results, gameButtons }) {
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
  let correct = 0;
  let missed = 0;

  const correctEl = scoreboard.querySelector('#score-correct');
  const missedEl = scoreboard.querySelector('#score-missed');
  const remainingEl = scoreboard.querySelector('#score-remaining');
  const skipButton = gameButtons.querySelector('#skip-button');
  const dontKnowButton = gameButtons.querySelector('#dont-know-button');

  // "Skip": the current country goes to the end of the list and comes
  // back after all the others. "I don't know": counts as a miss, shown
  // like a wrong answer (without a wrong pick).
  skipButton.addEventListener('click', skipCountry);
  dontKnowButton.addEventListener('click', () => answer(null));

  // Until Start is pressed, the map can be explored but not answered, and
  // the header shows just the title and the Start button (the status line
  // is hidden, so it doesn't leave an empty gap). The same button returns
  // as "Play again" when a game ends.
  setAnswering(false);
  statusEl.hidden = true;
  startButton.hidden = false;
  startButton.addEventListener('click', newGame);

  // Results card: "Play again" starts a new game; "View map", a click on
  // the dimmed map around the card, or Escape closes it to show the map.
  results.querySelector('#results-play-again').addEventListener('click', newGame);
  results.querySelector('#results-view-map').addEventListener('click', hideResults);
  results.addEventListener('click', e => {
    if (e.target === results) hideResults();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !results.hidden) hideResults();
  });

  // Starts a game: clears the colours and scores of any previous game and
  // asks all countries again, in a fresh random order.
  function newGame() {
    for (const name of names) setResult(name, { found: false, missed: false });
    correct = 0;
    missed = 0;
    queue = shuffle([...names]);
    preAnswerForTesting();
    hideResults();
    startButton.hidden = true;
    // During a game the line under the title is replaced by the Skip and
    // "I don't know" buttons.
    statusEl.hidden = true;
    gameButtons.hidden = false;
    scoreboard.hidden = false;
    nextCountry();
  }

  // The queue is in random order and is taken from its end (pop), so its
  // start is "the end of the list".
  function nextCountry() {
    if (queue.length === 0) {
      finishGame();
      return;
    }
    target = queue.pop();
    titleEl.textContent = target;
    if (TERRITORY_OF[target]) titleEl.append(territoryInfo(`Territory of ${TERRITORY_OF[target]}`));
    flashTitle();
    updateScoreboard();
    setAnswering(true);
  }

  // Puts the current country at the end of the list and moves on.
  function skipCountry() {
    input.clearSelection();
    queue.unshift(target);
    nextCountry();
  }

  // Whether the player can answer now (map and buttons), or not (e.g.
  // while a result is shown). Skip also needs another country to skip to.
  function setAnswering(enabled) {
    input.setLocked(!enabled);
    dontKnowButton.disabled = !enabled;
    skipButton.disabled = !enabled || queue.length === 0;
  }

  // TESTING ONLY: open the page with ?skip=N in the address (e.g.
  // index.html?skip=200) to start each game with N countries already
  // answered (about 70% correct, 30% missed, at random), so the end of
  // the game can be reached quickly. Without the parameter, nothing
  // happens.
  function preAnswerForTesting() {
    const skip = Number(new URLSearchParams(location.search).get('skip'));
    if (!(skip > 0)) return;
    const count = Math.min(Math.floor(skip), queue.length - 1);
    for (let i = 0; i < count; i++) {
      const name = queue.pop();
      const found = Math.random() < 0.7;
      if (found) correct++; else missed++;
      setResult(name, { found, missed: !found });
    }
    console.warn(`Testing: ${count} countries pre-answered (?skip=${skip}).`);
  }

  // All countries answered: keep the final scores and map colours, show
  // the share answered correctly, and offer to play again.
  function finishGame() {
    target = null;
    const percent = Math.round(correct / names.length * 100);
    // Back to the game's name, as before the first game (the result is on
    // the results card).
    titleEl.textContent = 'World Map Game';
    statusEl.textContent = '';
    statusEl.hidden = true;
    gameButtons.hidden = true;
    updateScoreboard();
    // Stays under the title, for when the results card has been closed.
    startButton.textContent = 'Play again';
    startButton.hidden = false;
    showResults(percent);
  }

  // Results card over the map (see #results in index.html).
  function showResults(percent) {
    results.querySelector('#results-percent').textContent = `${percent}%`;
    // "<found> out of <total> countries"
    results.querySelector('#results-found').textContent = correct;
    results.querySelector('#results-total').textContent = names.length;
    results.querySelector('#results-correct').textContent = correct;
    results.querySelector('#results-missed').textContent = missed;
    results.hidden = false;
    results.querySelector('#results-play-again').focus();
  }

  function hideResults() {
    results.hidden = true;
  }

  // guess: the country the player double-clicked, or null for "I don't
  // know" (a miss, shown the same way but without a wrong pick).
  function answer(guess) {
    setAnswering(false);
    input.clearSelection();

    const isCorrect = guess === target;
    if (isCorrect) {
      correct++;
      setResult(target, { correct: true });
    } else {
      missed++;
      if (guess) setResult(guess, { picked: true });
      showIfOffScreen(target);
      flashThenRed(target, tinyCountryCentre(target));
    }
    updateScoreboard();

    const shown = target;
    setTimeout(() => {
      // End of the reveal: the asked country keeps its result colour for
      // the rest of the game (same colour, slightly darker); the wrong
      // pick goes back to normal.
      setResult(shown, { correct: false, wrong: false, found: isCorrect, missed: !isCorrect });
      if (guess && !isCorrect) setResult(guess, { picked: false });
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

  // Remaining = countries in this game not answered yet (including the
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

// Small "i" button placed after a territory's name in the title, with a
// tooltip holding `text` (e.g. "Territory of Denmark"). The tooltip shows
// on hover, and on click/tap (which focuses the button - needed on touch
// screens); clicking elsewhere hides it again. Styles: .territory-info in
// page-style.css.
function territoryInfo(text) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'territory-info';
  button.setAttribute('aria-label', text);
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="10"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>';
  const tip = document.createElement('span');
  tip.className = 'territory-tip';
  tip.setAttribute('role', 'tooltip');
  tip.textContent = text;
  button.append(tip);
  return button;
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

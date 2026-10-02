import { getDoubleClickDelay } from './settings.js';

// Features still drawn on the map but ignored by clicks and hover
// (and left out of listCountries() in main.js and out of the game).
const NON_INTERACTIVE_COUNTRIES = ['Antarctica'];

export function isInteractive(feature) {
  return !NON_INTERACTIVE_COUNTRIES.includes(feature.properties.ADMIN);
}

// Map layers that react to clicks and hover: the country shapes, and the
// (invisible, slightly larger) click areas around small-country marker
// circles. The marker layer is drawn on top, so where a marker overlaps a
// bigger country (Vatican City inside Italy), the marker is the one hit.
const INTERACTIVE_LAYERS = ['countries-fill', 'countries-markers-hit'];

/*
Mouse input on the map: hover highlight, single-click selection (orange)
and double-click confirmation.
  onConfirm(countryId): called when the player double-clicks a country;
                        countryId is the country's name (its map id).
Returns controls for the game:
  clearSelection():  removes the orange selection.
  setLocked(locked): while locked, clicks are ignored (hover still works),
                     e.g. while the game shows the result of an answer.
*/
export function initEventHandling(map, { onConfirm }) {
  let selectedFeatureId = null;   // orange — single-click, one at a time
  let locked = false;

  // Click behavior, in three cases:
  //  1. Click on a country that isn't selected -> select it (orange),
  //     instantly, no delay.
  //  2. A SECOND click landing on the same country within the
  //     double-click window (adjustable with the slider in the
  //     settings panel, see settings.js) -> treated as a double-click
  //     -> confirmed as the player's answer (onConfirm), instantly.
  //  3. A click on the currently-selected country that ISN'T fast
  //     enough to count as case 2 -> this would normally deselect it,
  //     but instead of doing that immediately, we wait out the same
  //     window first. If a follow-up click arrives in time, it's
  //     caught by case 2 above and confirms instead — so the country
  //     never visibly flickers back to its default color first. Only
  //     if nothing follows does the deselect actually happen.
  let lastClickFeatureId = null;
  let lastClickTime = 0;
  let pendingDeselectTimer = null;

  // Lakes are drawn on top of the country shapes, which include them as
  // land. A click or hover on a lake shouldn't count as the country under
  // it (a small-country marker still wins, being drawn above the lakes).
  const isOnLake = e =>
    Boolean(map.getLayer('lakes')) &&
    map.queryRenderedFeatures(e.point, { layers: ['lakes'] }).length > 0;

  const countryAt = e => {
    if (!e.features || e.features.length === 0) return null;
    const feature = e.features[0];
    if (feature.layer.id === 'countries-fill' && isOnLake(e)) return null;
    return isInteractive(feature) ? feature : null;
  };

  const cancelPendingDeselect = () => {
    if (pendingDeselectTimer) {
      clearTimeout(pendingDeselectTimer);
      pendingDeselectTimer = null;
    }
  };

  const setSelected = featureId => {
    if (selectedFeatureId !== null) {
      map.setFeatureState({ source: 'countries', id: selectedFeatureId }, { selected: false });
    }
    selectedFeatureId = featureId;
    if (selectedFeatureId !== null) {
      map.setFeatureState({ source: 'countries', id: selectedFeatureId }, { selected: true });
    }
  };

  map.on('click', INTERACTIVE_LAYERS, e => {
    if (locked) return;
    const feature = countryAt(e);
    if (!feature) return;
    const featureId = feature.id;
    // When the click actually happened, not when it's handled: if the
    // browser is busy (e.g. redrawing the map after the first click),
    // the second click can be handled late, and measuring handling times
    // would then miss a genuine double-click.
    const now = e.originalEvent ? e.originalEvent.timeStamp : performance.now();
    const doubleClickWindowMs = getDoubleClickDelay();

    const isDoubleClick =
      featureId === lastClickFeatureId &&
      now - lastClickTime < doubleClickWindowMs;

    if (isDoubleClick) {
      // Reset tracking so a third rapid click starts fresh.
      lastClickFeatureId = null;
      lastClickTime = 0;
      // A deferred deselect might still be pending from the previous
      // click on this same country — cancel it, since we're
      // confirming instead.
      cancelPendingDeselect();
      setSelected(null);
      onConfirm(featureId);
      return;
    }

    if (selectedFeatureId === featureId) {
      // Clicking the already-selected country, but not fast enough to
      // be a double-click. Don't deselect yet — give it a moment in
      // case a follow-up click arrives to confirm it instead.
      cancelPendingDeselect();
      pendingDeselectTimer = setTimeout(() => {
        if (selectedFeatureId === featureId) setSelected(null);
        pendingDeselectTimer = null;
      }, doubleClickWindowMs);
    } else {
      // Selecting a different/new country is unambiguous — do it
      // instantly, and drop any stale pending deselect for the
      // previous selection.
      cancelPendingDeselect();
      setSelected(featureId);
    }

    lastClickFeatureId = featureId;
    lastClickTime = now;
  });

  // Pointer and fill-color feedback on hover. mousemove (rather than
  // mouseenter) is needed so moving directly from one country to a
  // neighbouring one updates the highlight.
  let hoveredFeatureId = null;

  const setHovered = featureId => {
    if (hoveredFeatureId === featureId) return;
    if (hoveredFeatureId !== null) {
      map.setFeatureState({ source: 'countries', id: hoveredFeatureId }, { hover: false });
    }
    hoveredFeatureId = featureId;
    if (hoveredFeatureId !== null) {
      map.setFeatureState({ source: 'countries', id: hoveredFeatureId }, { hover: true });
    }
  };

  map.on('mousemove', INTERACTIVE_LAYERS, e => {
    const feature = countryAt(e);
    if (!feature) {
      map.getCanvas().style.cursor = '';
      setHovered(null);
      return;
    }
    map.getCanvas().style.cursor = locked ? '' : 'pointer';
    setHovered(feature.id);
  });
  map.on('mouseleave', INTERACTIVE_LAYERS, () => {
    map.getCanvas().style.cursor = '';
    setHovered(null);
  });

  return {
    clearSelection() {
      cancelPendingDeselect();
      lastClickFeatureId = null;
      lastClickTime = 0;
      setSelected(null);
    },
    setLocked(value) {
      locked = value;
    }
  };
}

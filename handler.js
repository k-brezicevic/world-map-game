import { getDoubleClickDelay } from './settings.js';

// Features still drawn on the map but ignored by clicks and hover
// (and left out of listCountries() in main.js).
const NON_INTERACTIVE_COUNTRIES = ['Antarctica'];

export function isInteractive(feature) {
  return !NON_INTERACTIVE_COUNTRIES.includes(feature.properties.ADMIN);
}

export function initEventHandling(map, statusEl) {
  let selectedFeatureId = null;       // orange — single-click, one at a time
  let selectedFeatureName = null;
  const confirmedFeatureIds = new Set(); // green — double-click, can have several at once

  // Click behavior, in three cases:
  //  1. Click on a country with no state yet -> select it (orange),
  //     instantly, no delay.
  //  2. A SECOND click landing on the same country within the
  //     double-click window (adjustable with the slider in the
  //     settings panel, see settings.js) -> treated as a double-click
  //     -> confirm it (green), instantly.
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

  map.on('click', 'countries-fill', e => {
    if (!e.features || e.features.length === 0) return;
    const feature = e.features[0];
    if (!isInteractive(feature)) return;
    const featureId = feature.id;
    const now = Date.now();
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
      if (pendingDeselectTimer) {
        clearTimeout(pendingDeselectTimer);
        pendingDeselectTimer = null;
      }

      if (selectedFeatureId === featureId) {
        map.setFeatureState({ source: 'countries', id: featureId }, { selected: false });
        selectedFeatureId = null;
        selectedFeatureName = null;
      }
      handleCountryConfirmed(feature);
      return;
    }

    if (selectedFeatureId === featureId) {
      // Clicking the already-selected country, but not fast enough to
      // be a double-click. Don't deselect yet — give it a moment in
      // case a follow-up click arrives to confirm it instead.
      if (pendingDeselectTimer) clearTimeout(pendingDeselectTimer); // shouldn't normally exist here, safety only
      pendingDeselectTimer = setTimeout(() => {
        map.setFeatureState({ source: 'countries', id: featureId }, { selected: false });
        if (selectedFeatureId === featureId) {
          selectedFeatureId = null;
          selectedFeatureName = null;
        }
        pendingDeselectTimer = null;
        updateStatus();
      }, doubleClickWindowMs);
    } else {
      // Selecting a different/new country is unambiguous — do it
      // instantly, and drop any stale pending deselect for the
      // previous selection (handleCountrySelected already clears its
      // visual state).
      if (pendingDeselectTimer) {
        clearTimeout(pendingDeselectTimer);
        pendingDeselectTimer = null;
      }
      handleCountrySelected(feature);
    }

    lastClickFeatureId = featureId;
    lastClickTime = now;
  });

  function handleCountrySelected(feature) {
    const featureId = feature.id;

    if (selectedFeatureId !== null) {
      map.setFeatureState({ source: 'countries', id: selectedFeatureId }, { selected: false });
    }

    map.setFeatureState({ source: 'countries', id: featureId }, { selected: true });
    selectedFeatureId = featureId;
    selectedFeatureName = countryName(feature);
    updateStatus();

    // NOTE: this dataset does NOT automatically group a country with
    // its overseas territories the way we did for the SVG version
    // (e.g. clicking French Guiana here selects only French Guiana,
    // not "France" as a whole). Each feature has a SOV_A3 property
    // that identifies the sovereign state a territory belongs to,
    // which could be used to re-implement that grouping behavior the
    // same way we grouped Alaska/French Guiana before, if you want
    // that back — just ask and I'll wire it up.
  }

  function handleCountryConfirmed(feature) {
    const featureId = feature.id;

    if (confirmedFeatureIds.has(featureId)) {
      // double-clicking an already-confirmed country un-confirms it
      map.setFeatureState({ source: 'countries', id: featureId }, { confirmed: false });
      confirmedFeatureIds.delete(featureId);
    } else {
      map.setFeatureState({ source: 'countries', id: featureId }, { confirmed: true });
      confirmedFeatureIds.add(featureId);
    }
    updateStatus();
  }

  function countryName(feature) {
    return feature.properties.ADMIN || feature.properties.NAME || '(unnamed)';
  }

  function updateStatus() {
    const parts = [];
    if (selectedFeatureName !== null) {
      parts.push(`Selected: ${selectedFeatureName}`);
    }
    if (confirmedFeatureIds.size > 0) {
      parts.push(`${confirmedFeatureIds.size} confirmed`);
    }
    statusEl.textContent = parts.length > 0 ? parts.join(' · ') : 'Nothing selected.';
  }

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

  map.on('mousemove', 'countries-fill', e => {
    if (!e.features || e.features.length === 0) return;
    const feature = e.features[0];
    if (!isInteractive(feature)) {
      map.getCanvas().style.cursor = '';
      setHovered(null);
      return;
    }
    map.getCanvas().style.cursor = 'pointer';
    setHovered(feature.id);
  });
  map.on('mouseleave', 'countries-fill', () => {
    map.getCanvas().style.cursor = '';
    setHovered(null);
  });

  console.log('Map loaded. Click a country to highlight it, double-click to confirm it.');
}
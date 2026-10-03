/*
Adjusts the Natural Earth country data for the game: merges territories
and disputed areas into countries, splits some out, removes others
entirely, renames countries and adds marker points for tiny countries.
*/
export function adjust(geojson) {
    assignBaikonurToKazakhstan(geojson);
    assignCrimeaToUkraine(geojson);
    separateFrenchGuiana(geojson);
    removeCountries(geojson);

    const findFeatureByNameSubstring = substrings =>
        geojson.features.find(f => {
            const admin = (f.properties.ADMIN || '').toLowerCase();
            const name = (f.properties.NAME || '').toLowerCase();
            return substrings.some(s => admin.includes(s) || name.includes(s));
        });

    const egypt = geojson.features.find(f => f.properties.ADMIN === 'Egypt');
    const sudan = geojson.features.find(f => f.properties.ADMIN === 'Sudan');
    const morocco = geojson.features.find(f => f.properties.ADMIN === 'Morocco');
    const denmark = geojson.features.find(f => f.properties.ADMIN === 'Denmark');
    const cyprus = geojson.features.find(f => f.properties.ADMIN === 'Cyprus');
    const halaib = findFeatureByNameSubstring(['alaib', 'alayib']);
    const birTawil = findFeatureByNameSubstring(['bir tawil', "bir tawīl"]);
    const westernSahara = findFeatureByNameSubstring(['western sahara']);
    const faroeIslands = findFeatureByNameSubstring(['faroe', 'faeroe']);
    const akrotiri = findFeatureByNameSubstring(['akrotiri']);
    const dhekelia = findFeatureByNameSubstring(['dhekelia']);
    const cyprusNoMansArea = findFeatureByNameSubstring(['no mans area', "no man's area"]);
    const northernCyprus = findFeatureByNameSubstring(['northern cyprus']);
    const finland = geojson.features.find(f => f.properties.ADMIN === 'Finland');
    // Exact match rather than a substring — 'aland' would also match "New Zealand".
    const aland = geojson.features.find(f =>
        ['aland', 'åland'].includes((f.properties.ADMIN || '').toLowerCase()) ||
        ['aland', 'åland'].includes((f.properties.NAME || '').toLowerCase()));
    const unitedStates = geojson.features.find(f => f.properties.ADMIN === 'United States of America');
    const americanSamoa = findFeatureByNameSubstring(['american samoa']);
    const guam = findFeatureByNameSubstring(['guam']);
    const northernMarianas = findFeatureByNameSubstring(['northern mariana']);
    // Not plain 'virgin islands' — that would also match the British Virgin Islands.
    const usVirginIslands = findFeatureByNameSubstring(['united states virgin', 'u.s. virgin']);
    const usMinorOutlyingIslands = findFeatureByNameSubstring(['minor outlying']);
    const unitedKingdom = geojson.features.find(f => f.properties.ADMIN === 'United Kingdom');
    const anguilla = findFeatureByNameSubstring(['anguilla']);
    const bermuda = findFeatureByNameSubstring(['bermuda']);
    const britishIndianOcean = findFeatureByNameSubstring(['british indian ocean', 'br. indian ocean']);
    const britishVirginIslands = findFeatureByNameSubstring(['british virgin']);
    const caymanIslands = findFeatureByNameSubstring(['cayman']);
    const gibraltar = findFeatureByNameSubstring(['gibraltar']);
    const guernsey = findFeatureByNameSubstring(['guernsey']);
    const isleOfMan = findFeatureByNameSubstring(['isle of man']);
    const jersey = findFeatureByNameSubstring(['jersey']);
    const montserrat = findFeatureByNameSubstring(['montserrat']);
    const pitcairnIslands = findFeatureByNameSubstring(['pitcairn']);
    const saintHelena = findFeatureByNameSubstring(['saint helena', 'st. helena']);
    // Not plain 'georgia' — that would match the country Georgia.
    const southGeorgia = findFeatureByNameSubstring(['south georgia', 's. geo']);
    const turksCaicos = findFeatureByNameSubstring(['turks']);
    const netherlands = geojson.features.find(f => f.properties.ADMIN === 'Netherlands');
    const aruba = findFeatureByNameSubstring(['aruba']);
    const curacao = findFeatureByNameSubstring(['curaçao', 'curacao']);
    const sintMaarten = findFeatureByNameSubstring(['sint maarten']);
    const australia = geojson.features.find(f => f.properties.ADMIN === 'Australia');
    const ashmoreCartier = findFeatureByNameSubstring(['ashmore']);
    const coralSeaIslands = findFeatureByNameSubstring(['coral sea']);
    const heardMcDonald = findFeatureByNameSubstring(['heard i']);
    // Exact match rather than a substring — 'indian ocean' would also match
    // "British Indian Ocean Territory".
    const indianOceanTerritories = geojson.features.find(f =>
        f.properties.ADMIN === 'Indian Ocean Territories' ||
        ['Indian Ocean Territories', 'Indian Ocean Ter.'].includes(f.properties.NAME));
    const norfolkIsland = findFeatureByNameSubstring(['norfolk']);
    const colombia = geojson.features.find(f => f.properties.ADMIN === 'Colombia');
    const bajoNuevo = findFeatureByNameSubstring(['bajo nuevo']);
    const serranillaBank = findFeatureByNameSubstring(['serranilla']);
    const brazil = geojson.features.find(f => f.properties.ADMIN === 'Brazil');
    // Not plain 'brazil' — that would match Brazil itself.
    const brazilianIsland = findFeatureByNameSubstring(['brazilian island']);
    const france = geojson.features.find(f => f.properties.ADMIN === 'France');
    const clipperton = findFeatureByNameSubstring(['clipperton']);
    const china = geojson.features.find(f => f.properties.ADMIN === 'China');
    const hongKong = findFeatureByNameSubstring(['hong kong']);
    const macao = findFeatureByNameSubstring(['macao', 'macau']);
    const scarboroughReef = findFeatureByNameSubstring(['scarborough']);
    const india = geojson.features.find(f => f.properties.ADMIN === 'India');
    const siachenGlacier = findFeatureByNameSubstring(['siachen']);
    const somalia = geojson.features.find(f => f.properties.ADMIN === 'Somalia');
    const somaliland = findFeatureByNameSubstring(['somaliland']);
    const chile = geojson.features.find(f => f.properties.ADMIN === 'Chile');
    const patagonianIceField = findFeatureByNameSubstring(['patagonian ice']);
    const cuba = geojson.features.find(f => f.properties.ADMIN === 'Cuba');
    const guantanamo = findFeatureByNameSubstring(['guantanamo', 'guantánamo']);
    const frenchPolynesia = findFeatureByNameSubstring(['french polynesia', 'fr. polynesia']);
    const frenchSouthernLands = findFeatureByNameSubstring(['french southern', 'fr. s. antarctic']);
    const saintBarthelemy = findFeatureByNameSubstring(['barthelemy', 'barthélemy']);
    const saintMartin = findFeatureByNameSubstring(['saint martin', 'st-martin', 'st. martin']);
    const saintPierreMiquelon = findFeatureByNameSubstring(['miquelon']);
    const wallisFutuna = findFeatureByNameSubstring(['wallis']);
    const newZealand = geojson.features.find(f => f.properties.ADMIN === 'New Zealand');
    const cookIslands = findFeatureByNameSubstring(['cook island', 'cook is.']);
    const niue = findFeatureByNameSubstring(['niue']);


    const mergeInto = (disputedFeature, targetFeature, label) => {
        if (!disputedFeature || !targetFeature) return false;
        if (typeof turf === 'undefined') {
            console.warn(`Turf.js not available — could not merge ${label}.`);
            return false;
        }
        try {
            const merged = turf.union(targetFeature, disputedFeature);
            if (merged && merged.geometry) {
                targetFeature.geometry = withoutSliverHoles(merged.geometry);
                return true;
            }
        } catch (err) {
            console.warn(`Failed to merge ${label}:`, err);
        }
        return false;
    };

    const mergedFeatures = [];
    if (mergeInto(halaib, egypt, "Hala'ib Triangle into Egypt")) mergedFeatures.push(halaib);
    if (mergeInto(birTawil, sudan, 'Bir Tawil into Sudan')) mergedFeatures.push(birTawil);
    if (mergeInto(westernSahara, morocco, 'Western Sahara into Morocco')) mergedFeatures.push(westernSahara);
    if (mergeInto(faroeIslands, denmark, 'Faroe Islands into Denmark')) mergedFeatures.push(faroeIslands);
    if (mergeInto(akrotiri, cyprus, 'Akrotiri Sovereign Base Area into Cyprus')) mergedFeatures.push(akrotiri);
    if (mergeInto(dhekelia, cyprus, 'Dhekelia Sovereign Base Area into Cyprus')) mergedFeatures.push(dhekelia);
    if (mergeInto(cyprusNoMansArea, cyprus, 'Cyprus No Mans Area into Cyprus')) mergedFeatures.push(cyprusNoMansArea);
    if (mergeInto(northernCyprus, cyprus, 'Northern Cyprus into Cyprus')) mergedFeatures.push(northernCyprus);
    if (mergeInto(aland, finland, 'Åland into Finland')) mergedFeatures.push(aland);
    if (mergeInto(americanSamoa, unitedStates, 'American Samoa into United States')) mergedFeatures.push(americanSamoa);
    if (mergeInto(guam, unitedStates, 'Guam into United States')) mergedFeatures.push(guam);
    if (mergeInto(northernMarianas, unitedStates, 'Northern Mariana Islands into United States')) mergedFeatures.push(northernMarianas);
    if (mergeInto(usVirginIslands, unitedStates, 'US Virgin Islands into United States')) mergedFeatures.push(usVirginIslands);
    if (mergeInto(usMinorOutlyingIslands, unitedStates, 'US Minor Outlying Islands into United States')) mergedFeatures.push(usMinorOutlyingIslands);
    if (mergeInto(anguilla, unitedKingdom, 'Anguilla into United Kingdom')) mergedFeatures.push(anguilla);
    if (mergeInto(bermuda, unitedKingdom, 'Bermuda into United Kingdom')) mergedFeatures.push(bermuda);
    if (mergeInto(britishIndianOcean, unitedKingdom, 'British Indian Ocean Territory into United Kingdom')) mergedFeatures.push(britishIndianOcean);
    if (mergeInto(britishVirginIslands, unitedKingdom, 'British Virgin Islands into United Kingdom')) mergedFeatures.push(britishVirginIslands);
    if (mergeInto(caymanIslands, unitedKingdom, 'Cayman Islands into United Kingdom')) mergedFeatures.push(caymanIslands);
    if (mergeInto(gibraltar, unitedKingdom, 'Gibraltar into United Kingdom')) mergedFeatures.push(gibraltar);
    if (mergeInto(guernsey, unitedKingdom, 'Guernsey into United Kingdom')) mergedFeatures.push(guernsey);
    if (mergeInto(isleOfMan, unitedKingdom, 'Isle of Man into United Kingdom')) mergedFeatures.push(isleOfMan);
    if (mergeInto(jersey, unitedKingdom, 'Jersey into United Kingdom')) mergedFeatures.push(jersey);
    if (mergeInto(montserrat, unitedKingdom, 'Montserrat into United Kingdom')) mergedFeatures.push(montserrat);
    if (mergeInto(pitcairnIslands, unitedKingdom, 'Pitcairn Islands into United Kingdom')) mergedFeatures.push(pitcairnIslands);
    if (mergeInto(saintHelena, unitedKingdom, 'Saint Helena into United Kingdom')) mergedFeatures.push(saintHelena);
    if (mergeInto(southGeorgia, unitedKingdom, 'South Georgia and the Islands into United Kingdom')) mergedFeatures.push(southGeorgia);
    if (mergeInto(turksCaicos, unitedKingdom, 'Turks and Caicos Islands into United Kingdom')) mergedFeatures.push(turksCaicos);
    if (mergeInto(aruba, netherlands, 'Aruba into Netherlands')) mergedFeatures.push(aruba);
    if (mergeInto(curacao, netherlands, 'Curaçao into Netherlands')) mergedFeatures.push(curacao);
    if (mergeInto(sintMaarten, netherlands, 'Sint Maarten into Netherlands')) mergedFeatures.push(sintMaarten);
    if (mergeInto(ashmoreCartier, australia, 'Ashmore and Cartier Islands into Australia')) mergedFeatures.push(ashmoreCartier);
    if (mergeInto(coralSeaIslands, australia, 'Coral Sea Islands into Australia')) mergedFeatures.push(coralSeaIslands);
    if (mergeInto(heardMcDonald, australia, 'Heard Island and McDonald Islands into Australia')) mergedFeatures.push(heardMcDonald);
    if (mergeInto(indianOceanTerritories, australia, 'Indian Ocean Territories into Australia')) mergedFeatures.push(indianOceanTerritories);
    if (mergeInto(norfolkIsland, australia, 'Norfolk Island into Australia')) mergedFeatures.push(norfolkIsland);
    if (mergeInto(bajoNuevo, colombia, 'Bajo Nuevo Bank into Colombia')) mergedFeatures.push(bajoNuevo);
    if (mergeInto(serranillaBank, colombia, 'Serranilla Bank into Colombia')) mergedFeatures.push(serranillaBank);
    if (mergeInto(brazilianIsland, brazil, 'Brazilian Island into Brazil')) mergedFeatures.push(brazilianIsland);
    if (mergeInto(clipperton, france, 'Clipperton Island into France')) mergedFeatures.push(clipperton);
    if (mergeInto(hongKong, china, 'Hong Kong into China')) mergedFeatures.push(hongKong);
    if (mergeInto(macao, china, 'Macao into China')) mergedFeatures.push(macao);
    if (mergeInto(scarboroughReef, china, 'Scarborough Reef into China')) mergedFeatures.push(scarboroughReef);
    if (mergeInto(siachenGlacier, india, 'Siachen Glacier into India')) mergedFeatures.push(siachenGlacier);
    if (mergeInto(somaliland, somalia, 'Somaliland into Somalia')) mergedFeatures.push(somaliland);
    if (mergeInto(patagonianIceField, chile, 'Southern Patagonian Ice Field into Chile')) mergedFeatures.push(patagonianIceField);
    if (mergeInto(guantanamo, cuba, 'US Naval Base Guantanamo Bay into Cuba')) mergedFeatures.push(guantanamo);
    if (mergeInto(frenchPolynesia, france, 'French Polynesia into France')) mergedFeatures.push(frenchPolynesia);
    if (mergeInto(frenchSouthernLands, france, 'French Southern and Antarctic Lands into France')) mergedFeatures.push(frenchSouthernLands);
    if (mergeInto(saintBarthelemy, france, 'Saint Barthélemy into France')) mergedFeatures.push(saintBarthelemy);
    if (mergeInto(saintMartin, france, 'Saint Martin into France')) mergedFeatures.push(saintMartin);
    if (mergeInto(saintPierreMiquelon, france, 'Saint Pierre and Miquelon into France')) mergedFeatures.push(saintPierreMiquelon);
    if (mergeInto(wallisFutuna, france, 'Wallis and Futuna into France')) mergedFeatures.push(wallisFutuna);
    if (mergeInto(cookIslands, newZealand, 'Cook Islands into New Zealand')) mergedFeatures.push(cookIslands);
    if (mergeInto(niue, newZealand, 'Niue into New Zealand')) mergedFeatures.push(niue);

    if (mergedFeatures.length > 0) {
        geojson.features = geojson.features.filter(f => !mergedFeatures.includes(f));
    }

    // Egypt's outline in the source data has thin slivers along its
    // southern border (not from a merge here), cleaned the same way.
    for (const f of geojson.features) {
        if (SLIVER_CLEANUP.includes(f.properties.ADMIN)) f.geometry = withoutSliverHoles(f.geometry);
    }

    renameCountries(geojson);
    addSmallCountryMarkers(geojson);

    return geojson;

}

/*
    Make the Baikonur Cosmodrome area a part of Kazakhstan.
*/
function assignBaikonurToKazakhstan(geojson) {
    const isBaikonur = properties => {
        const admin = (properties.ADMIN || '').toLowerCase();
        const name = (properties.NAME || '').toLowerCase();
        return (
            admin.includes('aikonur') || admin.includes('aykonur') ||
            name.includes('aikonur') || name.includes('aykonur')
        );
    };

    const baikonurFeature = geojson.features.find(f => isBaikonur(f.properties));

    if (baikonurFeature) {
        const kazakhstan = geojson.features.find(f => f.properties.ADMIN === 'Kazakhstan');

        if (kazakhstan) {
            // A rough centroid (plain average of vertices — good enough for
            // proximity matching, not meant to be geometrically precise) of
            // Baikonur's own shape, used to identify which hole in
            // Kazakhstan's polygon corresponds to it.
            const baikonurRing = baikonurFeature.geometry.type === 'Polygon'
                ? baikonurFeature.geometry.coordinates[0]
                : baikonurFeature.geometry.coordinates[0][0];
            const baikonurCentroid = ringCentroid(baikonurRing);

            // A polygon's coordinates are [outerRing, hole1, hole2, ...].
            // Drop any hole whose centroid sits close to Baikonur's —
            // comfortably wide since Baikonur is a small, isolated lease
            // with nothing else nearby it could be confused with.
            const MATCH_THRESHOLD_DEGREES = 1.5;
            const fillMatchingHoles = polygonCoords =>
                polygonCoords.filter((ring, i) => {
                    if (i === 0) return true; // always keep the outer ring
                    const isBaikonurHole =
                        distanceBetween(ringCentroid(ring), baikonurCentroid) < MATCH_THRESHOLD_DEGREES;
                    return !isBaikonurHole;
                });

            if (kazakhstan.geometry.type === 'Polygon') {
                kazakhstan.geometry.coordinates = fillMatchingHoles(kazakhstan.geometry.coordinates);
            } else if (kazakhstan.geometry.type === 'MultiPolygon') {
                kazakhstan.geometry.coordinates = kazakhstan.geometry.coordinates.map(fillMatchingHoles);
            }
        }

        // Now that the hole is filled, drop Baikonur as its own feature.
        geojson.features = geojson.features.filter(f => f !== baikonurFeature);
    }
}

// Crimea was baked directly into Russia's own MultiPolygon as one of 
// its constituent pieces. So it can't be found by name and merged 
// the way the others were. Instead first it needs to be idientified 
// which pice of Russia's shape is Crimea and weld it onto Ukraine.
//
// Technique (same approach used at
// https://www.andrewheiss.com/blog/2025/02/13/natural-earth-crimea/
// for the equivalent problem in R): a MultiPolygon's coordinates are
// just an array of individual polygons. Rather than guessing an
// index (which isn't stable across dataset versions/resolutions), we
// test each of Russia's constituent polygons against a point known
// to sit in the middle of the Crimean peninsula (34°E, 45°N) and
// take whichever one contains it.
function assignCrimeaToUkraine(geojson) {
    const russia = geojson.features.find(f => f.properties.ADMIN === 'Russia');
    const ukraine = geojson.features.find(f => f.properties.ADMIN === 'Ukraine');

    if (!russia || !ukraine) {
        console.warn('Could not relocate Crimea — Russia or Ukraine feature not found.');
        return;
    }
    if (typeof turf === 'undefined') {
        console.warn('Turf.js not available — could not relocate Crimea.');
        return;
    }
    if (russia.geometry.type !== 'MultiPolygon') {
        console.warn('Expected Russia to be a MultiPolygon — skipping Crimea relocation.');
        return;
    }

    const crimeaPoint = turf.point([34, 45]);
    const russiaPolygons = russia.geometry.coordinates; // array of [ring, ring, ...] — one per constituent polygon

    let crimeaIndex = -1;
    for (let i = 0; i < russiaPolygons.length; i++) {
        try {
            const candidate = turf.polygon(russiaPolygons[i]);
            if (turf.booleanPointInPolygon(crimeaPoint, candidate)) {
                crimeaIndex = i;
                break;
            }
        } catch (err) {
            // A malformed/degenerate ring here shouldn't abort the whole
            // search — just skip it and keep checking the rest.
            continue;
        }
    }

    if (crimeaIndex === -1) {
        console.warn('Could not locate a Crimea-shaped polygon within Russia — no changes made.');
        return;
    }

    const crimeaPolygon = turf.polygon(russiaPolygons[crimeaIndex]);

    // Remove that polygon from Russia's MultiPolygon.
    russia.geometry.coordinates = russiaPolygons.filter((_, i) => i !== crimeaIndex);

    // Weld it onto Ukraine.
    try {
        const merged = turf.union(ukraine, crimeaPolygon);
        if (merged && merged.geometry) {
            ukraine.geometry = withoutSliverHoles(merged.geometry);
        }
    } catch (err) {
        console.warn('Failed to merge Crimea into Ukraine:', err);
    }
}

// French Guiana is baked into France's MultiPolygon (like Crimea in
// Russia's), so it has no feature of its own to select. Split every
// piece of France whose outline sits inside French Guiana's bounding
// box (mainland plus nearby islets such as the Îles du Salut) out
// into a new, separate feature.
function separateFrenchGuiana(geojson) {
    const france = geojson.features.find(f => f.properties.ADMIN === 'France');

    if (!france || france.geometry.type !== 'MultiPolygon') {
        console.warn('Could not separate French Guiana — France not found or not a MultiPolygon.');
        return;
    }

    // Rough bounding box around French Guiana, in degrees. Nothing else
    // belonging to France lies anywhere near it.
    const isInFrenchGuiana = ([lng, lat]) => lng > -55 && lng < -51 && lat > 1.5 && lat < 6.5;

    const guianaPolygons = [];
    const remainingPolygons = [];
    france.geometry.coordinates.forEach(polygon => {
        (isInFrenchGuiana(ringCentroid(polygon[0])) ? guianaPolygons : remainingPolygons).push(polygon);
    });

    if (guianaPolygons.length === 0) {
        console.warn('Could not locate French Guiana within France — no changes made.');
        return;
    }

    france.geometry.coordinates = remainingPolygons;
    geojson.features.push({
        type: 'Feature',
        properties: {
            ADMIN: 'French Guiana',
            NAME: 'French Guiana',
            SOVEREIGNT: france.properties.SOVEREIGNT,
            SOV_A3: france.properties.SOV_A3
        },
        geometry: { type: 'MultiPolygon', coordinates: guianaPolygons }
    });
}

/*
    Drops features from the data entirely, so they are neither drawn
    nor selectable. Matched by name substring, like the merges above.
*/
function removeCountries(geojson) {
    const REMOVED = ['spratly'];

    geojson.features = geojson.features.filter(f => {
        const admin = (f.properties.ADMIN || '').toLowerCase();
        const name = (f.properties.NAME || '').toLowerCase();
        return !REMOVED.some(s => admin.includes(s) || name.includes(s));
    });
}

/*
    Replaces the dataset's spelling of a country name with the one shown
    in the game. Both ADMIN and NAME are updated, since either can be
    used for display.
*/
/*
    Adds a marker point for countries too small to see or click on a
    world map. main.js draws these points as small circles, and they act
    as the country itself: the point copies the country's properties, so
    it shares the country's map id (its ADMIN name) and its colouring.
    Placed at the centre of the country's bounding box.
*/
function addSmallCountryMarkers(geojson) {
    const SMALL_COUNTRIES = ['Vatican'];

    for (const name of SMALL_COUNTRIES) {
        const country = geojson.features.find(f => f.properties.ADMIN === name);
        if (!country) {
            console.warn(`Could not add a marker for ${name} — country not found.`);
            continue;
        }
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        const polygons = country.geometry.type === 'Polygon'
            ? [country.geometry.coordinates]
            : country.geometry.coordinates;
        polygons.forEach(polygon => polygon[0].forEach(([lng, lat]) => {
            minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
            minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
        }));
        geojson.features.push({
            type: 'Feature',
            properties: { ...country.properties },
            geometry: { type: 'Point', coordinates: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] }
        });
    }
}

function renameCountries(geojson) {
    const RENAMES = {
        'eSwatini': 'Eswatini',
        'Czechia': 'Czech Republic',
        'Federated States of Micronesia': 'Micronesia',
        'Republic of Serbia': 'Serbia',
        'Democratic Republic of the Congo': 'DR Congo',
        'Republic of the Congo': 'Congo',
        'United Republic of Tanzania': 'Tanzania'
    };

    geojson.features.forEach(f => {
        if (RENAMES[f.properties.ADMIN]) f.properties.ADMIN = RENAMES[f.properties.ADMIN];
        if (RENAMES[f.properties.NAME]) f.properties.NAME = RENAMES[f.properties.NAME];
    });
}

/*
    Removes thin slivers from a country's shape, which otherwise show as
    stray lines (in the ocean colour, or as border lines):
    - small holes: e.g. gaps left by merging two shapes whose outlines
      don't line up exactly (Bir Tawil into Sudan);
    - small pinched-off loops: the outline leaves a point and comes back
      to the very same point, enclosing almost nothing (e.g. on Egypt's
      Red Sea coast in the source data, a loop about 50 km inland and
      back), so only its border line shows.
    Anything smaller than SLIVER_MAX_KM2 goes. Real holes (e.g. Lesotho
    inside South Africa) are far larger. Only shapes something was merged
    into are cleaned, plus those in SLIVER_CLEANUP - not every country,
    because some real holes are small too (Vatican City inside Italy is
    0.01 km2).
*/
const SLIVER_MAX_KM2 = 50;
const SLIVER_CLEANUP = ['Egypt'];

function withoutSliverHoles(geometry) {
    const areaKm2 = ring => turf.area(turf.polygon([ring])) / 1e6;
    const clean = polygon => [
        withoutPinchedLoops(polygon[0]),
        ...polygon.slice(1)
            .filter(ring => areaKm2(ring) >= SLIVER_MAX_KM2)
            .map(withoutPinchedLoops)
    ];
    if (geometry.type === 'Polygon') {
        return { ...geometry, coordinates: clean(geometry.coordinates) };
    }
    if (geometry.type === 'MultiPolygon') {
        return { ...geometry, coordinates: geometry.coordinates.map(clean) };
    }
    return geometry;

    // Cuts out each part of a ring that leaves a point and returns to the
    // same point, if that loop encloses less than SLIVER_MAX_KM2.
    function withoutPinchedLoops(ring) {
        let changed = true;
        while (changed) {
            changed = false;
            const firstSeen = new Map();
            for (let i = 0; i < ring.length - 1; i++) {  // last point repeats the first
                const key = ring[i][0] + ',' + ring[i][1];
                if (!firstSeen.has(key)) {
                    firstSeen.set(key, i);
                    continue;
                }
                const j = firstSeen.get(key);
                const loop = ring.slice(j, i + 1);
                if (loop.length >= 4 && areaKm2(loop) < SLIVER_MAX_KM2) {
                    ring = [...ring.slice(0, j + 1), ...ring.slice(i + 1)];
                    changed = true;
                    break;
                }
            }
        }
        return ring;
    }
}

function ringCentroid(ring) {
  let sumLng = 0, sumLat = 0;
  ring.forEach(([lng, lat]) => { sumLng += lng; sumLat += lat; });
  return [sumLng / ring.length, sumLat / ring.length];
}

function distanceBetween(a, b) {
  const dLng = a[0] - b[0];
  const dLat = a[1] - b[1];
  return Math.sqrt(dLng * dLng + dLat * dLat);
}
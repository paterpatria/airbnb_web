/**
 * FORMÅL: Håndterer al interaktiv logik på siden.
 * - Initialisering af kort & UI
 * - Valg mellem kilder (Inside Airbnb, Doorstep eller Kombineret)
 * - Avanceret fuzzy matching mod lejerliste baseret på Navn, Rum og Areal
 */

// 1. Initialisering af kortet
const map = L.map('map', { zoomControl: false }).setView([55.6761, 12.5683], 13);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Globale tilstande
let allListings = [];
let nearbyListings = [];
let matchedTenants = [];
let uploadedTenantData = null;
let isMatchMode = false;
let currentSearchCoords = null;
let addressMarker = null;
let radiusCircle = null;
let listingMarkers = L.layerGroup().addTo(map);
let currentResults = [];
let focusedIndex = -1;
let lastMatchCSV = null;
let lastMatchFileName = "";

// UI Elementer
const searchInput = document.getElementById('address-search');
const resultsContainer = document.getElementById('autocomplete-results');
const radiusSlider = document.getElementById('radius-slider');
const radiusValueDisplay = document.getElementById('radius-value');
const statusMessage = document.getElementById('status-message');
const listingList = document.getElementById('listing-list');
const imagePreview = document.getElementById('image-preview');
const previewImg = document.getElementById('preview-img');
const sortSelect = document.getElementById('sort-select');
const lejerlisteUpload = document.getElementById('lejerliste-upload');
const matchBtn = document.getElementById('match-btn');
const matchToggle = document.getElementById('match-toggle');
const toggleContainer = document.getElementById('view-toggle-container');
const downloadMatchesBtn = document.getElementById('download-matches-btn');
const datasetSelect = document.getElementById('dataset-select');

// --- DATA INDLÆSNING ---

function fetchAndParse(fileName) {
    return new Promise((resolve, reject) => {
        Papa.parse(fileName, {
            download: true,
            header: true,
            dynamicTyping: false,
            skipEmptyLines: true,
            complete: results => resolve(results.data),
            error: err => reject(err)
        });
    });
}

async function loadData() {
    const mode = datasetSelect.value;
    statusMessage.textContent = `Indlæser data (${mode})...`;
    
    listingMarkers.clearLayers();
    listingList.innerHTML = '<p style="padding: 20px; color: #666;">Indlæser data...</p>';

    try {
        let rawInside = [];
        let rawDoorstep = [];

        if (mode === 'combined' || mode.includes('insideairbnb')) {
            rawInside = await fetchAndParse('insideairbnb_listings_slim.csv');
        }
        if (mode === 'combined' || mode.includes('doorstepanalytics')) {
            rawDoorstep = await fetchAndParse('doorstepanalytics_listings.csv');
        }

        const mergedMap = new Map();

        // 1. Process Inside Airbnb
        rawInside.forEach(l => {
            const id = (l.id || "").toString().trim();
            const lat = parseFloat(l.latitude);
            const lon = parseFloat(l.longitude);
            if (lat && lon && id) {
                mergedMap.set(id, {
                    id: id,
                    name: l.name || "Airbnb",
                    host_name: l.host_name || "Ukendt",
                    latitude: lat,
                    longitude: lon,
                    room_type: l.room_type || "Bolig",
                    price: l.price || 0,
                    number_of_reviews: parseInt(l.number_of_reviews) || 0,
                    last_review: l.last_review || null,
                    availability_365: l.availability_365 || null,
                    picture_url: l.picture_url || null,
                    bedrooms: parseInt(l.bedrooms) || 0, // Ekstra felt til matching
                    accommodates: parseInt(l.accommodates) || 0, // Ekstra felt til matching
                    source: 'Inside Airbnb'
                });
            }
        });

        // 2. Tilføj unikke fra Doorstep
        rawDoorstep.forEach(l => {
            const id = (l.Airbnb_ListingID || "").toString().trim();
            if (id && !mergedMap.has(id)) {
                const lat = parseFloat(l.Lat);
                const lon = parseFloat(l.Lng);
                if (lat && lon) {
                    mergedMap.set(id, {
                        id: id,
                        name: l.ListingTitle || "Airbnb (Doorstep)",
                        host_name: l.Host_FirstName || "Ukendt",
                        latitude: lat,
                        longitude: lon,
                        room_type: l.RoomType || "Bolig",
                        price: l.BasicNightPrice || 0,
                        number_of_reviews: parseInt(l.ReviewCount) || 0,
                        last_review: null,
                        availability_365: null,
                        picture_url: null,
                        bedrooms: parseInt(l.Bedrooms) || 0,
                        accommodates: parseInt(l.PersonCapacity) || 0,
                        source: 'Doorstep'
                    });
                }
            }
        });

        allListings = Array.from(mergedMap.values());
        statusMessage.textContent = `Klar. ${allListings.length} lejemål indlæst.`;
        if (currentSearchCoords) filterListings();

    } catch (error) {
        console.error("Fejl ved dataindlæsning:", error);
        statusMessage.textContent = "Fejl ved indlæsning af data.";
    }
}

loadData();
datasetSelect.onchange = () => loadData();

// --- HJÆLPEFUNKTIONER ---

function getScoreLabel(score) {
    if (score >= 80) return "Høj sandsynlighed for match";
    if (score >= 50) return "Mellem sandsynlighed for match";
    return "Lav sandsynlighed for match";
}

function getScoreColor(score) {
    if (score >= 80) return '#28a745'; // Grøn
    if (score >= 50) return '#fd7e14'; // Orange
    return '#6c757d'; // Grå
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180, dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2)**2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2)**2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function parsePrice(price) {
    if (typeof price === 'number') return price;
    if (!price) return 0;
    return parseFloat(price.toString().replace(/[^\d.]/g, '')) || 0;
}

// --- AVANCERET MATCHING LOGIK ---

function calculateMatchScore(lejerRow, airbnb) {
    let score = 0;
    const fullLejerName = (lejerRow['Navn'] || '').toLowerCase();
    const hostName = (airbnb.host_name || '').toLowerCase();

    // 1. Navne match (Primær kilde)
    if (hostName && new RegExp(`\\b${hostName}\\b`, 'i').test(fullLejerName)) {
        score += 50;
    } else {
        return 0; // Hvis navnet slet ikke findes, er det ikke et match
    }

    // 2. Værelser vs Rum (Dansk Rum = Bedrooms + 1)
    if (lejerRow['Rum'] && airbnb.bedrooms) {
        const lejerRum = parseInt(lejerRow['Rum']);
        const airbnbRooms = airbnb.bedrooms + 1;
        if (lejerRum === airbnbRooms) score += 30;
        else if (Math.abs(lejerRum - airbnbRooms) <= 1) score += 15;
    }

    // 3. Areal vs Accommodates (Heuristik: 25m2 pr person)
    if (lejerRow['Areal'] && airbnb.accommodates) {
        const areal = parseInt(lejerRow['Areal']);
        const estAccommodates = Math.round(areal / 25);
        if (Math.abs(estAccommodates - airbnb.accommodates) <= 1) score += 20;
        else if (Math.abs(estAccommodates - airbnb.accommodates) <= 2) score += 10;
    }

    return score;
}

function updateDynamicMatches() {
    let maxMatches = 0;
    
    matchedTenants = uploadedTenantData.map(rawRow => {
        const lejerRow = { ...rawRow };
        
        // Find alle Airbnb lejemål i radius og beregn deres match-score
        const matchesWithScores = nearbyListings
            .map(airbnb => ({
                ...airbnb,
                score: calculateMatchScore(lejerRow, airbnb)
            }))
            .filter(m => m.score > 0)
            .sort((a, b) => b.score - a.score);

        lejerRow.matches = matchesWithScores;
        if (matchesWithScores.length > maxMatches) maxMatches = matchesWithScores.length;
        
        // Tilføj links og vurdering til rækken (sidst)
        matchesWithScores.forEach((m, i) => {
            const label = getScoreLabel(m.score);
            lejerRow[`airbnb_link_${i+1}`] = `https://www.airbnb.com/rooms/${m.id}`;
            lejerRow[`match_score_${i+1}`] = `${label} (${m.score}%)`;
        });
        return lejerRow;
    });

    // Opbyg kolonne-rækkefølge: Originale kolonner først, derefter Match-kolonner
    const originalFields = uploadedTenantData.length > 0 ? Object.keys(uploadedTenantData[0]) : [];
    const matchFields = [];
    for (let i = 1; i <= maxMatches; i++) {
        matchFields.push(`airbnb_link_${i}`);
        matchFields.push(`match_score_${i}`);
    }
    
    const finalFields = [...originalFields, ...matchFields];

    lastMatchCSV = Papa.unparse({ 
        fields: finalFields, 
        data: matchedTenants 
    }, { delimiter: ';' });
}

// --- UI RENDERING ---

function renderMatchedView() {
    const tenantsToShow = matchedTenants.filter(t => t.matches && t.matches.length > 0);
    statusMessage.textContent = `Viser ${tenantsToShow.length} lejere med mulige matches.`;

    if (tenantsToShow.length === 0) {
        listingList.innerHTML = '<p style="padding:20px;">Ingen matches fundet i det valgte område.</p>';
        return;
    }

    tenantsToShow.forEach(tenant => {
        const bestScore = tenant.matches[0].score;
        const scoreColor = getScoreColor(bestScore);
        const scoreLabel = getScoreLabel(bestScore);
        
        const item = document.createElement('div');
        item.className = 'listing-item matched-item';
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div class="lejernr">${tenant['Lejernr.'] || 'Nr'} - ${tenant['Adresse'] || ''}</div>
                <div style="background:${scoreColor}; color:white; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">${scoreLabel}</div>
            </div>
            <h3>${tenant['Navn']}</h3>
            <p style="color: #666;">Areal: ${tenant['Areal'] || '0'} m² • Rum: ${tenant['Rum'] || '?'}</p>
            <p style="font-weight: bold; color: #c0392b;">${tenant.matches.length} mulige Airbnb matches</p>
        `;
        
        item.onclick = () => {
            document.querySelectorAll('.matched-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            listingMarkers.clearLayers();
            tenant.matches.forEach((m, idx) => {
                const marker = createMarker(m, getScoreColor(m.score), m.score);
                listingMarkers.addLayer(marker);
                if (idx === 0) { map.setView([m.latitude, m.longitude], 17); marker.openPopup(); }
            });
        };
        listingList.appendChild(item);
        tenant.matches.forEach(m => { listingMarkers.addLayer(createMarker(m, getScoreColor(m.score), m.score)); });
    });
}

// --- STANDARD FUNKTIONALITET (FILTER, SEARCH, ETC) ---

function filterListings() {
    if (!currentSearchCoords || allListings.length === 0) return;
    const [targetLat, targetLon] = currentSearchCoords;
    const radiusInMeters = parseInt(radiusSlider.value);
    if (radiusCircle) radiusCircle.setRadius(radiusInMeters);

    listingMarkers.clearLayers();
    listingList.innerHTML = '';

    nearbyListings = allListings.filter(listing => {
        const dist = calculateDistance(targetLat, targetLon, listing.latitude, listing.longitude);
        return dist <= radiusInMeters;
    });

    if (uploadedTenantData) updateDynamicMatches();
    if (isMatchMode) renderMatchedView(); else renderStandardView();
}

function renderStandardView() {
    const sortBy = sortSelect.value;
    nearbyListings.sort((a, b) => {
        if (sortBy === 'last_review') return (b.last_review ? new Date(b.last_review) : 0) - (a.last_review ? new Date(a.last_review) : 0);
        if (sortBy === 'price_asc') return parsePrice(a.price) - parsePrice(b.price);
        if (sortBy === 'number_of_reviews') return (b.number_of_reviews || 0) - (a.number_of_reviews || 0);
        if (sortBy === 'host_name') return (a.host_name || '').localeCompare(b.host_name || '');
        return (b.availability_365 || 0) - (a.availability_365 || 0);
    });

    statusMessage.textContent = `Fundet ${nearbyListings.length} lejemål inden for radius.`;
    nearbyListings.forEach(listing => {
        const marker = createMarker(listing);
        listingMarkers.addLayer(marker);
        const item = document.createElement('div');
        item.className = 'listing-item';
        item.innerHTML = `<h3>${listing.name || 'Airbnb'}</h3><p style="font-weight: bold; color: #555;">Vært: ${listing.host_name || 'Ukendt'}</p><p>${listing.room_type} • ${listing.number_of_reviews} anm.</p><span class="price">${listing.price || '0'} DKK / nat</span>`;
        item.onclick = () => { map.setView([listing.latitude, listing.longitude], 18); marker.openPopup(); };
        item.onmouseenter = () => showPreview(listing.picture_url);
        item.onmouseleave = () => hidePreview();
        listingList.appendChild(item);
    });
}

function createMarker(listing, color = 'blue', score = null) {
    const marker = L.circleMarker([listing.latitude, listing.longitude], { color: color, fillColor: color, fillOpacity: 0.5, radius: 8 });
    const imageHTML = listing.picture_url ? `<img src="${listing.picture_url}" class="popup-img">` : '';
    
    let scoreHTML = "";
    if (score !== null) {
        const label = getScoreLabel(score);
        const scoreColor = getScoreColor(score);
        scoreHTML = `<div style="margin-top:5px; padding:3px 8px; background:${scoreColor}; color:white; border-radius:4px; display:inline-block; font-size:11px; font-weight:bold;">${label} (${score}%)</div><br>`;
    }

    marker.bindPopup(`
        <div class="info-popup">
            ${imageHTML}
            ${scoreHTML}
            <b>${listing.name || 'Airbnb'}</b><br>
            Vært: ${listing.host_name}<br>
            Pris: ${listing.price} DKK<br>
            <a href="https://www.airbnb.com/rooms/${listing.id}" target="_blank">Se på Airbnb.dk</a>
        </div>
    `);
    return marker;
}

// --- EVENTS ---

matchBtn.onclick = () => lejerlisteUpload.click();
lejerlisteUpload.onchange = (e) => {
    const file = e.target.files[0];
    if (!file || nearbyListings.length === 0) return alert("Søg på en adresse først.");
    Papa.parse(file, {
        header: true, skipEmptyLines: true, delimiter: ";",
        complete: results => {
            uploadedTenantData = results.data;
            lastMatchFileName = file.name.replace(/\.csv$/i, '') + "_airbnb_matches.csv";
            toggleContainer.style.display = 'block';
            isMatchMode = true;
            matchToggle.checked = true;
            filterListings();
        }
    });
    lejerlisteUpload.value = '';
};

downloadMatchesBtn.onclick = () => {
    if (!lastMatchCSV) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff" + lastMatchCSV], { type: 'text/csv;charset=utf-8;' }));
    link.download = lastMatchFileName;
    link.click();
};

document.getElementById('download-btn').onclick = () => {
    if (nearbyListings.length === 0) return;
    const exportData = nearbyListings.map(l => {
        const row = { airbnb_link: `https://www.airbnb.com/rooms/${l.id}` };
        Object.assign(row, l);
        row.id = l.id.toString(); 
        return row;
    });
    const csv = Papa.unparse(exportData, { delimiter: ';' });
    const sanitizedAddress = searchInput.value.replace(/[/\\?%*:|"<>\s]/g, '_').substring(0, 50);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `airbnb_resultater_${sanitizedAddress}.csv`;
    link.click();
};

radiusSlider.oninput = (e) => { radiusValueDisplay.textContent = e.target.value; if (currentSearchCoords) filterListings(); };
sortSelect.onchange = () => { if (currentSearchCoords) filterListings(); };
matchToggle.onchange = (e) => { isMatchMode = e.target.checked; filterListings(); };

function showPreview(url) { if (!url) { hidePreview(); return; } previewImg.src = url; imagePreview.style.display = 'block'; }
function hidePreview() { imagePreview.style.display = 'none'; previewImg.src = ''; }

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const handleSearch = async (e) => {
    const query = e.target.value;
    if (query.length < 3) { resultsContainer.style.display = 'none'; return; }
    try {
        const response = await fetch(`https://api.dataforsyningen.dk/adgangsadresser/autocomplete?q=${encodeURIComponent(query)}`);
        currentResults = await response.json();
        displayAutocompleteResults(currentResults);
    } catch (error) { console.error("API Fejl:", error); }
};

searchInput.addEventListener('input', debounce(handleSearch, 300));
searchInput.addEventListener('keydown', (e) => {
    const items = resultsContainer.getElementsByClassName('autocomplete-item');
    if (items.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); focusedIndex = (focusedIndex + 1) % items.length; updateFocus(items); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusedIndex = (focusedIndex - 1 + items.length) % items.length; updateFocus(items); }
    else if (e.key === 'Enter') { e.preventDefault(); if (focusedIndex > -1) selectAddress(currentResults[focusedIndex]); }
});

function updateFocus(items) {
    for (let i = 0; i < items.length; i++) items[i].classList.remove('active');
    if (focusedIndex > -1) {
        items[focusedIndex].classList.add('active');
        items[focusedIndex].scrollIntoView({ block: 'nearest' });
    }
}

function displayAutocompleteResults(data) {
    resultsContainer.innerHTML = ''; focusedIndex = -1;
    if (data.length === 0) { resultsContainer.style.display = 'none'; return; }
    data.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.textContent = item.tekst;
        div.onclick = () => selectAddress(item);
        resultsContainer.appendChild(div);
    });
    resultsContainer.style.display = 'block';
}

async function selectAddress(item) {
    searchInput.value = item.tekst;
    resultsContainer.style.display = 'none';
    const response = await fetch(item.adgangsadresse.href);
    const data = await response.json();
    const [lon, lat] = data.adgangspunkt.koordinater;
    currentSearchCoords = [lat, lon];
    processNewLocation(lat, lon);
}

function processNewLocation(lat, lon) {
    if (addressMarker) map.removeLayer(addressMarker);
    if (radiusCircle) map.removeLayer(radiusCircle);

    addressMarker = L.marker([lat, lon]).addTo(map);
    radiusCircle = L.circle([lat, lon], {
        radius: parseInt(radiusSlider.value),
        color: '#2c3e50',
        fillColor: '#2c3e50',
        fillOpacity: 0.1
    }).addTo(map);

    // Zoomer automatisk så hele radius er synlig. 
    // Vi bruger mere padding (50px) og maxZoom 16 for at sikre overblik.
    map.fitBounds(radiusCircle.getBounds(), { padding: [50, 50], maxZoom: 16 });
    filterListings();
}

window.onclick = (e) => { if (!e.target.matches('#address-search')) resultsContainer.style.display = 'none'; };

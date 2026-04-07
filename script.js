/**
 * FORMÅL: Håndterer al interaktiv logik på siden.
 * - Initialisering af kort & UI
 * - Indlæsning af optimeret Airbnb-data (slim CSV)
 * - Dynamisk matching mod lejerliste
 * - Visning af billede-preview og sortering
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

// --- DATA INDLÆSNING ---

function loadData() {
    statusMessage.textContent = "Indlæser Airbnb-data...";
    Papa.parse('insideairbnb_listings_slim.csv', {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(results) {
            allListings = results.data
                .filter(l => l.latitude && l.longitude)
                .map(l => ({
                    ...l,
                    latitude: parseFloat(l.latitude),
                    longitude: parseFloat(l.longitude)
                }));
            
            statusMessage.textContent = "Indtast en adresse for at starte";
            console.log(`Indlæst ${allListings.length} Airbnb lejemål fra slim-fil.`);
        },
        error: (err) => {
            console.error("CSV Fejl:", err);
            statusMessage.textContent = "Fejl: Kunne ikke hente insideairbnb_listings_slim.csv";
            statusMessage.style.color = "red";
        }
    });
}

loadData();

// --- HJÆLPEFUNKTIONER ---

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function parsePrice(price) {
    if (typeof price === 'number') return price;
    if (!price) return 0;
    return parseFloat(price.toString().replace(/[^\d.]/g, '')) || 0;
}

function showPreview(url) {
    if (!url) return;
    previewImg.src = url;
    imagePreview.style.display = 'block';
}

function hidePreview() {
    imagePreview.style.display = 'none';
    previewImg.src = '';
}

function updateFocus(items) {
    for (let i = 0; i < items.length; i++) items[i].classList.remove('active');
    if (focusedIndex > -1) {
        items[focusedIndex].classList.add('active');
        items[focusedIndex].scrollIntoView({ block: 'nearest' });
    }
}

// --- EVENT LISTENERS ---

radiusSlider.addEventListener('input', (e) => {
    radiusValueDisplay.textContent = e.target.value;
    if (currentSearchCoords) filterListings();
});

sortSelect.addEventListener('change', () => {
    if (currentSearchCoords) filterListings();
});

matchToggle.addEventListener('change', (e) => {
    isMatchMode = e.target.checked;
    filterListings();
});

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

function displayAutocompleteResults(data) {
    resultsContainer.innerHTML = '';
    focusedIndex = -1;
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
    try {
        const response = await fetch(item.adgangsadresse.href);
        const data = await response.json();
        const [lon, lat] = data.adgangspunkt.koordinater;
        currentSearchCoords = [lat, lon];
        processNewLocation(lat, lon);
    } catch (e) { console.error("Fejl ved hentning af adresse-detaljer:", e); }
}

function processNewLocation(lat, lon) {
    map.setView([lat, lon], 16);
    if (addressMarker) map.removeLayer(addressMarker);
    if (radiusCircle) map.removeLayer(radiusCircle);
    addressMarker = L.circleMarker([lat, lon], { color: 'red', fillColor: '#f03', fillOpacity: 0.6, radius: 12, zIndexOffset: 1000 }).addTo(map);
    radiusCircle = L.circle([lat, lon], { color: '#007bff', fillColor: '#007bff', fillOpacity: 0.1, weight: 2, radius: parseInt(radiusSlider.value) }).addTo(map);
    filterListings();
}

// --- FILTRERING OG VISNING ---

function filterListings() {
    if (!currentSearchCoords) return;
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

function updateDynamicMatches() {
    matchedTenants = uploadedTenantData.map(rawRow => {
        const lejerRow = { ...rawRow };
        const fullLejerName = (lejerRow['Navn'] || '').toLowerCase();
        const matches = nearbyListings.filter(airbnb => {
            const host = (airbnb.host_name || '').toLowerCase();
            return host && new RegExp(`\\b${host}\\b`, 'i').test(fullLejerName);
        });
        lejerRow.matches = matches;
        matches.forEach((m, i) => lejerRow[`airbnb_listing_${i+1}`] = `https://www.airbnb.com/rooms/${m.id}`);
        return lejerRow;
    });

    const allKeys = new Set();
    matchedTenants.forEach(row => { Object.keys(row).forEach(k => { if (k !== 'matches') allKeys.add(k); }); });
    lastMatchCSV = Papa.unparse({ fields: Array.from(allKeys), data: matchedTenants }, { delimiter: ';' });
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
        item.innerHTML = `<h3>${listing.name || 'Airbnb'}</h3><p style="font-weight: bold; color: #555;">Vært: ${listing.host_name || 'Ukendt'}</p><p>${listing.room_type} • ${listing.last_review || 'Ingen'}</p><span class="price">${listing.price || 'Ingen pris'}</span>`;
        item.onclick = () => { map.setView([listing.latitude, listing.longitude], 18); marker.openPopup(); };
        item.onmouseenter = () => showPreview(listing.picture_url);
        item.onmouseleave = () => hidePreview();
        listingList.appendChild(item);
    });
}

function renderMatchedView() {
    const tenantsWithMatches = matchedTenants.filter(t => t.matches && t.matches.length > 0);
    statusMessage.textContent = `Viser ${tenantsWithMatches.length} lejere med Airbnb-matches i området.`;

    if (tenantsWithMatches.length === 0) {
        listingList.innerHTML = '<p style="padding:20px;">Ingen matches fundet i det valgte område.</p>';
        return;
    }

    tenantsWithMatches.forEach(tenant => {
        const item = document.createElement('div');
        item.className = 'listing-item matched-item';
        item.innerHTML = `<div class="lejernr">${tenant['Lejernr.'] || 'Nr'} - ${tenant['Adresse'] || ''}</div><h3>${tenant['Navn']}</h3><p style="color: #666;">Areal: ${tenant['Areal'] || '0'} m² • Rum: ${tenant['Rum'] || '?'}</p><p style="font-weight: bold; color: #c0392b;">${tenant.matches.length} match(es) fundet</p>`;
        
        item.onclick = () => {
            document.querySelectorAll('.matched-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            listingMarkers.clearLayers();
            tenant.matches.forEach((m, idx) => {
                const marker = createMarker(m, '#e74c3c');
                listingMarkers.addLayer(marker);
                if (idx === 0) { map.setView([m.latitude, m.longitude], 17); marker.openPopup(); }
            });
        };
        listingList.appendChild(item);
        tenant.matches.forEach(m => { listingMarkers.addLayer(createMarker(m, '#e74c3c')); });
    });
}

function createMarker(listing, color = 'blue') {
    const marker = L.circleMarker([listing.latitude, listing.longitude], { color: color, fillColor: color, fillOpacity: 0.5, radius: 8 });
    const imageHTML = listing.picture_url ? `<img src="${listing.picture_url}" class="popup-img">` : '';
    marker.bindPopup(`<div class="info-popup">${imageHTML}<b>${listing.name || 'Airbnb'}</b><br>Vært: ${listing.host_name}<br>Pris: ${listing.price}<br><a href="https://www.airbnb.com/rooms/${listing.id}" target="_blank">Se på Airbnb.dk</a></div>`);
    return marker;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180, dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2)**2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2)**2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// --- MATCH & EXPORT ---

matchBtn.onclick = () => lejerlisteUpload.click();
lejerlisteUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || nearbyListings.length === 0) return alert("Søg på en adresse og find lejemål først.");
    Papa.parse(file, {
        header: true, skipEmptyLines: true, delimiter: ";",
        complete: function(results) { processLejerlisteMatch(results.data, file.name); }
    });
    lejerlisteUpload.value = '';
});

function processLejerlisteMatch(lejerData, originalFileName) {
    uploadedTenantData = lejerData;
    lastMatchFileName = originalFileName.replace(/\.csv$/i, '') + "_airbnb_matches.csv";
    toggleContainer.style.display = 'block';
    isMatchMode = true;
    matchToggle.checked = true;
    filterListings();
    alert(`Lejerliste indlæst! Siden opdateres nu automatisk når du ændrer radius.`);
}

downloadMatchesBtn.onclick = () => {
    if (!lastMatchCSV) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff" + lastMatchCSV], { type: 'text/csv;charset=utf-8;' }));
    link.download = lastMatchFileName;
    link.click();
};

document.getElementById('download-btn').onclick = () => {
    const csv = Papa.unparse(nearbyListings.map(l => ({ airbnb_link: `https://www.airbnb.com/rooms/${l.id}`, ...l })), { delimiter: ';' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = "airbnb_resultater.csv";
    link.click();
};

window.onclick = (e) => { if (!e.target.matches('#address-search')) resultsContainer.style.display = 'none'; };

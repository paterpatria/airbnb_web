/**
 * FORMÅL: Håndterer al interaktiv logik på siden.
 * - Initialisering af kort
 * - Hentning af adresser fra API
 * - Indlæsning, sortering og filtrering af CSV-data
 * - Visning af billede-preview
 */

// 1. Initialisering af kortet
const map = L.map('map', {
    zoomControl: false // Deaktiver standard zoom knapper
}).setView([55.6761, 12.5683], 13);

// Tilføj zoom knapper nederst til højre i stedet
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> bidragydere'
}).addTo(map);

// Globale tilstande
let addressMarker = null;
let radiusCircle = null;
let listingMarkers = L.layerGroup().addTo(map);
let nearbyListings = [];
let allListings = [];
let currentSearchCoords = null;
let markersById = new Map();
let focusedIndex = -1;
let currentResults = [];

// UI Elementer
const searchInput = document.getElementById('address-search');
const resultsContainer = document.getElementById('autocomplete-results');
const radiusSlider = document.getElementById('radius-slider');
const radiusValueDisplay = document.getElementById('radius-value');
const statusMessage = document.getElementById('status-message');
const listingList = document.getElementById('listing-list');
const imagePreview = document.getElementById('image-preview');
const previewImg = document.getElementById('preview-img');

// 1.1 Håndtering af billede-preview ved hover
function showPreview(url) {
    if (!url) return;
    previewImg.src = url;
    imagePreview.style.display = 'block';
}

function hidePreview() {
    imagePreview.style.display = 'none';
    previewImg.src = '';
}

// Event listener for radius-slider
radiusSlider.addEventListener('input', (e) => {
    const newRadius = e.target.value;
    radiusValueDisplay.textContent = newRadius;
    if (currentSearchCoords) {
        filterListings(currentSearchCoords[0], currentSearchCoords[1]);
    }
});

// 2. Hent Airbnb-data når siden loader
Papa.parse('listings.csv', {
    download: true,
    header: true,
    dynamicTyping: true,
    complete: function(results) {
        allListings = results.data.filter(l => l.latitude && l.longitude);
        console.log(`Indlæst ${allListings.length} Airbnb lejemål.`);
    },
    error: function(err) {
        console.error("Fejl ved indlæsning af CSV:", err);
    }
});

// 3. Adressesøgning og Autocomplete
searchInput.addEventListener('input', async (e) => {
    const query = e.target.value;
    if (query.length < 3) {
        resultsContainer.style.display = 'none';
        focusedIndex = -1;
        return;
    }
    try {
        const response = await fetch(`https://api.dataforsyningen.dk/adgangsadresser/autocomplete?q=${encodeURIComponent(query)}`);
        currentResults = await response.json();
        displayAutocompleteResults(currentResults);
    } catch (error) {
        console.error("API Fejl:", error);
    }
});

searchInput.addEventListener('keydown', (e) => {
    const items = resultsContainer.getElementsByClassName('autocomplete-item');
    if (items.length === 0) return;
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusedIndex = (focusedIndex + 1) % items.length;
        updateFocus(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedIndex = (focusedIndex - 1 + items.length) % items.length;
        updateFocus(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedIndex > -1) selectAddress(currentResults[focusedIndex]);
    }
});

function updateFocus(items) {
    for (let i = 0; i < items.length; i++) items[i].classList.remove('active');
    if (focusedIndex > -1) {
        items[focusedIndex].classList.add('active');
        items[focusedIndex].scrollIntoView({ block: 'nearest' });
    }
}

function displayAutocompleteResults(data) {
    resultsContainer.innerHTML = '';
    focusedIndex = -1;
    if (data.length === 0) {
        resultsContainer.style.display = 'none';
        return;
    }
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
    if (!item) return;
    searchInput.value = item.tekst;
    resultsContainer.style.display = 'none';
    try {
        const response = await fetch(item.adgangsadresse.href);
        const addressData = await response.json();
        const [lon, lat] = addressData.adgangspunkt.koordinater;
        currentSearchCoords = [lat, lon];
        processNewLocation(lat, lon);
    } catch (error) {
        console.error("Fejl ved hentning af koordinater:", error);
    }
}

// 4. Kortopdatering og Filtrering
function processNewLocation(lat, lon) {
    map.setView([lat, lon], 16);
    if (addressMarker) map.removeLayer(addressMarker);
    if (radiusCircle) map.removeLayer(radiusCircle);
    
    addressMarker = L.circleMarker([lat, lon], {
        color: 'red', fillColor: '#f03', fillOpacity: 0.6, radius: 12, zIndexOffset: 1000
    }).addTo(map).bindPopup(`<b>Valgt adresse:</b><br>${searchInput.value}`).openPopup();

    radiusCircle = L.circle([lat, lon], {
        color: '#007bff', fillColor: '#007bff', fillOpacity: 0.1, weight: 2, radius: parseInt(radiusSlider.value)
    }).addTo(map);

    filterListings(lat, lon);
}

function filterListings(targetLat, targetLon) {
    const radiusInMeters = parseInt(radiusSlider.value);
    if (radiusCircle) radiusCircle.setRadius(radiusInMeters);

    listingMarkers.clearLayers();
    listingList.innerHTML = '';
    markersById.clear();

    nearbyListings = allListings.filter(listing => {
        const dist = calculateDistance(targetLat, targetLon, listing.latitude, listing.longitude);
        return dist <= radiusInMeters;
    });

    nearbyListings.sort((a, b) => {
        const dateA = a.last_review ? new Date(a.last_review) : new Date(0);
        const dateB = b.last_review ? new Date(b.last_review) : new Date(0);
        if (dateB.getTime() !== dateA.getTime()) return dateB - dateA;
        return (b.availability_365 || 0) - (a.availability_365 || 0);
    });

    if (nearbyListings.length === 0) {
        statusMessage.textContent = `Ingen lejemål fundet inden for ${radiusInMeters}m.`;
        statusMessage.style.color = '#dc3545';
        listingList.innerHTML = '<p style="padding: 20px; color: #666;">Ingen resultater.</p>';
    } else {
        statusMessage.textContent = `Fundet ${nearbyListings.length} lejemål inden for ${radiusInMeters}m.`;
        statusMessage.style.color = '#28a745';
    }

    nearbyListings.forEach(listing => {
        const marker = L.circleMarker([listing.latitude, listing.longitude], {
            color: 'blue', fillColor: '#30f', fillOpacity: 0.5, radius: 7
        });
        // Lav HTML til popup med billede og vært
        const imageHTML = listing.picture_url ? `<img src="${listing.picture_url}" class="popup-img">` : '';
        const popupHTML = `
            <div class="info-popup">
                ${imageHTML}
                <b>${listing.name || 'Airbnb'}</b><br>
                Vært: ${listing.host_name || 'Ukendt'}<br>
                Pris: ${listing.price} DKK<br>
                Sidste anm: ${listing.last_review || 'Ingen'}<br>
                <a href="https://www.airbnb.com/rooms/${listing.id}" target="_blank">Se på Airbnb.dk</a>
            </div>`;
        marker.bindPopup(popupHTML);
        listingMarkers.addLayer(marker);
        markersById.set(listing.id, marker);

        // 2. Opret element i sidepanelet
        const item = document.createElement('div');
        item.className = 'listing-item';
        const reviewText = listing.last_review ? `Sidste anm: ${listing.last_review}` : 'Ingen anmeldelser';
        item.innerHTML = `
            <h3>${listing.name || 'Airbnb'}</h3>
            <p style="font-weight: bold; color: #555; margin-bottom: 5px;">Vært: ${listing.host_name || 'Ukendt'}</p>
            <p>${listing.room_type} • ${reviewText}</p>
            <span class="price">${listing.price} DKK / nat</span>
        `;

        item.onclick = () => zoomToListing(listing.id);
        item.onmouseenter = () => showPreview(listing.picture_url);
        item.onmouseleave = () => hidePreview();
        listingList.appendChild(item);
    });

    document.getElementById('download-btn').style.display = nearbyListings.length > 0 ? 'block' : 'none';
}

function zoomToListing(id) {
    const marker = markersById.get(id);
    if (marker) {
        map.setView(marker.getLatLng(), 18);
        marker.openPopup();
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

document.getElementById('download-btn').onclick = () => {
    if (nearbyListings.length === 0) return;
    const dataWithLinks = nearbyListings.map(listing => {
        const sortedListing = { airbnb_link: `https://www.airbnb.com/rooms/${listing.id}` };
        return Object.assign(sortedListing, listing);
    });
    const csv = Papa.unparse(dataWithLinks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const addressPrefix = searchInput.value.replace(/[/\\?%*:|"<>\s]/g, '_').substring(0, 50);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${addressPrefix}_airbnb_resultater.csv`;
    link.click();
};

window.onclick = (e) => {
    if (!e.target.matches('#address-search')) resultsContainer.style.display = 'none';
};

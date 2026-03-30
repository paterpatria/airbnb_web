/**
 * FORMÅL: Håndterer al interaktiv logik på siden.
 * - Initialisering af kort
 * - Hentning af adresser fra API
 * - Indlæsning og filtrering af CSV-data
 * - Afstandsberegninger
 */

// 1. Initialisering af kortet
const map = L.map('map').setView([55.6761, 12.5683], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> bidragydere'
}).addTo(map);

// Globale tilstande
let addressMarker = null;
let listingMarkers = L.layerGroup().addTo(map);
let nearbyListings = [];
let allListings = [];
let currentSearchCoords = null; // Gemmer [lat, lon] for den aktuelle søgning
let markersById = new Map(); // Gemmer markører for hurtig adgang via ID
let focusedIndex = -1; // Til tastaturnavigation i søgeforslag
let currentResults = []; // Gemmer aktuelle API resultater

// UI Elementer
const searchInput = document.getElementById('address-search');
const resultsContainer = document.getElementById('autocomplete-results');
const radiusSlider = document.getElementById('radius-slider');
const radiusValueDisplay = document.getElementById('radius-value');
const statusMessage = document.getElementById('status-message');
const listingList = document.getElementById('listing-list');

// Event listener for radius-slider
radiusSlider.addEventListener('input', (e) => {
    const newRadius = e.target.value;
    radiusValueDisplay.textContent = newRadius;
    
    if (currentSearchCoords) {
        filterListings(currentSearchCoords[0], currentSearchCoords[1]);
    }
});

// 2. Hent Airbnb-data når siden loader
console.log("Henter listings.csv...");
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
        alert("Fejl: Kunne ikke indlæse listings.csv. Husk at køre en lokal server.");
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
        // Skiftet til adgangsadresser for at undgå etage/dør detaljer
        const response = await fetch(`https://api.dataforsyningen.dk/adgangsadresser/autocomplete?q=${encodeURIComponent(query)}`);
        currentResults = await response.json();
        displayAutocompleteResults(currentResults);
    } catch (error) {
        console.error("API Fejl:", error);
    }
});

// Håndtering af piletaster og Enter
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
        if (focusedIndex > -1) {
            selectAddress(currentResults[focusedIndex]);
        }
    }
});

function updateFocus(items) {
    for (let i = 0; i < items.length; i++) {
        items[i].classList.remove('active');
    }
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

    data.forEach((item, index) => {
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
    focusedIndex = -1;

    try {
        // Henter detaljer for adgangsadressen
        const response = await fetch(item.adgangsadresse.href);
        const addressData = await response.json();
        
        // Adgangsadresser API har koordinater direkte i adgangspunkt
        const [lon, lat] = addressData.adgangspunkt.koordinater;
        
        currentSearchCoords = [lat, lon];
        processNewLocation(lat, lon);
    } catch (error) {
        console.error("Fejl ved hentning af koordinater:", error);
    }
}

// 4. Kortopdatering og Filtrering
function processNewLocation(lat, lon) {
    // Zoom og rød prik
    map.setView([lat, lon], 16);
    if (addressMarker) map.removeLayer(addressMarker);
    
    addressMarker = L.circleMarker([lat, lon], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.6,
        radius: 12
    }).addTo(map).bindPopup(`<b>Valgt adresse:</b><br>${searchInput.value}`).openPopup();

    // Find og vis nærliggende Airbnb'er
    filterListings(lat, lon);
}

function filterListings(targetLat, targetLon) {
    const radiusInMeters = parseInt(radiusSlider.value);
    listingMarkers.clearLayers();
    listingList.innerHTML = ''; // Ryd listen i sidepanelet
    markersById.clear();

    nearbyListings = allListings.filter(listing => {
        const dist = calculateDistance(targetLat, targetLon, listing.latitude, listing.longitude);
        return dist <= radiusInMeters;
    });

    // Opdater statusbesked
    if (nearbyListings.length === 0) {
        statusMessage.textContent = `Ingen lejemål fundet inden for ${radiusInMeters}m.`;
        statusMessage.style.color = '#dc3545';
        listingList.innerHTML = '<p style="padding: 20px; color: #666;">Ingen resultater i dette område.</p>';
    } else {
        statusMessage.textContent = `Fundet ${nearbyListings.length} lejemål inden for ${radiusInMeters}m.`;
        statusMessage.style.color = '#28a745';
    }

    nearbyListings.forEach(listing => {
        // 1. Opret markør på kortet
        const marker = L.circleMarker([listing.latitude, listing.longitude], {
            color: 'blue',
            fillColor: '#30f',
            fillOpacity: 0.5,
            radius: 7
        });

        const popupHTML = `
            <div class="info-popup">
                <b>${listing.name || 'Airbnb'}</b><br>
                Pris: ${listing.price} DKK<br>
                Type: ${listing.room_type}<br>
                <a href="https://www.airbnb.com/rooms/${listing.id}" target="_blank">Se på Airbnb.dk</a>
            </div>
        `;
        marker.bindPopup(popupHTML);
        listingMarkers.addLayer(marker);
        
        // Gem markør i vores Map så vi kan finde den via ID
        markersById.set(listing.id, marker);

        // 2. Opret element i sidepanelet
        const item = document.createElement('div');
        item.className = 'listing-item';
        item.innerHTML = `
            <h3>${listing.name || 'Airbnb lejemål'}</h3>
            <p>${listing.room_type} • ${listing.neighbourhood || ''}</p>
            <span class="price">${listing.price} DKK / nat</span>
        `;
        item.onclick = () => zoomToListing(listing.id);
        listingList.appendChild(item);
    });

    // Vis download-knap
    document.getElementById('download-btn').style.display = nearbyListings.length > 0 ? 'block' : 'none';
}

function zoomToListing(id) {
    const marker = markersById.get(id);
    if (marker) {
        map.setView(marker.getLatLng(), 18);
        marker.openPopup();
    }
}

// Haversine formel til afstandsberegning
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Jordens radius
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(dp/2) * Math.sin(dp/2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// 5. Download funktion
document.getElementById('download-btn').onclick = () => {
    if (nearbyListings.length === 0) return;

    // Tilføj en ekstra kolonne med direkte link til Airbnb før eksport
    const dataWithLinks = nearbyListings.map(listing => ({
        ...listing,
        airbnb_link: `https://www.airbnb.com/rooms/${listing.id}`
    }));

    const csv = Papa.unparse(dataWithLinks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "airbnb_lokale_resultater.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Luk menu hvis man klikker væk
window.onclick = (e) => {
    if (!e.target.matches('#address-search')) {
        resultsContainer.style.display = 'none';
    }
};

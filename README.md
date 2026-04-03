# Airbnb Adresse-søger & Lejer-matcher 🏠📍

En interaktiv webapplikation designet til at analysere og matche lokale Airbnb-data i Danmark. Værktøjet er skabt til at hjælpe med at identificere Airbnb-lejemål inden for en bestemt radius af en adresse og krydstjekke dem med eksterne lejerlister.

## ✨ Funktioner

### 🔍 Intelligent Søgning
*   **Adresseopslag:** Bruger Dataforsyningens (DAWA) API til præcis søgning på danske adgangsadresser.
*   **Tastaturnavigation:** Naviger nemt i søgeforslag med piletasterne og vælg med Enter.
*   **Justerbar Radius:** Find lejemål inden for 100m til 2000m med en dynamisk slider og visuel cirkelindikator på kortet.

### 🗺️ Interaktivt Kort & Liste
*   **Visuelt Overblik:** Se alle Airbnb-lejemål som blå markører på et Leaflet-baseret kort.
*   **Billede Preview:** Hold musen over listen for at se et stort billede af boligen øverst på kortet, eller klik på en markør for at se billede og info i en popup.
*   **Avanceret Sortering:** Sortér resultater efter nyeste anmeldelser, laveste pris, flest anmeldelser, værtsnavn eller tilgængelighed.

### 🤝 Lejerliste Matching (Unik funktion)
*   **CSV Upload:** Upload din egen semikolon-separerede lejerliste.
*   **Automatisk Matching:** Systemet matcher automatisk navne fra din liste med Airbnb-værternes navne.
*   **Reaktive Resultater:** Hvis du ændrer radius, opdateres listen over matches med det samme.
*   **Eksport:** Download en beriget CSV-fil med direkte links til alle matchede Airbnb-annoncer.

## 🛠️ Teknologier
*   **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 (Grid & Flexbox).
*   **Kort:** [Leaflet.js](https://leafletjs.com/) med OpenStreetMap.
*   **Data:** [PapaParse](https://www.papaparse.com/) til lynhurtig håndtering af CSV-filer.
*   **API:** [DAWA](https://dawadocs.dataforsyningen.dk/) (Danmarks Adressers Web API).

## 🚀 Kom i gang

Da applikationen indlæser lokale CSV-filer via JavaScript, kræver den en lokal webserver for at fungere korrekt (pga. browser-sikkerhed/CORS).

### Metode 1: Python (Hurtigst)
1. Åbn din terminal/kommando-promt i projektmappen.
2. Kør følgende kommando:
   ```bash
   python -m http.server 8000
   ```
3. Gå til `http://localhost:8000` i din browser.

### Metode 2: VS Code Live Server
1. Installer udvidelsen **"Live Server"**.
2. Højreklik på `index.html` og vælg **"Open with Live Server"**.

## 📊 Dataformat
For at matching-funktionen virker, skal din uploadede CSV-fil være **semikolon-separeret ( ; )** og indeholde følgende overskrifter:
*   `Navn` (Bruges til matching mod Airbnb-vært)
*   `Lejernr.`
*   `Adresse`
*   `Areal`
*   `Rum`

## 📝 Licens
Dette projekt er til fri afbenyttelse. Airbnb-data leveres typisk af [Inside Airbnb](http://insideairbnb.com/get-the-data/).

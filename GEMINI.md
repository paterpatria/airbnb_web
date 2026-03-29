# Projekt Oversigt: Airbnb Adresse-søger

Dette projekt er en interaktiv webapplikation, der gør det muligt for brugere at søge efter adresser i Danmark og finde Airbnb-lejemål inden for en radius af 300 meter.

## Teknologier
- **HTML5/CSS3:** Til struktur og design.
- **JavaScript (Vanilla):** Til al logik og interaktivitet.
- **Leaflet.js:** Til det dynamiske kort (OpenStreetMap).
- **PapaParse:** Til parsing af `listings.csv` filen.
- **Dataforsyningen (SDFI) API:** Til adressesøgning og autocomplete.

## Projektstruktur
- `index.html`: Webapplikationens fundament og struktur.
- `style.css`: Alle visuelle styles og layout-definitioner.
- `script.js`: "Hjernen" i applikationen (kort-logik, API-kald, filtrering).
- `listings.csv`: Datakilden med Airbnb-lejemål i København.

## Kørsel af projektet
Da applikationen indlæser en lokal CSV-fil (`listings.csv`) via JavaScript, tillader browseren ikke direkte kørsel ved blot at åbne HTML-filen. Der skal bruges en lokal webserver.

**Anbefalede metoder:**
1. **Python:** Kør `python -m http.server` i projektmappen og gå til `http://localhost:8000`.
2. **VS Code:** Brug udvidelsen "Live Server" og klik på "Go Live".

## Udviklingskonventioner
- **Separation of Concerns:** Hold HTML, CSS og JS adskilt i de respektive filer.
- **API integration:** Brug DAWA (Danmarks Adressers Web API) fra Dataforsyningen til adresseopslag.
- **Radius-logik:** Afstande beregnes i `script.js` ved hjælp af Haversine-formlen.

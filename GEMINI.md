# Projekt Oversigt: Airbnb Adresse-søger & Lejer-matcher

Dette projekt er en interaktiv webapplikation til analyse af Airbnb-data i Danmark. Den gør det muligt at søge efter adresser, visualisere lejemål på et kort og foretage automatisk matching mod eksterne lejerlister.

## Kernefunktionalitet
- **Præcis Adressesøgning:** Integration med DAWA API (SDFI) til søgning på adgangsadresser med fuld tastaturnavigation.
- **Interaktivt Kort:** Dynamisk visning af Airbnb-lejemål med en justerbar radius (100m - 2000m) og visuel cirkel-indikator.
- **Avanceret Sortering:** Sidepanelet kan sorteres efter nyeste anmeldelser, pris, antal anmeldelser, værtsnavn eller tilgængelighed.
- **Visuel Preview:** Stort billede-preview øverst på kortet ved hover i listen, samt billeder direkte i kortets popups.
- **Lejerliste Matching (CSV Upload):** 
    - Upload af semikolon-separeret lejerliste.
    - Intelligent navne-matching mod Airbnb-værter (ord-baseret regex).
    - Reaktive matches: Resultaterne opdateres øjeblikkeligt, hvis radius-slideren ændres.
    - Visuel toggle-mode til at skifte mellem "Alle lejemål" og "Kun matches".
- **Eksport:** Mulighed for at downloade de filtrerede resultater eller de berigede lejerlister som CSV-filer med direkte links til Airbnb.

## Teknologier
- **Frontend:** HTML5, CSS3 (Grid/Flexbox), Vanilla JavaScript.
- **Kort:** Leaflet.js med OpenStreetMap tiles.
- **Data-håndtering:** PapaParse til parsing og generering af CSV-filer.
- **API:** Dataforsyningen (DAWA) til adressesøgning og koordinater.

## Projektstruktur
- `index.html`: Struktur og UI-komponenter (kontrolpanel, sidebar, kort-container).
- `style.css`: Visuel styling, herunder det dynamiske overlay-system til billede-previews.
- `script.js`: Applikationslogik, herunder reaktiv tilstandshåndtering, afstandsberegning (Haversine) og matching-algoritmer.
- `listings.csv`: Detaljeret Airbnb-datakilde (skal indeholde `picture_url`, `host_name`, etc.).

## Lokale Krav
- **Webserver:** Da applikationen indlæser lokale CSV-filer via JavaScript, skal den køres via en lokal server (f.eks. Python `http.server` eller VS Code `Live Server`).
- **Dataformat:** Den uploadede lejerliste skal være semikolon-separeret (`;`) og indeholde kolonnerne `Navn`, `Lejernr.`, `Adresse`, `Areal` og `Rum`.

## Udviklingskonventioner
- **Reaktivitet:** Ændringer i radius eller sortering skal reflekteres øjeblikkeligt i både listen og på kortet.
- **Brugervenlighed:** Fokus på visuel feedback (markering af valgte elementer, statusbeskeder).
- **Separation of Concerns:** Logik, styling og struktur holdes strengt adskilt.

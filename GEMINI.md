# Projekt Oversigt: Airbnb Adresse-søger & Lejer-matcher

Dette projekt er en interaktiv webapplikation til analyse af Airbnb-data i Danmark. Den gør det muligt at søge efter adresser, visualisere lejemål på et kort og foretage automatisk matching mod eksterne lejerlister med avanceret sandsynlighedsberegning.

## Kernefunktionalitet
- **Præcis Adressesøgning:** Integration med DAWA API (SDFI) til søgning på adgangsadresser. Kortet zoomer automatisk til den valgte radius (max zoom 16) for at sikre overblik.
- **Interaktivt Kort:** Dynamisk visning af Airbnb-lejemål med en justerbar radius (100m - 2000m). Markører farvekodes efter match-sandsynlighed (Grøn/Orange/Grå).
- **Avanceret Sortering:** Standardvisning kan sorteres efter anmeldelser, pris, værtsnavn eller tilgængelighed.
- **Lejerliste Matching (Probabilistisk):** 
    - Upload af semikolon-separeret lejerliste.
    - **Sandsynlighedsscore (0-100 pts):**
        1. **Navn (50 pts):** Regex match af værtsnavn mod lejerens fulde navn.
        2. **Rum (30 pts):** Matcher hvis `Airbnb_Bedrooms + 1 == Lejer_Rum`.
        3. **Areal (20 pts):** Matcher baseret på kapacitet (ca. 25m² pr. person).
    - **Bevaring af rækkefølge:** Listen over matches følger den originale rækkefølge fra lejerlisten.
- **Eksport:** Mulighed for at downloade berigede lejerlister som CSV. Match-kolonner (`airbnb_link_N` og `match_score_N`) tilføjes til sidst i filen for at bevare de originale data forrest.
- **Fremtidig Integration:** Implementering af den avancerede match-motor fra det separate Python-projekt, når denne er færdigudviklet (inkl. analyse af reviews og descriptions).

## Teknologier
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3.
- **Kort:** Leaflet.js med OpenStreetMap tiles.
- **Data-håndtering:** PapaParse til parsing og generering af CSV-filer.
- **API:** Dataforsyningen (DAWA) til adressesøgning.

## Udviklingskonventioner
- **ID Integritet:** Airbnb IDs behandles altid som strenge (`dynamicTyping: false`) for at undgå præcisionstab på 18-cifrede tal.
- **Reaktivitet:** Ændringer i radius eller match-mode reflekteres øjeblikkeligt uden genindlæsning.
- **Farvekoder:** 
    - `>= 80%`: Grøn (Høj sandsynlighed)
    - `>= 50%`: Orange (Mellem sandsynlighed)
    - `< 50%`: Grå (Lav sandsynlighed)

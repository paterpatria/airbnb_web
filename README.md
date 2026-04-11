# Airbnb Adresse-søger & Lejer-matcher 🏠📍

En interaktiv webapplikation designet til at analysere og matche lokale Airbnb-data i Danmark. Værktøjet hjælper med at identificere mulige fremlejemål ved at sammenligne Airbnb-opslag med officielle lejerlister.

## ✨ Funktioner

### 🔍 Intelligent Søgning
*   **Adresseopslag:** Bruger DAWA API til præcis søgning. Kortet tilpasser automatisk zoom (fitBounds), så hele søgeradius er synlig.
*   **Justerbar Radius:** Find lejemål inden for 100m til 2000m med øjeblikkelig opdatering af kort og liste.

### 🤝 Avanceret Matching (Match Mode)
Når en lejerliste uploades, beregner systemet en sandsynlighedsscore for hver lejer mod de nærliggende Airbnb-opslag:
*   **Navnematch (50 point):** Kigger efter værtsnavnet i lejerens fulde navn.
*   **Rummatch (30 point):** Tjekker om antallet af værelser stemmer (Airbnb Bedrooms + 1).
*   **Arealmatch (20 point):** Vurderer om boligens størrelse matcher Airbnb-kapaciteten (ca. 25m² pr. person).

**Match-niveauer:**
*   🟢 **Høj sandsynlighed:** Score på 80-100% (Typisk navn + rum/areal).
*   🟠 **Mellem sandsynlighed:** Score på 50-79% (Typisk kun navnematch).
*   ⚪ **Lav sandsynlighed:** Score under 50%.

### 📤 Eksport
Download resultaterne som en CSV-fil. Dine originale kolonner bevares først, og de fundne matches tilføjes til sidst med overskrifterne `airbnb_link_1`, `match_score_1` osv.

---

## 📂 Opdatering af Data

For at holde applikationen opdateret skal du regelmæssigt hente nye data fra kilderne.

### 1. Inside Airbnb (insideairbnb_listings_slim.csv)
Inside Airbnb leverer detaljerede datasæt.
1. Gå til [Inside Airbnb - Get the Data](http://insideairbnb.com/get-the-data/).
2. Find "Copenhagen" og download filen `listings.csv.gz` (den store detaljerede fil, ikke "summary").
3. Pak filen ud så du har en stor `listings.csv`.
4. Kør følgende script i **PowerShell** for at lave den optimerede slim-version:

```powershell
Import-Csv "listings.csv" | 
    Select-Object id, name, host_name, latitude, longitude, room_type, accommodates, bedrooms, price, number_of_reviews, last_review, availability_365, picture_url | 
    Export-Csv "insideairbnb_listings_slim.csv" -NoTypeInformation -Encoding utf8
```

### 2. Doorstep Analytics (doorstepanalytics_listings.csv)
1. Log ind på din konto hos Doorstep Analytics.
2. Eksporter den seneste oversigt over lejemål i København/Danmark til CSV.
3. Gem filen som `doorstepanalytics_listings.csv` i projektmappen. Appen genkender automatisk de specifikke kolonnenavne (f.eks. `PersonCapacity` og `Bedrooms`).

---

## 🚀 Kom i gang

Kræver en lokal webserver (pga. browser-sikkerhed/CORS):

**Python:**
```bash
python -m http.server 8000
```

**VS Code:**
Højreklik på `index.html` og vælg **"Open with Live Server"**.

## 📊 Format for lejerliste
CSV-filen skal være **semikolon-separeret ( ; )** og indeholde:
`Navn`, `Lejernr.`, `Adresse`, `Areal`, `Rum`.

## 🔮 Fremtidig Udvikling
Der arbejdes på et separat Python-projekt (`airbnb_python/`) til avanceret efterforskning af enkelte lejligheder. Når match-motoren i Python er færdigudviklet (inkl. automatiseret analyse af reviews og detaljerede beskrivelser), er planen at porte denne avancerede logik direkte over i denne webapplikation.

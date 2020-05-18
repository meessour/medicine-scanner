# Medicijn Scanner

This project features a medicine scanner using machine learning. It is able to detect what kind of medicine you are holding using the device's camera.

## Demo

[Demo](https://medicijn-scanner.herokuapp.com/)

## Table of Contents

1. [How to install](#How-to-install)
2. [Debriefing](#debriefing)
    - [Onderzoeksvragen](#onderzoeksvragen)
    - [Scope](#scope)
    - [Planning](#planning)
3. [Licence](#licence)    

## How to install

**Step 1:** Clone project:
```git
git clone https://github.com/meessour/meesterproef-1920.git
```

**Step 2:** CD to path of the project's root:
```git
cd C:/../..
```

**Step 3:** Install packages:
```git
npm install
```

**Step 4:** Start the server:
```git
npm start
```

**Step 5:** Navigate to: http://localhost:8080/

## Debriefing 

Dit project wordt in opdracht uitgevoerd door bedrijf "Voorhoede" en heb daarbij veel vrijheid binnen een bepaalde scope. Voor dit project is het niet nodig om mij te verdiepen in dit bedrijf. Een bestaande collectie met verschillende medicijnen en de informatie die daar betrekking bij heeft, heb ik tot mijn beschikking. Informatie/data geleverd uit de app is op basis van [deze collectie/API](https://hva-cmd-meesterproef-ai.now.sh/medicines). Hier is een voorbeeld van een medicijn en de relevante informatie in JSON:

```json
{
  "id": 0,
  "registrationNumber": "RVG  121312",
  "name": "18F-FDG Hoboken 250 MBq/ml, oplossing voor injectie",
  "activeIngredient": "V09IX04 - Fludeoxyglucose [18 F]"
}
```

De opdrachtgever wilt een web app die bedoeld is voor medicijngebruikers, dat is de doelgroep. In deze app kunnen medicijndoosjes gescand worden met de camera van de gebruiker. Aan de hand daarvan lever ik een bijsluiter en andere belangrijke informatie aan de gebruiker op visuele wijze via een informatie-/resultatenpagina. De gebruiker scanned (bijvoorbeeld) het registratienummer en via OCR (Optical Character Recognition) en de app levert dan data op basis van dit nummer. Daarnaast moet frontend van deze site intuïtief en toegankelijk zijn en is bedoeld voor een brede doelgroep. In de app moeten onder andere de homepage, scanner pagina en resultaat pagina aanwezig zijn.

### Onderzoeksvragen

* Hoe kan een medicijngebruiker op basis van een medicijndoosje een bijsluiter en belangrijke informatie vergaren?
    * Wat zou de app moeten kunnen herkennen van een scan?
    * Wat is een alternatief als de gebruiker geen camera heeft?
    * Worden er geen regels overtreden van de GDPR?
    * Hoe gaat de app om met false-positives?
    * Hoe vangt de app errors op?
    * Wat doet de app als er geen resultaat uit een scan is voortgekomen?

### Scope
* Use the user's webcam
* Make it clear for the user what the webcam will be used for
* Let the user choose if they want to help improve the app by sending their scan results to the server.
* Let the user recover easily when something goes wrong.
* The app should work on different types of browsers.
* The app should handle if the user is offline/has no JS.

### Planning
**Week 1:** Oriënteren over opdracht en concept uitwerken.  
**Week 2:** De basis opzetten en benodigde functionaliteiten implementeren.  
**Week 3:** Opdracht verder uitwerken en extra features toevoegen.  
**Week 4:** Testen en verbeteren/perfectioneren.    
**Week 5:** Puntjes op de i zetten, bugs fixen en afronden. 

## Licence
MIT © [Mees Sour](https://github.com/meessour)
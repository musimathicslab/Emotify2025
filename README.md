<img src="https://github.com/a-ture/DalaiLama/blob/f101e0e372e04451ab05c08aa33052989bb6bb22/resources/icon.png">

# Emotify

Emotify è un’applicazione cross-platform (Web, iOS, Android) che permette di scoprire la musica in base alle emozioni e al contesto in cui ci si trova, offrendo un sistema avanzato di raccomandazione basato su Reinforcement Learning (utilizzando **Tensoflower.js**).  
Il progetto include:

- **Versione Web**: Sviluppata con Angular e [PrimeNG](https://primeng.org).
- **App Mobile**: Configurata con [Capacitor](https://capacitorjs.com/docs/v2/guides/splash-screens-and-icons) per il deploy su iOS e Android.
- **Backend**: Integrazioni con le API di Last.fm e di Spotify.
- **Algoritmi di Raccomandazione**: Basati su Tensoflower.js per apprendere dalle scelte degli utenti.

---

## Funzionalità Principali

- **Scoperta Musicale per Emozioni e Contesto**  
  Permette agli utenti di trovare musica basata sulle emozioni e sul contesto in cui si trovano.

- **Raccomandazioni Personalizzate**  
  Utilizza algoritmi di Reinforcement Learning basati su **Tensoflower.js** per suggerire brani.

- **Integrazione con API Esterne**  
  Si integra con le API di **Last.fm** e **Spotify** per ottenere dati aggiornati e completi sulla musica.

- **Interfaccia Utente Avanzata**  
  Realizzata con **Angular** e **PrimeNG**, offre visualizzazioni interattive (grafici e mappe delle emozioni con [D3.js](https://d3js.org)).

- **Profilo Utente e Statistiche**  
  Permette agli utenti di visualizzare il proprio profilo, le statistiche d’uso e la cronologia musicale.

---

## Struttura del Progetto

```
emotify/
├─ android/                # Progetto Android (Capacitor)
├─ ios/                    # Progetto iOS (Capacitor)
├─ dist/                   # Output della build di produzione
├─ node_modules/           # Dipendenze Node (non versionate)
├─ public/                 # Asset statici (immagini, font, ecc.)
├─ resources/              # Risorse per icone e splash screen
├─ src/                    # Codice sorgente Angular
│  ├─ app/                 # Componente radice e configurazioni
│  ├─ components/          # Componenti modulari (header, footer, home, ecc.)
│  ├─ services/            # Servizi per chiamate API e logica di business
│  ├─ *.constants.ts       # File di costanti (emozioni, tag musicali, ecc.)
│  ├─ index.html           # Entry point dell’applicazione web
│  ├─ main.ts              # Bootstrapping di Angular
│  └─ styles.css           # Stili globali
├─ .editorconfig
├─ .gitignore
├─ .prettierrc             # Configurazione di Prettier
├─ angular.json
├─ capacitor.config.ts     # Configurazione di Capacitor
├─ package.json
├─ package-lock.json
├─ tsconfig.json
└─ README.md
```

---

## Installazione e Configurazione

1. **Clona il Repository:**

   ```bash
   git clone https://github.com/tuo-utente/emotify.git
   cd emotify
   ```

2. **Installa le Dipendenze:**

   ```bash
   npm install
   ```

3. **Configura le API Keys:**  
   Inserisci le chiavi per Last.fm e Spotify nei file di configurazione (ad esempio, in `src/environments/environment.ts`).

4. **Conferma la Configurazione di Prettier:**  
   Assicurati che il file `.prettierrc` contenga le impostazioni desiderate per formattare il codice. Per formattare automaticamente i file, puoi eseguire:

   ```bash
   npm run format
   ```

   (Verifica nel file `package.json` che sia presente lo script `"format": "prettier --write '**/*.{ts,js,css,html}'"` oppure aggiungilo se necessario.)

---

## Avvio del Progetto

### 1. Versione Web (Angular)

- **Modalità Sviluppo:**

  ```bash
  ng serve
  ```

  L'applicazione sarà disponibile su [http://localhost:4200](http://localhost:4200).

- **Build di Produzione:**

  ```bash
  ng build --configuration production
  ```

  I file generati verranno salvati nella cartella `dist/`.

---

### 2. App Mobile con Capacitor

#### iOS

1. **Build della Versione Web:**

   ```bash
   ng build --configuration production
   ```

2. **Sincronizza con Capacitor:**

   ```bash
   npx cap sync ios
   ```

3. **Apri il Progetto in Xcode:**

   ```bash
   npx cap open ios
   ```

4. **Esegui l'App:**  
   Seleziona il simulatore o il dispositivo in Xcode e premi **Run**.  
   Assicurati di avere certificati validi per testare su dispositivo reale.

#### Android

1. **Build della Versione Web:**

   ```bash
   ng build --configuration production
   ```

2. **Sincronizza con Capacitor:**

   ```bash
   npx cap sync android
   ```

3. **Apri il Progetto in Android Studio:**

   ```bash
   npx cap open android
   ```

4. **Esegui l'App:**  
   Seleziona l'emulatore o collega un dispositivo Android e premi **Run** per installare e avviare l'app.

---

## Mobile Configurator

Per personalizzare le impostazioni dell’app mobile:

1. Accedi al file di configurazione (es. `capacitor.config.ts` o `app.config.ts`).
2. Modifica i parametri desiderati (ad esempio, **nome app**, **icone**, **feature abilitate/disabilitate**).
3. Esegui nuovamente i comandi di build e sincronizzazione per aggiornare le app iOS/Android.

---

## Sviluppato da

- <a href="https://github.com/raffaellaspagnuolo">Raffaella Spagnulo</a>
- <a href="https://github.com/a-ture" >Alessia Ture </a>

---

## Contatti

Per domande e suggerimenti contatta:  
- **[a.ture@studenti.unisa.it](mailto:a.ture@studenti.unisa.it)**
- **[r.spagnuolo6@studenti.unisa.it](mailto:r.spagnuolo6@studenti.unisa.it)**

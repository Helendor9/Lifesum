# Lifesum Tracker Pro - Standalone Offline (Capacitor Android)

Applicazione di tracciamento calorie, macronutrienti e dieta ispirata a Lifesum, **100% autonoma e funzionante offline**, integrata con **Capacitor** per la generazione del file `.apk` nativo Android.

---

## 🌟 Caratteristiche Chiave

* **100% Standalone & Offline (Zero Server Obbligatorio):**  
  Tutti i dati (pasti, profilo, calorie, storico acqua, cibi personalizzati) sono memorizzati in locale tramite **IndexedDB** all'interno del dispositivo. L'app funziona in aereo o senza connessione.
* **Calcolo Fabbisogno & Macro (Formula Mifflin-St Jeor):**  
  Calcolo BMR, TDEE, deficit calorico e ripartizione precisa in grammi di Carboidrati, Proteine e Grassi in base a 4 piani alimentari (*Standard*, *Clean Eating*, *High Protein*, *Keto*).
* **Integrazione Open Food Facts:**  
  Ricerca globale tra oltre 3 milioni di alimenti e lettura codice a barre (EAN-13) con recupero automatico di calorie, macro, micro (fibre, zuccheri, sodio) e Nutri-Score. Quando un cibo viene aggiunto al diario, viene salvato in IndexedDB per essere accessibile anche offline!
* **Progetto Nativo Android (Capacitor):**  
  Cartella `android/` già configurata e pronta per la compilazione in file `.apk`.

---

## 📦 Come Ottenere il File `.apk`

### Metodo 1: Cloud Build Gratuita con GitHub Actions (Consigliato, Zero Installazioni su PC)
Nella cartella è presente il workflow `.github/workflows/build-apk.yml`.
1. Crea un repository su GitHub (può essere anche **Privato**).
2. Carica i file di questo progetto su GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Lifesum Capacitor Offline"
   git branch -M main
   git remote add origin https://github.com/TUO_USERNAME/TUO_REPO.git
   git push -u origin main
   ```
3. Vai nella scheda **Actions** del tuo repository su GitHub:
   - GitHub avvierà automaticamente la compilazione dell'APK su macchine cloud Android/Java.
   - Dopo circa 2 minuti, sotto la sezione **Artifacts**, troverai il file `lifesum-tracker-debug-apk` contenente il file **`app-debug.apk`** pronto da scaricare e installare sul tuo telefono!

---

### Metodo 2: Compilazione Locale con Android Studio
Se hai installato [Android Studio](https://developer.android.com/studio) sul tuo computer:
1. Apri Android Studio.
2. Clicca su **Open** e seleziona la cartella:
   `C:\Users\simon\.gemini\antigravity\scratch\lifesum-tracker\android`
3. Attendi il completamento della sincronizzazione iniziale di Gradle.
4. Nel menu in alto, clicca su:
   **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**.
5. In basso a destra comparirà la notifica: *APK(s) generated successfully* con il pulsante **locate** che ti porterà direttamente al file `app-debug.apk`.

<div align="center">
  <img src="docs/images/boot-animation.gif" alt="Animazione di avvio di ADL Script" width="360" />
  <h1>ADL_Script</h1>
  <p>Installa e gestisci macro, interfacce web e strumenti CFS sulla Creality K1C da un unico menu SSH.</p>
  <a href="https://github.com/AlbertoTrento/ADL-Script/commits/main"><img src="https://img.shields.io/github/last-commit/AlbertoTrento/ADL-Script?style=flat-square&color=555" alt="Ultimo commit" /></a>
  <img src="https://img.shields.io/badge/Stampante-Creality%20K1C%20%2B%20CFS-0078D6?style=flat-square" alt="Stampante: Creality K1C con CFS" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/Licenza-GPL--3.0-blue?style=flat-square" alt="Licenza: GPL-3.0" /></a>
</div>

## A cosa serve

ADL_Script è la versione di [AlbertoTrento](https://github.com/AlbertoTrento) del CFS Power Script, destinata alla **Creality K1C con accesso root e firmware del CFS Upgrade Kit**. Riunisce in un menu SSH l'installazione e la rimozione di interfacce web, macro Klipper e strumenti per il CFS.

È utile a chi vuole controllare la stampante da Fluidd o Mainsail, configurare l'avvio stampa, gestire bobine senza RFID o raccogliere informazioni sulle disconnessioni del CFS. Rispetto all'installazione manuale dei singoli componenti, raccoglie in un posto le scelte disponibili e applica le relative modifiche ai servizi e alle configurazioni. Richiede comunque familiarità con SSH, Klipper e le impostazioni dello slicer.

## Compatibilità e requisiti

- Creality K1C con firmware del CFS Upgrade Kit: la documentazione dell'autore indica prove con **2.3.5.34**.
- Accesso SSH come `root`, indirizzo IP della stampante e client SSH sul computer.
- Connessione Internet della stampante, Git disponibile e data e ora corrette per i collegamenti HTTPS.
- Installazione nella cartella esatta `/usr/data/helper-script`.
- Fluidd per la scheda CFS e la sua finestra di diagnostica; queste due interfacce non sono disponibili in Mainsail.

Il controllo iniziale riconosce la famiglia K1, ma questo non certifica tutte le combinazioni di K1, K1 Max e firmware: le personalizzazioni CFS descritte qui sono rivolte alla K1C. L'autore consiglia una configurazione pulita; prima di utilizzare lo script, rimuovere le installazioni di Moonraker, Fluidd o Mainsail gestite da altri script.

## Installazione

Collegarsi alla stampante:

```sh
ssh root@IP_DELLA_STAMPANTE
```

Scaricare il progetto e avviare il menu:

```sh
git clone --depth 1 https://github.com/AlbertoTrento/ADL-Script.git /usr/data/helper-script
sh /usr/data/helper-script/helper.sh
```

Dopo il primo avvio è disponibile il comando:

```sh
helper
```

L'avvio applica anche l'animazione e le migrazioni previste dal progetto: non è una semplice consultazione dei componenti installati.

In caso di errore SSL, controllare prima data e ora. Il precedente README riportava `git config --global http.sslVerify false` come espediente: disabilita globalmente la verifica dei certificati e non è un passaggio ordinario dell'installazione.

### Ordine dei componenti

Nel menu `[Install]`, installare **1 — Moonraker and Nginx**, quindi **2 — Fluidd** oppure **3 — Mainsail**. Le interfacce sono raggiungibili rispettivamente su `http://IP_DELLA_STAMPANTE:4408` e `http://IP_DELLA_STAMPANTE:4409`.

Installare **5 — Klipper Gcode Shell Command** prima di Power Macros, Buzzer, Camera Support, CFS Diagnostics e CFS Custom Filaments. **4 — Entware** serve per Git Backup, Timelapse, le integrazioni remote e il supporto camera USB. Git Backup richiede anche Gcode Shell Command.

## Menu disponibili

Digitare la scelta e premere Invio; `b` torna indietro e `q` esce.

| Menu | Funzioni |
|---|---|
| `[Install]` | Installa i 21 moduli elencati sotto; alcune voci consentono di riapplicare la configurazione |
| `[Remove]` | Rimuove i moduli e, dove previsto, ripristina file o valori originali |
| `[Customize & PowerScreen]` | ADL Screen, interfaccia web Creality, temi Fluidd e pannello CFS |
| `[Backup & Restore]` | Archivi della configurazione Klipper e del database Moonraker, con relativo ripristino |
| `[Tools]` | Gestione configurazioni, stampa da cartelle, camera, servizi, pacchetti Entware, cache, log, firmware e reset |
| `[Information]` | Stato dei componenti rilevati |

### Tutte le voci di installazione

| N. | Modulo | Utilità |
|---|---|---|
| 1 | Moonraker and Nginx | Servizi necessari alle interfacce web |
| 2 | Fluidd | Controllo web; supporta anche il pannello CFS del progetto |
| 3 | Mainsail | Interfaccia web alternativa |
| 4 | Entware | Gestione dei pacchetti utilizzati da altri moduli |
| 5 | Klipper Gcode Shell Command | Consente alle macro previste di richiamare script shell |
| 6 | Power Macros | Configurazioni di stampa, gestione filamento, camera e strumenti di calibrazione |
| 7 | Bed Coordinates Fix | Coordinate Y, passaggio sulla spazzola e area della mesh per la K1C CFS |
| 8 | Klipper Adaptive Meshing & Purging | Mesh e spurgo adattati agli oggetti stampati |
| 9 | Buzzer Support | Segnalazione sonora con `BEEP` |
| 10 | Nozzle Cleaning Fan Control | Controllo delle ventole durante la pulizia dell'ugello |
| 11 | Save Z-Offset Macros | Conserva l'offset Z tra i riavvii |
| 12 | Screws Tilt Adjust Support | Indicazioni per la regolazione manuale delle viti del piatto |
| 13 | M600 Support | Cambio filamento manuale con pausa e ripresa |
| 14 | Git Backup | Invio delle modifiche alla configurazione a un repository GitHub configurato dall'utente |
| 15 | Moonraker Timelapse | Acquisizione fotogrammi e creazione di timelapse |
| 16 | Camera Support | Regolazioni camera e supporto USB opzionale |
| 17 | OctoEverywhere | Installazione dell'integrazione con il servizio esterno |
| 18 | Moonraker Obico | Installazione dell'integrazione con Obico |
| 19 | Mobileraker Companion | Installazione del componente per Mobileraker |
| 20 | CFS Diagnostics | Registro disconnessioni e recupero USB opzionale, in beta |
| 21 | CFS Custom Filaments | Materiali personalizzati per le bobine CFS |

## Uso nei casi più comuni

### Preparare la stampa e usare una bobina esterna

**Power Macros**, voce 6, sostituisce `gcode_macro.cfg`, `printer_params.cfg` e `box.cfg`; conserva i primi originali in `/usr/data/helper-script-backup/power-config/`. La riapplicazione sovrascrive nuovamente i tre file.

**KAMP**, voce 8, aggiunge mesh e linea di spurgo adattive. Abilitare l'etichettatura degli oggetti nello slicer e aggiungere `ADAPT_PURGE_MOD` alla fine del G-code iniziale, dopo il caricamento del filamento CFS. `START_PRINT` accetta `BED_TEMP` ed `EXTRUDER_TEMP`; usare le temperature del proprio profilo. L'installazione propone anche le macro necessarie a PrusaSlicer.

`KAMP_BED_MESH_SETTINGS` seleziona mesh adattiva, completa o nessuna nuova mesh richiesta; `KAMP_PURGE_LINE_SETTINGS` seleziona spurgo adattivo o classico. Le scelte sono conservate in `Helper-Script/variables.cfg`. Se manca una mesh disponibile, il percorso non adattivo può comunque avviare una calibrazione completa.

La pulizia iniziale usa le temperature di stampa. La temperatura del piatto durante la pulizia è limitata alla temperatura richiesta per la stampa: non va descritta come sempre superiore o uguale a 50 °C. Dopo il caricamento CFS, `ADAPT_PURGE_MOD` attende nuovamente la temperatura dell'ugello impostata dallo slicer.

Con CFS escluso, infilare manualmente il filamento fino all'estrusore: la sequenza KAMP lo porta all'ugello tramite `_CARICA_BOBINA_ESTERNA`. Le Power Macros evitano `BOX_END` a fine stampa con bobina esterna, ma riattivano poi il CFS: controllare la modalità prima della stampa successiva.

In `box.cfg`, il caricamento iniziale `Tn_extrude` è **200 mm**, mentre i parametri di pulizia sono **100 mm**. Sono fasi diverse; non è garantito un unico ciclo di spurgo per ogni impostazione dello slicer.

### Gestire le bobine da Fluidd

Installare il pannello con `[Customize & PowerScreen] → 7`, poi ricaricare Fluidd. La scheda mostra quattro slot, materiale, colore, slot caricato e i dati di quantità residua, umidità e temperatura forniti dal CFS. Si può spostare in una scheda flottante; posizione e stato sono conservati nel browser.

Fare clic su una bobina per modificarne materiale e colore. **REFRESH SLOTS** richiede al firmware di rileggere gli slot e comporta piccoli movimenti del filamento. Modifica e aggiornamento non sono disponibili durante una stampa o una pausa. Il pannello comunica con Moonraker e non richiede il server web Creality.

Per bobine senza RFID, installare **CFS Custom Filaments**, voce 21, e usare **New filament** oppure:

```gcode
CFS_ADD_MATERIAL BASE=00001 BRAND=eSun NAME=PLA+~Pro TYPE=PLA NOZZLE=215 MIN=195 MAX=245 COLOR=3B82F6
CFS_LIST_MATERIALS
CFS_REMOVE_MATERIAL ID=90001
```

Sono esempi: scegliere una base esistente e dati adatti al filamento. `~` sostituisce gli spazi e il colore usa sei cifre esadecimali senza `#`. I nuovi ID sono compresi tra `90001` e `99999`. ADL Screen richiede un riavvio per visualizzare i nuovi materiali. La rimozione del modulo conserva l'elenco personalizzato.

### Cambiare filamento manualmente

Installare **M600 Support**, voce 13. `M600` mette in pausa e apre il cambio filamento di ADL Screen, se disponibile, oppure un pannello Fluidd/Mainsail con caricamento, scaricamento, spurgo, ripresa e annullamento. I comandi del pannello standard sono `FILAMENT_CHANGE_RESUME` e `FILAMENT_CHANGE_CANCEL`; non sostituiscono il `RESUME` del firmware CFS.

### Esaminare una disconnessione CFS

Installare **CFS Diagnostics**, voce 20. L'installazione avvia il servizio e abilita il recupero USB. Da Fluidd, **CFS DIAGNOSTICS** apre i controlli di servizio, registrazione, recupero e download dei log. In console sono disponibili `CFS_DIAG_STATUS`, `CFS_DIAG_SUMMARY`, `CFS_DIAG_SNAPSHOT`, `CFS_DIAG_ENABLE`, `CFS_DIAG_DISABLE`, `CFS_DIAG_LOG_ON`, `CFS_DIAG_LOG_OFF`, `CFS_DIAG_AUTORECOVER_ON`, `CFS_DIAG_AUTORECOVER_OFF` e `CFS_DIAG_CLEAN`.

Il registro principale è `/usr/data/printer_data/logs/cfs_diag.log`. Le cause indicate sono probabili. Il recupero tenta il reset dell'adattatore USB dopo 20 secondi di disconnessione, se l'adattatore è ancora presente e la stampante non sta stampando né è in pausa: massimo tre tentativi per evento, distanziati di almeno 60 secondi, e sei all'ora. È una funzione **beta**, non una garanzia di recupero della stampa.

### Camera e timelapse

Le Power Macros espongono `CAMERA_OFF`, `CAMERA_ON` e `RELOAD_CAMERA`. A camera spenta non vengono acquisiti fotogrammi timelapse. Camera Support aggiunge regolazioni come `CAM_SETTINGS` e `CAM_BRIGHTNESS BRIGHTNESS=0`; il supporto USB dipende dall'hardware rilevato.

Moonraker Timelapse aggiunge `GET_TIMELAPSE_SETUP`, `TIMELAPSE_TAKE_FRAME` e `TIMELAPSE_RENDER`. Configurare la cattura nel componente e nello slicer; la sola installazione non inserisce automaticamente le chiamate nei file G-code.

## ADL Screen e personalizzazione

[ADL Screen](https://github.com/AlbertoTrento/ADL-Screen) è il progetto per il touchscreen. La voce `[Customize & PowerScreen] → 1` mantiene il nome PowerScreen nel menu, ma scarica l'installer da AlbertoTrento/ADL-Screen e propone i canali `stable` e `nightly`.

Richiede Moonraker collegato a Klipper e il controllo firmware previsto dall'installer. Sostituisce il touchscreen Creality e disabilita Creality Cloud, il collegamento LAN di Creality Print e gli aggiornamenti firmware OTA. La voce 2 richiama la procedura di ripristino e rimuove la configurazione PowerScreen. Script e interfaccia condividono macro, quindi è utile mantenerli aggiornati insieme.

Le altre voci gestiscono l'interfaccia web Creality, i loghi Creality per Fluidd e il tema PowerUI. L'avvio dello script gestisce anche l'animazione ADL con lampo rosso, logo e scritta Alberto Dev Labs.

## Aggiornamento, rimozione e manutenzione

All'avvio sul ramo `main`, lo script controlla gli aggiornamenti e chiede se applicarli. La procedura usa `git reset --hard` e `git pull`: elimina le modifiche locali ai file tracciati dello script e richiede un nuovo avvio. Da Fluidd/Mainsail la voce del gestore aggiornamenti conserva il nome interno `CFS-Power-Script`, con origine AlbertoTrento/ADL-Script.

Il changelog arriva a **v1.3.9**; il menu ricava invece la versione dal checkout Git. Per aggiornare le configurazioni copiate usare le voci di riapplicazione disponibili. La correzione M600 descritta nel changelog richiede la reinstallazione del modulo e il riavvio di Klipper.

`[Remove]` gestisce i singoli moduli; non equivale a un ripristino completo della stampante. `[Backup & Restore]` produce `backup_config.tar.gz` e `backup_database.tar.gz` in `/usr/data/printer_data/config/`; un nuovo archivio sostituisce quello precedente e il ripristino sostituisce la relativa cartella corrente.

Le operazioni di manutenzione si eseguono a stampante inattiva. Il reset di fabbrica richiede poi di reinstallare i moduli. Il ripristino firmware usa un file `.img` nella radice di una chiavetta USB, seguendo le istruzioni della voce dedicata.

## Limiti da conoscere

- Le configurazioni dei moduli possono sostituire personalizzazioni locali; le copie originali gestite da alcuni moduli non coprono ogni modifica del sistema.
- Le indicazioni di quantità residua e materiale dipendono dai dati del CFS, non da una misura indipendente dello script.
- Il caricamento iniziale da 200 mm è una scelta del progetto per percorsi filamento più lunghi, non una soluzione garantita agli errori `key835` o `key849`.
- Il changelog segnala che i volumi di flushing di OrcaSlicer possono produrre più cicli di spurgo; riporta 235 mm³ per coppia e calcolo automatico disattivato come configurazione utilizzata, non come valore universale per tutti i materiali.
- Camera e adattatore CFS condividono l'hub USB; il ruolo della camera nelle disconnessioni non è dimostrato.
- Le integrazioni OctoEverywhere, Obico e Mobileraker richiedono la configurazione dei rispettivi servizi; lo script non ne determina disponibilità, prezzi o condizioni.

## Schermate

| Riferimento | Percorso conservato |
|---|---|
| Animazione di avvio | [docs/images/boot-animation.gif](docs/images/boot-animation.gif) |
| Dashboard Fluidd durante una stampa | [docs/screenshots/fluidd-dashboard.png](docs/screenshots/fluidd-dashboard.png) |
| Copertina indicata nel manifesto | [images/cover.png](images/cover.png) |
| Schermata indicata nel manifesto | [images/screenshots/01.png](images/screenshots/01.png) |

<p align="center">
  <img src="docs/screenshots/fluidd-dashboard.png" alt="La dashboard di Fluidd sulla K1C durante una stampa" />
</p>

## Crediti e licenza

ADL_Script nasce dal [CFS Power Script](https://github.com/borferkic/K1C-CFS-Power-Script) di Boris SdK (borferkic), derivato dal [Creality Helper Script](https://github.com/Guilouz/Creality-Helper-Script) di Guilouz e dagli adattamenti CFS di [Nik-oli](https://github.com/Nik-oli/Creality-Helper-Script-K1-CFS).

Licenza GNU GPL v3.0: vedi [LICENSE](LICENSE).

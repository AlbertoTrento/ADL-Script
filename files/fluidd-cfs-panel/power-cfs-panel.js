/*
 * ADL Script CFS card for Fluidd (scritte in italiano o in inglese, secondo la lingua di Fluidd).
 *
 * A card with the look of the Fluidd dashboard cards that shows the four slots of the CFS (a
 * spool in the real color, the material, the remaining filament and the loaded slot) and the
 * humidity and temperature of the box. Click a spool to edit its material and color.
 *
 * It starts docked in the dashboard, under the cards of its column. The button in its title bar
 * undocks it into a floating card that can be dragged anywhere; the same button docks it again.
 * The mode, the position and the collapsed state are kept in this browser.
 *
 * It talks to Moonraker only (the Klipper "box" object and the gcode script endpoint), so it does
 * not need the Creality web-server (port 9999). Colors and fonts come from the Fluidd theme.
 *
 * The slot data follows PowerScreen (src/cfs_model.cpp, src/cfs_panel.cpp):
 *   color_value    "0RRGGBB" (7 characters), "unknown" (spool without RFID) or "-1" (empty)
 *   material_type  id of Creality's material_database.json ("01001"), "unknown" or "-1"
 *   t_command      "T1A": the box and slot last selected by the printer
 * A slot is edited with the two commands the Creality interface sends:
 *   BOX_MODIFY_TN_DATA ADDR=<box> NUM=<A-D> PART=material_type DATA=<id>
 *   BOX_MODIFY_TN_DATA ADDR=<box> NUM=<A-D> PART=color_value DATA=0RRGGBB   (never with "#")
 */
(function () {
  "use strict";

  if (window.__power_cfs_panel_loaded) return;
  window.__power_cfs_panel_loaded = true;

  var CARD_ID = "power-cfs-card";
  var STYLE_ID = "power-cfs-style";
  var STORE_KEY = "power-cfs-panel";
  var POLL_MS = 3000;
  var POLL_ABSENT_MS = 30000;
  var MOUNT_MS = 1200;
  var AUTOFLOAT_MS = 15000;
  var VERIFY_MS = 2500;
  var VERIFY_TRIES = 3;
  var CUSTOM_FILE_URL = "/server/files/config/Helper-Script/cfs-custom-materials.json";
  var CUSTOM_REFRESH_MS = 30000;
  var DIAG_STATUS_URL = "/server/files/logs/cfs_diag.status";
  var DIAG_LOG_URL = "/server/files/logs/cfs_diag.log";
  var DIAG_LOGS_LIST_URL = "/server/files/list?root=logs";
  var MARGIN = 8;
  var SLOT_LETTERS = ["A", "B", "C", "D"];
  var PALETTE = ["#ffffff", "#2b2b2b", "#9ca3af", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

  // Bobina disegnata con tre immagini sovrapposte, come sullo schermo ADL Screen (88 pixel, mostrate a 44):
  // il filamento bianco preso come sagoma e colorato con il colore dello slot, le ombre sopra il filamento
  // e il telaio sopra a tutto. Nello slot vuoto si vede solo il telaio.
  var BOBINA_FILAMENTO = "data:image/png;base64,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";
  var BOBINA_OMBRE = "data:image/png;base64,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";
  var BOBINA_TELAIO = "data:image/png;base64,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";

  // id: [brand, name, type, default color, min temp, max temp, nozzle temp].
  // Source: material_database.json of the K1C (V2.3.5.34).
  var MATERIALS = {
    "01001": ["Creality", "Hyper PLA", "PLA", "#ffffff", 190, 240, 220],
    "02001": ["Creality", "Hyper PLA-CF", "PLA-CF", "#ffffff", 190, 240, 220],
    "06002": ["Creality", "Hyper PETG", "PETG", "", 220, 270, 250],
    "03001": ["Creality", "Hyper ABS", "ABS", "", 240, 280, 260],
    "04001": ["Creality", "CR-PLA", "PLA", "#ffffff", 190, 240, 220],
    "05001": ["Creality", "CR-Silk", "PLA", "#ffffff", 190, 240, 220],
    "06001": ["Creality", "CR-PETG", "PETG", "", 220, 270, 250],
    "07001": ["Creality", "CR-ABS", "ABS", "", 240, 280, 260],
    "00001": ["Generic", "Generic PLA", "PLA", "", 190, 240, 220],
    "00002": ["Generic", "Generic PLA-Silk", "PLA", "", 190, 240, 220],
    "00003": ["Generic", "Generic PETG", "PETG", "", 220, 270, 250],
    "00004": ["Generic", "Generic ABS", "ABS", "", 240, 280, 260],
    "00005": ["Generic", "Generic TPU", "TPU", "", 210, 240, 230],
    "00006": ["Generic", "Generic PLA-CF", "PLA-CF", "", 190, 240, 220],
    "00007": ["Generic", "Generic ASA", "ASA", "", 240, 280, 270],
    "08001": ["Creality", "Ender-PLA", "PLA", "#ffffff", 190, 240, 220],
    "09001": ["Creality", "EN-PLA+", "PLA", "#ffffff", 190, 240, 220],
    "10001": ["Creality", "HP-TPU", "TPU", "#ffffff", 190, 240, 220],
    "11001": ["Creality", "CR-Nylon", "PA", "#ffffff", 250, 270, 260],
    "13001": ["Creality", "CR-PLA Carbon", "PLA-CF", "#ffffff", 190, 240, 220],
    "14001": ["Creality", "CR-PLA Matte", "PLA", "#ffffff", 190, 240, 220],
    "15001": ["Creality", "CR-PLA Fluo", "PLA", "#ffffff", 190, 240, 230],
    "16001": ["Creality", "CR-TPU", "TPU", "#ffffff", 210, 240, 220],
    "17001": ["Creality", "CR-Wood", "PLA", "#ffffff", 190, 240, 230],
    "18001": ["Creality", "HP Ultra PLA", "PLA", "#ffffff", 190, 240, 230],
    "19001": ["Creality", "HP-ASA", "ASA", "#ffffff", 240, 280, 270],
    "00008": ["Generic", "Generic PA", "PA", "", 240, 260, 260],
    "00009": ["Generic", "Generic PA-CF", "PA-CF", "", 260, 300, 280],
    "00010": ["Generic", "Generic BVOH", "BVOH", "", 200, 220, 210],
    "00011": ["Generic", "Generic PVA", "PVA", "#ffffff", 215, 225, 220],
    "00012": ["Generic", "Generic HIPS", "HIPS", "", 220, 250, 240],
    "00013": ["Generic", "Generic PET-CF", "PET-CF", "", 280, 320, 290],
    "00014": ["Generic", "Generic PETG-CF", "PETG-CF", "", 240, 260, 250],
    "00015": ["Generic", "Generic PA6-CF", "PA-CF", "", 280, 300, 290],
    "00016": ["Generic", "Generic PAHT-CF", "PA-CF", "", 300, 320, 300],
    "00017": ["Generic", "Generic PPS", "PPS", "", 320, 350, 320],
    "00018": ["Generic", "Generic PPS-CF", "PPS-CF", "", 300, 350, 305],
    "00019": ["Generic", "Generic PP", "PP", "", 220, 260, 240],
    "00020": ["Generic", "Generic PET", "PET", "", 250, 270, 220],
    "00021": ["Generic", "Generic PC", "PC", "", 250, 270, 260],
    "12003": ["Creality", "Hyper PAHT-CF", "PA-CF", "", 280, 320, 300],
    "01601": ["Creality", "Soleyin Ultra PLA", "PLA", "#ffffff", 190, 240, 220],
    "06003": ["Creality", "Hyper PETG-CF", "PETG-CF", "", 240, 260, 250],
    "01004": ["Creality", "Hyper Stardust", "PLA", "#ffffff", 190, 240, 220],
    "01002": ["Creality", "Hyper L-W PLA", "PLA", "#ffffff", 200, 270, 220],
    "06004": ["Creality", "Hyper PETG-GF", "PETG-GF", "", 240, 260, 250],
    "29001": ["Creality", "Hyper Marble", "PLA", "#ffffff", 190, 240, 220],
    "01003": ["Creality", "Hyper Luminous", "PLA", "#ffffff", 190, 230, 220],
    "06005": ["Creality", "Soleyin Basic PETG", "PETG", "", 230, 250, 250]
  };

  // Material Design Icons paths (the same icon set Fluidd uses).
  var ICONS = {
    drop: "M12 3C12 3 5.5 10.2 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10.2 12 3 12 3z",
    thermo: "M10 4a2 2 0 0 1 4 0v9.3a4 4 0 1 1-4 0V4zm2 14.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
    chevronUp: "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z",
    undock: "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
    dock: "M4 4h16v10H4V4zm2 2v6h12V6H6zm5 12h2v2h-2v-2z",
    close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"
  };

  // ---------- Lingua ----------
  // Le scritte seguono la lingua scelta in Fluidd (Impostazioni > Generale > Lingua): italiano se e' italiano,
  // altrimenti inglese. {0}, {1} sono i valori inseriti da t().
  var TESTI = {
    en: {
      empty: "Empty", notSet: "Not set", materialId: "Material {0}", moonrakerHttp: "Moonraker answered HTTP {0}",
      undock: "Undock", dock: "Dock to the dashboard", collapse: "Collapse", expand: "Expand",
      channel: "Channel {0}", editSpool: "Edit this spool", disconnected: "CFS disconnected.",
      humidity: "Humidity {0}%", temperature: "Temperature {0}°C",
      refreshPrinting: "Refresh is not available while printing.",
      refreshRunning: "The CFS is checking every slot: it moves the filament a little.",
      refreshing: "REFRESHING...", refreshSlots: "REFRESH SLOTS",
      refreshTitle: "Check every slot again (spool present and RFID tag), like the Refresh button of the printer screen",
      refreshFailed: "The refresh could not be sent.", diagButton: "CFS DIAGNOSTICS",
      close: "Close", brand: "Brand", material: "Material", filament: "Filament", nozzle: "Nozzle", color: "Color",
      newFilament: "New filament", deleteFilament: "Delete this filament",
      printingNoEdit: "A print is in progress: the spools cannot be edited now.",
      cancel: "Cancel", save: "Save",
      confirmDelete: "Delete {0} from the database?\nThe spools that use it will show as an unknown material.",
      deleting: "Deleting...", noRemovalConfirm: "The printer did not confirm the removal.",
      removalFailed: "The removal could not be sent.", saved: "Saved.",
      notReported: "The CFS has not reported the change yet. Check the card in a few seconds.",
      readFailed: "Could not read the CFS.", saving: "Saving...", changeFailed: "The change could not be sent.",
      hintBase: "Pick the filament it looks like: the new one starts as a copy of it.",
      basedOn: "Based on", name: "Name", temp: "Temp (°C)", min: "Min", max: "Max", back: "Back", add: "Add",
      brandInvalid: "The brand needs letters, digits, spaces and . _ + - (24 characters at most).",
      nameInvalid: "The name needs letters, digits, spaces and . _ + - (24 characters at most).",
      tempsWhole: "The temperatures must be whole numbers between 150 and 350.",
      tempsOrder: "The temperatures must satisfy Min <= Nozzle <= Max.",
      exists: "{0} already exists.", adding: "Adding...",
      printingNoDb: "A print is in progress: the database cannot be changed now.",
      noNewConfirm: "The printer did not confirm the new filament.", addFailed: "The filament could not be added.",
      diagTitle: "CFS Diagnostics", deleteLog: "Delete log", previousLog: "Previous log", downloadLog: "Download log",
      working: "Working...", done: "Done.", noChangeConfirm: "The printer did not confirm the change.",
      changeNotMade: "The change could not be made.",
      stateUnreadable: "The state of the service could not be read.",
      stateMissing: "The service has not written its state yet: press Start.",
      logSize: "Log size: {0}", events: "Disconnections recorded: {0}", cfsState: "CFS: {0}",
      boxConnect: "connected", boxDisconnect: "disconnected",
      service: "Service", running: "Running", stopped: "Stopped: not logging and not recovering",
      log: "Log", on: "On", off: "Off", logOff: "Off: still watching and recovering",
      usbRecovery: "USB auto-recovery", start: "Start", stop: "Stop", turnOn: "Turn on", turnOff: "Turn off",
      confirmClean: "Delete the CFS Diagnostics log and its summary? This cannot be undone.",
      reading: "Reading..."
    },
    it: {
      empty: "Vuoto", notSet: "Non impostato", materialId: "Materiale {0}", moonrakerHttp: "Moonraker ha risposto HTTP {0}",
      undock: "Sgancia", dock: "Aggancia alla dashboard", collapse: "Riduci", expand: "Espandi",
      channel: "Canale {0}", editSpool: "Modifica questa bobina", disconnected: "CFS scollegato.",
      humidity: "Umidità {0}%", temperature: "Temperatura {0}°C",
      refreshPrinting: "Durante la stampa gli slot non si possono ricontrollare.",
      refreshRunning: "Il CFS sta controllando tutti gli slot: muove un po' il filamento.",
      refreshing: "CONTROLLO IN CORSO...", refreshSlots: "AGGIORNA SLOT",
      refreshTitle: "Ricontrolla tutti gli slot (bobina presente e chip RFID), come il pulsante Aggiorna dello schermo della stampante",
      refreshFailed: "Non è stato possibile inviare il controllo degli slot.", diagButton: "DIAGNOSTICA CFS",
      close: "Chiudi", brand: "Marca", material: "Materiale", filament: "Filamento", nozzle: "Ugello", color: "Colore",
      newFilament: "Nuovo filamento", deleteFilament: "Elimina questo filamento",
      printingNoEdit: "Stampa in corso: adesso le bobine non si possono modificare.",
      cancel: "Annulla", save: "Salva",
      confirmDelete: "Eliminare {0} dal database?\nLe bobine che lo usano risulteranno con un materiale sconosciuto.",
      deleting: "Eliminazione...", noRemovalConfirm: "La stampante non ha confermato l'eliminazione.",
      removalFailed: "Non è stato possibile inviare l'eliminazione.", saved: "Salvato.",
      notReported: "Il CFS non ha ancora segnalato la modifica. Ricontrolla la scheda fra qualche secondo.",
      readFailed: "Non è stato possibile leggere il CFS.", saving: "Salvataggio...",
      changeFailed: "Non è stato possibile inviare la modifica.",
      hintBase: "Scegli il filamento a cui assomiglia: quello nuovo parte come una sua copia.",
      basedOn: "Basato su", name: "Nome", temp: "Temp (°C)", min: "Min", max: "Max", back: "Indietro", add: "Aggiungi",
      brandInvalid: "La marca può avere lettere, numeri, spazi e . _ + - (al massimo 24 caratteri).",
      nameInvalid: "Il nome può avere lettere, numeri, spazi e . _ + - (al massimo 24 caratteri).",
      tempsWhole: "Le temperature devono essere numeri interi tra 150 e 350.",
      tempsOrder: "Le temperature devono rispettare Min <= Ugello <= Max.",
      exists: "{0} esiste già.", adding: "Aggiunta...",
      printingNoDb: "Stampa in corso: adesso il database non si può modificare.",
      noNewConfirm: "La stampante non ha confermato il nuovo filamento.",
      addFailed: "Non è stato possibile aggiungere il filamento.",
      diagTitle: "Diagnostica CFS", deleteLog: "Elimina registro", previousLog: "Registro precedente",
      downloadLog: "Scarica registro",
      working: "In corso...", done: "Fatto.", noChangeConfirm: "La stampante non ha confermato la modifica.",
      changeNotMade: "Non è stato possibile fare la modifica.",
      stateUnreadable: "Non è stato possibile leggere lo stato del servizio.",
      stateMissing: "Il servizio non ha ancora scritto il suo stato: premi Avvia.",
      logSize: "Registro: {0}", events: "Disconnessioni registrate: {0}", cfsState: "CFS: {0}",
      boxConnect: "collegato", boxDisconnect: "scollegato",
      service: "Servizio", running: "Attivo", stopped: "Fermo: non registra e non ripristina",
      log: "Registro", on: "Acceso", off: "Spento", logOff: "Spento: continua a sorvegliare e a ripristinare",
      usbRecovery: "Ripristino USB automatico", start: "Avvia", stop: "Ferma", turnOn: "Accendi", turnOff: "Spegni",
      confirmClean: "Eliminare il registro della Diagnostica CFS e il suo riepilogo? Non si può annullare.",
      reading: "Lettura..."
    }
  };

  // Lingua di Fluidd ("it", "en", ...); se Fluidd non la dice si usa quella del browser.
  function lingua() {
    var loc = "";
    try {
      var app = document.getElementById("app");
      loc = app && app.__vue__ && app.__vue__.$i18n && app.__vue__.$i18n.locale;
    } catch (e) {}
    if (!loc) loc = navigator.language || "en";
    return String(loc).toLowerCase().indexOf("it") === 0 ? "it" : "en";
  }

  function t(key) {
    var table = TESTI[lingua()];
    var text = table[key] !== undefined ? table[key] : (TESTI.en[key] !== undefined ? TESTI.en[key] : key);
    for (var i = 1; i < arguments.length; i++) text = text.split("{" + (i - 1) + "}").join(String(arguments[i]));
    return text;
  }

  var card, badgesEl, bodyEl, collapseBtn, modeBtn, headEl;
  var lastLingua = "";
  var modal = null;
  var prefs = { mode: "docked", x: null, y: null, collapsed: false };
  var latest = null;
  var CUSTOM = {};          // ids of the custom filaments (from cfs-custom-materials.json)
  var macrosReady = false;  // the CFS_ADD_MATERIAL macro exists (module "CFS Custom Filaments" installed)
  var diagReady = false;    // the CFS_DIAG_LOG_ON macro exists (module "CFS Diagnostics" installed and up to date)
  var refreshReady = false; // the BOX_INFO_REFRESH macro exists (Creality's own macro, also in the Power Macros)
  var refreshing = false;   // a refresh of the slots is running
  var refreshError = "";
  var lastSignature = "";
  var pollTimer = null;
  var noDockSince = 0;
  var autoFloat = false;

  // ---------- Storage (per browser, never required) ----------

  function loadPrefs() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || "null");
      if (saved && typeof saved === "object") {
        if (saved.mode === "floating") prefs.mode = "floating";
        if (typeof saved.x === "number" && typeof saved.y === "number") {
          prefs.x = saved.x;
          prefs.y = saved.y;
        }
        prefs.collapsed = !!saved.collapsed;
      }
    } catch (e) {}
  }

  function savePrefs() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }

  // ---------- Data ----------

  function isNone(s) {
    return s === "" || s === "-1" || s === "none" || s === "None" || s === undefined || s === null;
  }

  // Accepts "#RRGGBB", "RRGGBB" and "0RRGGBB". Returns "#rrggbb" or "".
  function parseColor(raw) {
    var s = String(raw === undefined || raw === null ? "" : raw).trim();
    if (s.charAt(0) === "#") s = s.slice(1);
    else if (s.length === 7 && s.charAt(0) === "0") s = s.slice(1);
    return /^[0-9a-fA-F]{6}$/.test(s) ? "#" + s.toLowerCase() : "";
  }

  function parseLength(raw) {
    var s = String(raw === undefined || raw === null ? "" : raw);
    return /^[0-9]+$/.test(s) ? parseInt(s, 10) : -1;
  }

  function parseNumber(raw) {
    var n = Number(raw);
    return raw !== "" && raw !== null && raw !== undefined && isFinite(n) && n >= 0 ? Math.round(n) : null;
  }

  function fieldAt(list, i) {
    return list && list[i] !== undefined && list[i] !== null ? String(list[i]) : "";
  }

  function parseSlot(unit, i) {
    var vender = fieldAt(unit.vender, i);
    var mat = fieldAt(unit.material_type, i);
    var col = fieldAt(unit.color_value, i);
    var slot = {
      kind: "empty", id: "", title: t("empty"), detail: "", color: parseColor(col), remain: parseLength(fieldAt(unit.remain_len, i))
    };

    // The box keeps the last color and material of an emptied slot; "vender: none" is what says nothing is loaded
    // ("unknown" means filament present without an RFID chip).
    if (vender === "none") {
      slot.color = "";
      slot.remain = parseLength("");
      return slot;
    }

    var hasMaterial = !isNone(mat) && mat !== "unknown";
    var hasVender = !isNone(vender) && vender !== "unknown";
    var anyUnknown = vender === "unknown" || mat === "unknown" || col === "unknown";

    if (hasMaterial) {
      slot.kind = "defined";
      slot.id = mat;
      var entry = MATERIALS[mat] || (/^1[0-9]{5}$/.test(mat) ? MATERIALS[mat.slice(1)] : undefined);
      if (entry) {
        slot.title = entry[2] || entry[1];
        // "Generic PLA" only repeats the type: show the name for the branded materials.
        slot.detail = entry[0] === "Generic" ? "" : entry[0] + " " + entry[1];
        if (!slot.color) slot.color = parseColor(entry[3]);
      } else {
        slot.title = t("materialId", mat);
      }
      if (hasVender && !slot.detail) slot.detail = vender;
    } else if (slot.color || anyUnknown || hasVender) {
      slot.kind = "unset";
      slot.title = t("notSet");
      if (hasVender) slot.detail = vender;
    }
    return slot;
  }

  // Returns null when the printer has no CFS object, otherwise { connected, printing, units: [...] }.
  function parseStatus(status) {
    var box = status && status.box;
    if (!box || typeof box !== "object") return null;
    var printState = status.print_stats && status.print_stats.state;
    var result = { connected: box.state === "connect", printing: printState === "printing" || printState === "paused", units: [] };
    if (!result.connected) return result;

    var active = null;
    var tCommand = String(box.t_command || "");
    if (/^T[1-4][A-Da-d]$/.test(tCommand)) {
      active = { box: parseInt(tCommand.charAt(1), 10), slot: tCommand.charAt(2).toUpperCase().charCodeAt(0) - 65 };
    }

    for (var n = 1; n <= 4; n++) {
      var unit = box["T" + n];
      if (!unit || typeof unit !== "object" || unit.state !== "connect") continue;
      var slots = [];
      for (var i = 0; i < 4; i++) slots.push(parseSlot(unit, i));
      var version = String(unit.version || "");
      result.units.push({
        id: n,
        version: version === "-1" ? "" : version,
        humidity: parseNumber(unit.dry_and_humidity),
        temperature: parseNumber(unit.temperature),
        active: active && active.box === n ? active.slot : -1,
        slots: slots
      });
    }
    return result;
  }

  function fetchStatus() {
    return fetch("/printer/objects/query?box&print_stats", { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (json) {
        return parseStatus(json && json.result && json.result.status);
      });
  }

  function runScript(script) {
    return fetch("/printer/gcode/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ script: script })
    }).then(function (response) {
      if (!response.ok) throw new Error(t("moonrakerHttp", response.status));
    });
  }

  // The custom filaments live in a file of the config folder (written by the CFS Custom Filaments
  // module): merge them into the table of materials.
  // Resolves true when the list was read. Only a missing file (404: nothing was ever added) empties the
  // list: when Moonraker is busy or restarting the filaments already known are kept and false is returned.
  function loadCustom() {
    return fetch(CUSTOM_FILE_URL + "?t=" + Date.now(), { credentials: "same-origin", cache: "no-store" })
      .then(function (response) {
        if (response.status === 404) return { materials: [] };
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (json) {
        Object.keys(CUSTOM).forEach(function (id) { delete MATERIALS[id]; });
        CUSTOM = {};
        var list = json && Array.isArray(json.materials) ? json.materials : [];
        list.forEach(function (m) {
          if (!m || !/^9[0-9]{4}$/.test(String(m.id))) return;
          MATERIALS[m.id] = [String(m.brand), String(m.name), String(m.type), parseColor(m.color), Number(m.min) || 0, Number(m.max) || 0, Number(m.nozzle) || 0];
          CUSTOM[m.id] = true;
        });
        return true;
      })
      .catch(function () { return false; });
  }

  function checkMacros() {
    return fetch("/printer/objects/list", { credentials: "same-origin" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (json) {
        var objects = json && json.result && json.result.objects;
        macrosReady = Array.isArray(objects) && objects.indexOf("gcode_macro CFS_ADD_MATERIAL") >= 0;
        var diag = Array.isArray(objects) && objects.indexOf("gcode_macro CFS_DIAG_LOG_ON") >= 0;
        var refresh = Array.isArray(objects) && objects.indexOf("gcode_macro BOX_INFO_REFRESH") >= 0;
        if (diag !== diagReady || refresh !== refreshReady) lastSignature = "";   // the buttons appear or disappear at the next render
        diagReady = diag;
        refreshReady = refresh;
      })
      .catch(function () {});
  }

  // Calls check() until it answers true: the helper of the printer works on its own, after the macro returned.
  function waitFor(check, tries, delay) {
    return check().then(function (done) {
      if (done || tries <= 1) return done;
      return new Promise(function (resolve) { window.setTimeout(resolve, delay); }).then(function () { return waitFor(check, tries - 1, delay); });
    });
  }

  // The helper writes its result (OK: or ERROR:) in the console of Klipper.
  function lastHelperMessage() {
    return fetch("/server/gcode_store?count=30", { credentials: "same-origin" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (json) {
        var lines = (json && json.result && json.result.gcode_store) || [];
        for (var i = lines.length - 1; i >= 0; i--) {
          var text = String(lines[i].message || "");
          if (/^(\/\/ )?ERROR: /.test(text)) return text.replace(/^\/\/ /, "");
        }
        return "";
      })
      .catch(function () { return ""; });
  }

  // ---------- Interface helpers ----------

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svg(path, className) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    if (className) s.setAttribute("class", className);
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", path);
    s.appendChild(p);
    return s;
  }

  // Round icon button built with the Vuetify classes Fluidd uses, so it looks like its own.
  function iconButton(path, title) {
    var btn = el("button", "v-btn v-btn--icon v-btn--round theme--dark v-size--default");
    btn.type = "button";
    btn.title = title;
    var content = el("span", "v-btn__content");
    var ic = el("span", "v-icon notranslate v-icon--dense theme--dark");
    ic.appendChild(svg(path, "v-icon__svg"));
    content.appendChild(ic);
    btn.appendChild(content);
    return btn;
  }

  function setButtonIcon(btn, path) {
    var holder = btn.querySelector(".v-icon");
    if (!holder) return;
    holder.textContent = "";
    holder.appendChild(svg(path, "v-icon__svg"));
  }

  function textButton(label, primary) {
    var btn = el("button", "v-btn theme--dark v-size--default " + (primary ? "v-btn--has-bg primary" : "v-btn--text"));
    btn.type = "button";
    btn.appendChild(el("span", "v-btn__content", label));
    return btn;
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var c = "#" + CARD_ID;
    var muted = "rgba(255,255,255,.6)";
    var line = "rgba(255,255,255,.1)";
    var css = [
      c + "{overflow:hidden}",
      c + " *{box-sizing:border-box}",
      c + ".pcfs-floating{position:fixed;z-index:1000;width:min(420px,calc(100vw - 16px));margin:0!important;box-shadow:none!important;font-family:Roboto,sans-serif;font-size:1rem;line-height:1.5}",
      c + ".pcfs-floating .card-heading{cursor:grab;touch-action:none;user-select:none}",
      c + ".pcfs-floating.pcfs-dragging .card-heading{cursor:grabbing}",
      c + " .pcfs-body{padding:16px}",
      c + ".pcfs-collapsed .pcfs-body{display:none}",
      c + " .pcfs-row{display:flex;align-items:center;gap:8px}",
      c + " .pcfs-badge{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.06);padding:6px 12px;border-radius:16px;font-size:.8125rem;font-weight:500;line-height:1}",
      c + " .pcfs-badge svg{width:16px;height:16px;fill:currentColor}",
      c + " .pcfs-badge.humidity{color:var(--v-info-base,#2196f3)}",
      c + " .pcfs-badge.temperature{color:var(--v-warning-base,#fb8c00)}",
      c + " .pcfs-chevron svg{transition:transform .2s ease}",
      c + ".pcfs-collapsed .pcfs-chevron svg{transform:rotate(180deg)}",
      c + " .pcfs-unit-title{display:flex;justify-content:space-between;color:" + muted + ";font-size:.75rem;font-weight:500;letter-spacing:.05em;text-transform:uppercase;margin:0 0 8px}",
      c + " .pcfs-unit-title:not(:first-child){margin-top:16px}",
      c + " .pcfs-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
      c + " .pcfs-tile{position:relative;background:rgba(255,255,255,.04);border:1px solid " + line + ";border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px;min-width:0;cursor:pointer;transition:background .2s ease,border-color .2s ease}",
      c + " .pcfs-tile:hover{background:rgba(255,255,255,.08)}",
      c + " .pcfs-tile.active{border-color:var(--pcfs-spool,var(--v-success-base,#4caf50))}",
      c + " .pcfs-tile.empty{opacity:.5;cursor:default}",
      c + " .pcfs-tile.empty:hover{background:rgba(255,255,255,.04)}",
      c + " .pcfs-dot{position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--v-success-base,#4caf50);box-shadow:0 0 5px var(--v-success-base,#4caf50)}",
      c + " .pcfs-spool{position:relative;width:44px;height:44px;flex:none}",
      c + " .pcfs-spool span{position:absolute;top:0;left:0;width:100%;height:100%;background-position:center;background-size:contain;background-repeat:no-repeat}",
      c + " .pcfs-spool .pcfs-spool-filamento{background-color:var(--pcfs-spool,#4b5563);-webkit-mask:url(" + BOBINA_FILAMENTO + ") center/contain no-repeat;mask:url(" + BOBINA_FILAMENTO + ") center/contain no-repeat}",
      c + " .pcfs-spool .pcfs-spool-ombre{background-image:url(" + BOBINA_OMBRE + ")}",
      c + " .pcfs-spool .pcfs-spool-telaio{background-image:url(" + BOBINA_TELAIO + ")}",
      c + " .pcfs-tile.empty .pcfs-spool-filamento," + c + " .pcfs-tile.empty .pcfs-spool-ombre{display:none}",
      c + " .pcfs-info{display:flex;flex-direction:column;min-width:0}",
      c + " .pcfs-channel{font-size:.6875rem;color:" + muted + ";font-weight:500;letter-spacing:.05em;text-transform:uppercase}",
      c + " .pcfs-type{font-size:1.125rem;font-weight:500;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      c + " .pcfs-detail{font-size:.75rem;color:" + muted + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      c + " .pcfs-note{color:" + muted + ";padding:4px 2px}",
      c + " .pcfs-footer{display:flex;justify-content:flex-end;align-items:center;flex-wrap:wrap;gap:8px;margin-top:16px}",
      c + " .pcfs-footer-note{color:" + muted + ";font-size:.75rem;margin-right:auto}",
      c + " .pcfs-footer-note.error{color:#ff5252}",
      "@media (max-width:480px){" + c + " .pcfs-grid{grid-template-columns:1fr}}",

      ".pcfs-overlay{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Roboto,sans-serif;font-size:1rem;line-height:1.5}",
      ".pcfs-dialog{width:min(440px,100%);max-height:100%;overflow:auto;box-shadow:none!important}",
      ".pcfs-dialog *{box-sizing:border-box}",
      ".pcfs-dialog .pcfs-dialog-head{display:flex;align-items:center;justify-content:space-between;padding:8px 8px 8px 16px;border-bottom:thin solid " + line + ";font-size:1.125rem}",
      ".pcfs-dialog .pcfs-dialog-body{padding:16px;display:flex;flex-direction:column;gap:14px}",
      ".pcfs-dialog .pcfs-field{display:grid;grid-template-columns:96px 1fr;align-items:center;gap:12px}",
      ".pcfs-dialog label{color:" + muted + ";font-size:.875rem}",
      ".pcfs-dialog select{width:100%;appearance:none;background:rgba(255,255,255,.06);color:inherit;border:1px solid " + line + ";border-radius:4px;padding:8px 10px;font:inherit;font-size:.875rem;outline:none}",
      ".pcfs-dialog select:focus{border-color:var(--v-primary-base,#2196f3)}",
      ".pcfs-dialog select option{background:#262629;color:#fff}",
      ".pcfs-dialog .pcfs-temps{color:" + muted + ";font-size:.875rem}",
      ".pcfs-dialog .pcfs-colorrow{display:flex;align-items:center;gap:12px;margin-bottom:14px}",
      ".pcfs-dialog .pcfs-swatch{width:36px;height:36px;border-radius:50%;border:2px solid " + line + ";padding:0;overflow:hidden;cursor:pointer;background:none}",
      ".pcfs-dialog .pcfs-swatch input{width:200%;height:200%;margin:-25%;padding:0;border:0;cursor:pointer;background:none}",
      ".pcfs-dialog .pcfs-hex{font-size:.875rem;color:" + muted + ";font-variant-numeric:tabular-nums}",
      ".pcfs-dialog .pcfs-palette{display:flex;gap:8px;flex-wrap:wrap}",
      ".pcfs-dialog .pcfs-chip{width:22px;height:22px;border-radius:50%;border:2px solid " + line + ";padding:0;cursor:pointer}",
      ".pcfs-dialog .pcfs-status{min-height:1.5em;font-size:.875rem;color:" + muted + "}",
      ".pcfs-dialog .pcfs-status.error{color:var(--v-error-base,#ff5252)}",
      ".pcfs-dialog .pcfs-status.ok{color:var(--v-success-base,#4caf50)}",
      ".pcfs-dialog .pcfs-actions{display:flex;justify-content:flex-end;gap:8px;padding:8px 16px 16px}",
      ".pcfs-dialog input[type=text],.pcfs-dialog input[type=number]{width:100%;background:rgba(255,255,255,.06);color:inherit;border:1px solid " + line + ";border-radius:4px;padding:8px 10px;font:inherit;font-size:.875rem;outline:none}",
      ".pcfs-dialog input[type=text]:focus,.pcfs-dialog input[type=number]:focus{border-color:var(--v-primary-base,#2196f3)}",
      ".pcfs-dialog .pcfs-extra{display:flex;justify-content:flex-end;gap:8px;margin-top:-6px}",
      ".pcfs-dialog .pcfs-temprow{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}",
      ".pcfs-dialog .pcfs-tempcell label{display:block;font-size:.75rem;margin-bottom:2px}",
      ".pcfs-dialog .pcfs-hint{color:" + muted + ";font-size:.8125rem}",
      ".pcfs-dialog .v-btn[disabled]{opacity:.4;pointer-events:none}",
      ".pcfs-dialog.pcfs-busy .v-btn{opacity:.4;pointer-events:none}",
      ".pcfs-dialog .pcfs-diagrow{display:flex;align-items:center;justify-content:space-between;gap:12px}",
      ".pcfs-dialog .pcfs-diagleft{display:flex;align-items:baseline;gap:1.4em;min-width:0}",
      ".pcfs-dialog .pcfs-diagname{font-weight:500;white-space:nowrap}",
      ".pcfs-dialog .pcfs-diagname::after{content:\":\"}",
      ".pcfs-dialog .pcfs-diagstate{font-size:.875rem;color:" + muted + "}",
      ".pcfs-dialog .pcfs-diagstate.on{color:var(--v-success-base,#4caf50)}",
      ".pcfs-dialog .pcfs-diagstate.off{color:var(--v-warning-base,#fb8c00)}",
      ".pcfs-dialog a.v-btn{text-decoration:none}"
    ].join("");
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- Card ----------

  function build() {
    card = el("div", "mb-2 mb-md-4 v-card v-sheet theme--dark rounded-md collapsable-card");
    card.id = CARD_ID;

    headEl = el("header", "v-card__title collapsable-card-title card-heading");
    var row = el("div", "row flex-nowrap no-gutters align-center");
    row.style.width = "100%";
    row.style.margin = "0";

    var title = el("div", "text-no-wrap col align-self-center");
    title.appendChild(el("span", "font-weight-light", "CFS"));
    row.appendChild(title);

    badgesEl = el("div", "col col-auto align-self-center pcfs-row");
    row.appendChild(badgesEl);

    var buttons = el("div", "col col-auto align-self-center pcfs-row");
    modeBtn = iconButton(ICONS.undock, t("undock"));
    modeBtn.addEventListener("click", toggleMode);
    collapseBtn = iconButton(ICONS.chevronUp, t("collapse"));
    collapseBtn.className += " pcfs-chevron";
    collapseBtn.addEventListener("click", toggleCollapsed);
    buttons.appendChild(modeBtn);
    buttons.appendChild(collapseBtn);
    row.appendChild(buttons);

    headEl.appendChild(row);
    bodyEl = el("div", "v-card__text pcfs-body");
    card.appendChild(headEl);
    card.appendChild(bodyEl);

    applyCollapsed();
    updateModeButton();
    enableDrag();
  }

  function isFloating() {
    return prefs.mode === "floating" || autoFloat;
  }

  function updateModeButton() {
    if (!modeBtn) return;
    var floating = isFloating();
    setButtonIcon(modeBtn, floating ? ICONS.dock : ICONS.undock);
    modeBtn.title = floating ? t("dock") : t("undock");
  }

  function toggleMode() {
    prefs.mode = isFloating() ? "docked" : "floating";
    autoFloat = false;
    noDockSince = 0;
    updateModeButton();
    ensureMounted();
    savePrefs();
  }

  function applyCollapsed() {
    // "collapsed" is the class Fluidd gives its own collapsed cards (it removes the title shadow).
    card.classList.toggle("collapsed", prefs.collapsed);
    card.classList.toggle("pcfs-collapsed", prefs.collapsed);
    collapseBtn.title = prefs.collapsed ? t("expand") : t("collapse");
  }

  function toggleCollapsed() {
    prefs.collapsed = !prefs.collapsed;
    applyCollapsed();
    if (isFloating()) clampPosition();
    savePrefs();
  }

  // ---------- Floating card ----------

  function clampPosition() {
    var maxX = Math.max(MARGIN, window.innerWidth - card.offsetWidth - MARGIN);
    var maxY = Math.max(MARGIN, window.innerHeight - card.offsetHeight - MARGIN);
    if (prefs.x === null || prefs.y === null) {
      // First time: bottom right corner.
      prefs.x = maxX - 10;
      prefs.y = maxY - 10;
    }
    prefs.x = Math.min(Math.max(MARGIN, prefs.x), maxX);
    prefs.y = Math.min(Math.max(MARGIN, prefs.y), maxY);
    card.style.left = prefs.x + "px";
    card.style.top = prefs.y + "px";
  }

  function enableDrag() {
    var startX = 0, startY = 0, originX = 0, originY = 0, dragging = false;

    headEl.addEventListener("pointerdown", function (event) {
      if (!isFloating()) return;
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target && event.target.closest && event.target.closest("button")) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      originX = prefs.x;
      originY = prefs.y;
      card.classList.add("pcfs-dragging");
      try { headEl.setPointerCapture(event.pointerId); } catch (e) {}
      event.preventDefault();
    });

    headEl.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      prefs.x = originX + event.clientX - startX;
      prefs.y = originY + event.clientY - startY;
      clampPosition();
    });

    function stop(event) {
      if (!dragging) return;
      dragging = false;
      card.classList.remove("pcfs-dragging");
      try { headEl.releasePointerCapture(event.pointerId); } catch (e) {}
      savePrefs();
    }
    headEl.addEventListener("pointerup", stop);
    headEl.addEventListener("pointercancel", stop);

    window.addEventListener("resize", function () {
      if (card && isFloating()) clampPosition();
    });
  }

  // ---------- Placement ----------

  function onDashboard() {
    var path = String(window.location.pathname || "").replace(/\/+$/, "");
    var hash = String(window.location.hash || "").replace(/\?.*$/, "").replace(/\/+$/, "");
    return (!path || path === "/") && (!hash || hash === "#" || hash === "#/");
  }

  // The card goes right after the draggable list of Fluidd, not inside it: Fluidd (vuedraggable)
  // counts the children of that list when the user reorders its cards.
  function findDock() {
    var lists = document.querySelectorAll("main .app-draggable.list-group");
    if (!lists.length) return null;
    var chosen = lists[0];
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].querySelector("[role='tablist'], .v-tabs")) {
        chosen = lists[i];
        break;
      }
    }
    return chosen.parentNode ? { list: chosen, column: chosen.parentNode } : null;
  }

  function ensureMounted() {
    if (!card) return;

    if (autoFloat && prefs.mode === "docked" && findDock()) {
      autoFloat = false;
      updateModeButton();
    }

    if (isFloating()) {
      if (card.parentNode !== document.body) {
        document.body.appendChild(card);
        card.classList.add("pcfs-floating");
      }
      clampPosition();
      return;
    }

    card.classList.remove("pcfs-floating");
    card.style.left = "";
    card.style.top = "";

    if (!onDashboard()) {
      if (card.parentNode) card.parentNode.removeChild(card);
      noDockSince = 0;
      return;
    }

    var dock = findDock();
    if (!dock) {
      // The dashboard did not show up (other layout, slow page): show the card floating meanwhile.
      if (!noDockSince) noDockSince = Date.now();
      else if (Date.now() - noDockSince > AUTOFLOAT_MS) {
        autoFloat = true;
        updateModeButton();
        ensureMounted();
      }
      return;
    }
    noDockSince = 0;
    if (card.parentNode !== dock.column) {
      dock.column.insertBefore(card, dock.list.nextSibling);
    }
  }

  // ---------- Rendering ----------

  function renderUnit(unit, multiple) {
    var frag = document.createDocumentFragment();
    if (multiple) {
      var title = el("div", "pcfs-unit-title");
      title.appendChild(el("span", "", "Box " + unit.id));
      title.appendChild(el("span", "", unit.version ? "firmware " + unit.version : ""));
      frag.appendChild(title);
    }
    var grid = el("div", "pcfs-grid");
    unit.slots.forEach(function (slot, i) {
      var tile = el("div", "pcfs-tile" + (slot.kind === "empty" ? " empty" : "") + (unit.active === i ? " active" : ""));
      if (slot.color) tile.style.setProperty("--pcfs-spool", slot.color);
      var spool = el("div", "pcfs-spool");
      spool.appendChild(el("span", "pcfs-spool-filamento"));
      spool.appendChild(el("span", "pcfs-spool-ombre"));
      spool.appendChild(el("span", "pcfs-spool-telaio"));
      tile.appendChild(spool);
      var info = el("div", "pcfs-info");
      info.appendChild(el("span", "pcfs-channel", t("channel", unit.id + SLOT_LETTERS[i])));
      info.appendChild(el("span", "pcfs-type", slot.title));
      var detail = [];
      if (slot.detail) detail.push(slot.detail);
      if (slot.remain >= 0) detail.push(slot.remain + " m");
      if (detail.length) info.appendChild(el("span", "pcfs-detail", detail.join(", ")));
      tile.appendChild(info);
      if (unit.active === i) tile.appendChild(el("div", "pcfs-dot"));
      if (slot.kind !== "empty") {
        tile.title = t("editSpool");
        tile.addEventListener("click", function () { openEditor(unit, i); });
      }
      grid.appendChild(tile);
    });
    frag.appendChild(grid);
    return frag;
  }

  function badge(kind, path, text, title) {
    var b = el("div", "pcfs-badge " + kind);
    b.title = title;
    b.appendChild(svg(path));
    b.appendChild(el("span", "", text));
    return b;
  }

  function render(data) {
    var lang = lingua();
    if (lang !== lastLingua) {
      // Cambiata la lingua in Fluidd: anche i titoli dei pulsanti della scheda
      lastLingua = lang;
      updateModeButton();
      applyCollapsed();
    }
    var signature = lang + "|" + JSON.stringify(data) + "|" + diagReady + "|" + refreshReady + "|" + refreshing + "|" + refreshError;
    if (signature === lastSignature) return;
    lastSignature = signature;

    bodyEl.textContent = "";
    badgesEl.textContent = "";

    if (!data.connected || !data.units.length) {
      bodyEl.appendChild(el("div", "pcfs-note", t("disconnected")));
    } else {
      var first = data.units[0];
      if (first.humidity !== null) badgesEl.appendChild(badge("humidity", ICONS.drop, first.humidity + "%", t("humidity", first.humidity)));
      if (first.temperature !== null) badgesEl.appendChild(badge("temperature", ICONS.thermo, first.temperature + "°C", t("temperature", first.temperature)));
      data.units.forEach(function (unit) {
        bodyEl.appendChild(renderUnit(unit, data.units.length > 1));
      });
    }
    var showRefresh = refreshReady && data.connected && data.units.length > 0;
    if (diagReady || showRefresh) {
      var footer = el("div", "pcfs-footer");
      if (showRefresh) {
        if (refreshError) footer.appendChild(el("span", "pcfs-footer-note error", refreshError));
        else if (data.printing) footer.appendChild(el("span", "pcfs-footer-note", t("refreshPrinting")));
        else if (refreshing) footer.appendChild(el("span", "pcfs-footer-note", t("refreshRunning")));
        var refreshBtn = textButton(refreshing ? t("refreshing") : t("refreshSlots"), false);
        refreshBtn.title = t("refreshTitle");
        if (data.printing || refreshing) {
          refreshBtn.disabled = true;
          refreshBtn.className += " v-btn--disabled";
        } else {
          refreshBtn.addEventListener("click", function () { refreshSlots(data); });
        }
        footer.appendChild(refreshBtn);
      }
      if (diagReady) {
        var diagBtn = textButton(t("diagButton"), false);
        diagBtn.addEventListener("click", openDiagnostics);
        footer.appendChild(diagBtn);
      }
      bodyEl.appendChild(footer);
    }
    if (card && isFloating() && card.parentNode) clampPosition();
  }

  // The same command the printer screen sends: BOX_INFO_REFRESH ADDR=<box> NUM=15 (15 = every slot) pre-loads
  // each slot (the CFS moves the filament a little to see if a spool is there) and reads its RFID tag and length.
  // It is never sent while printing.
  function refreshSlots(data) {
    if (refreshing || !data || data.printing) return;
    refreshing = true;
    refreshError = "";
    lastSignature = "";
    if (latest) render(latest);
    var chain = Promise.resolve();
    data.units.forEach(function (unit) {
      chain = chain.then(function () { return runScript("BOX_INFO_REFRESH ADDR=" + unit.id + " NUM=15"); });
    });
    chain.catch(function (error) {
      refreshError = error && error.message ? error.message : t("refreshFailed");
      window.setTimeout(function () { refreshError = ""; lastSignature = ""; if (latest) render(latest); }, 8000);
    }).then(function () {
      refreshing = false;
      lastSignature = "";
      schedule(0);
    });
  }

  function removeCard() {
    closeEditor();
    if (card && card.parentNode) card.parentNode.removeChild(card);
    card = null;
    lastSignature = "";
    noDockSince = 0;
  }

  // ---------- Slot editor ----------

  function closeEditor() {
    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
    modal = null;
  }

  function uniq(list) {
    return list.filter(function (value, i) { return list.indexOf(value) === i; });
  }

  function materialIds() {
    return Object.keys(MATERIALS);
  }

  function brandsList() {
    return uniq(materialIds().map(function (id) { return MATERIALS[id][0]; }));
  }

  // The usual materials first, the rest in the order of the database.
  var TYPE_ORDER = ["PLA", "PETG", "ABS", "ASA", "TPU", "PA", "PC"];

  function sortTypes(types) {
    var rank = function (type) { var i = TYPE_ORDER.indexOf(type); return i < 0 ? TYPE_ORDER.length + types.indexOf(type) : i; };
    return types.slice().sort(function (a, b) { return rank(a) - rank(b); });
  }

  function typesList(brand) {
    return sortTypes(uniq(materialIds().filter(function (id) { return MATERIALS[id][0] === brand; }).map(function (id) { return MATERIALS[id][2]; })));
  }

  function allTypes() {
    return sortTypes(uniq(materialIds().map(function (id) { return MATERIALS[id][2]; })));
  }

  function namesList(brand, type) {
    return materialIds().filter(function (id) { return MATERIALS[id][0] === brand && MATERIALS[id][2] === type; });
  }

  function fillSelect(select, values, labels, selected) {
    select.textContent = "";
    values.forEach(function (value, i) {
      var option = el("option", "", labels ? labels[i] : value);
      option.value = value;
      if (value === selected) option.selected = true;
      select.appendChild(option);
    });
    if (selected !== undefined && values.indexOf(selected) >= 0) select.value = selected;
  }

  function field(label, control) {
    var row = el("div", "pcfs-field");
    row.appendChild(el("label", "", label));
    row.appendChild(control);
    return row;
  }

  // Color picker with a palette. onChange(value, byUser) is called on every change.
  function colorControl(initial, onChange) {
    var swatch = el("label", "pcfs-swatch");
    var picker = el("input");
    picker.type = "color";
    swatch.appendChild(picker);
    var hex = el("span", "pcfs-hex");
    var row = el("div", "pcfs-colorrow");
    row.appendChild(swatch);
    row.appendChild(hex);
    var palette = el("div", "pcfs-palette");
    var box = el("div");
    var api = {
      box: box,
      set: function (value, byUser) {
        picker.value = value;
        swatch.style.background = value;
        hex.textContent = value.toUpperCase();
        if (onChange) onChange(value, !!byUser);
      }
    };
    PALETTE.forEach(function (value) {
      var chip = el("button", "pcfs-chip");
      chip.type = "button";
      chip.title = value;
      chip.style.background = value;
      chip.addEventListener("click", function () { api.set(value, true); });
      palette.appendChild(chip);
    });
    picker.addEventListener("input", function () { api.set(picker.value, true); });
    box.appendChild(row);
    box.appendChild(palette);
    api.set(initial, false);
    return api;
  }

  function openEditor(unit, index, selectId) {
    closeEditor();
    var slot = unit.slots[index];
    var num = SLOT_LETTERS[index];

    var startId = MATERIALS[selectId] ? selectId : slot.id;
    var current = MATERIALS[startId];
    var brand = current ? current[0] : "Generic";
    var type = current ? current[2] : (typesList(brand)[0] || "");
    var materialId = current ? startId : (namesList(brand, type)[0] || "");
    // A filament just created comes with its own color; otherwise the spool keeps the one it has.
    var color = (selectId ? "" : slot.color) || parseColor(MATERIALS[materialId] && MATERIALS[materialId][3]) || "#ffffff";
    var colorTouched = !selectId && !!slot.color;
    var busy = false;

    modal = el("div", "pcfs-overlay");
    var dialog = el("div", "pcfs-dialog v-card v-sheet theme--dark rounded-md");
    modal.appendChild(dialog);

    var head = el("div", "pcfs-dialog-head");
    head.appendChild(el("span", "font-weight-light", t("channel", unit.id + num)));
    var closeBtn = iconButton(ICONS.close, t("close"));
    head.appendChild(closeBtn);
    dialog.appendChild(head);

    var body = el("div", "pcfs-dialog-body");
    var brandSel = el("select");
    var typeSel = el("select");
    var nameSel = el("select");
    var temps = el("div", "pcfs-temps");
    body.appendChild(field(t("brand"), brandSel));
    body.appendChild(field(t("material"), typeSel));
    body.appendChild(field(t("filament"), nameSel));
    var extraRow = el("div", "pcfs-extra");
    var newBtn = textButton(t("newFilament"), false);
    var delBtn = textButton(t("deleteFilament"), false);
    extraRow.appendChild(newBtn);
    extraRow.appendChild(delBtn);
    body.appendChild(extraRow);
    body.appendChild(field(t("nozzle"), temps));

    var cc = colorControl(color, function (value, byUser) {
      color = value;
      if (byUser) colorTouched = true;
    });
    body.appendChild(field(t("color"), cc.box));

    var status = el("div", "pcfs-status");
    if (latest && latest.printing) {
      status.textContent = t("printingNoEdit");
      status.className += " error";
    }
    body.appendChild(status);
    dialog.appendChild(body);

    var actions = el("div", "pcfs-actions");
    var cancelBtn = textButton(t("cancel"), false);
    var saveBtn = textButton(t("save"), true);
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    dialog.appendChild(actions);

    function setStatus(text, kind) {
      status.textContent = text;
      status.className = "pcfs-status" + (kind ? " " + kind : "");
    }

    function refreshInfo() {
      var entry = MATERIALS[materialId];
      temps.textContent = entry && entry[4] && entry[5] ? entry[4] + " - " + entry[5] + " °C" : "-";
      newBtn.style.display = macrosReady ? "" : "none";
      delBtn.style.display = macrosReady && CUSTOM[materialId] ? "" : "none";
      extraRow.style.display = macrosReady ? "" : "none";
    }

    function refreshNames() {
      var ids = namesList(brand, type);
      if (ids.indexOf(materialId) < 0) materialId = ids[0] || "";
      fillSelect(nameSel, ids, ids.map(function (id) { return MATERIALS[id][1]; }), materialId);
      refreshInfo();
    }

    function refreshTypes() {
      var types = typesList(brand);
      if (types.indexOf(type) < 0) type = types[0] || "";
      fillSelect(typeSel, types, null, type);
      refreshNames();
    }

    fillSelect(brandSel, brandsList(), null, brand);
    refreshTypes();

    brandSel.addEventListener("change", function () { brand = brandSel.value; refreshTypes(); });
    typeSel.addEventListener("change", function () { type = typeSel.value; refreshNames(); });
    nameSel.addEventListener("change", function () {
      materialId = nameSel.value;
      refreshInfo();
      // Until the user picks a color, follow the default color of the filament.
      var fallback = parseColor(MATERIALS[materialId] && MATERIALS[materialId][3]);
      if (!colorTouched && fallback) cc.set(fallback, false);
    });

    newBtn.addEventListener("click", function () { if (!busy) openCreator(unit, index, materialId); });
    delBtn.addEventListener("click", function () {
      if (busy || !CUSTOM[materialId]) return;
      var entry = MATERIALS[materialId];
      if (!window.confirm(t("confirmDelete", entry[0] + " " + entry[1]))) return;
      var id = materialId;
      setBusy(true);
      setStatus(t("deleting"));
      runScript("CFS_REMOVE_MATERIAL ID=" + id).then(function () {
        return waitFor(function () { return loadCustom().then(function () { return !CUSTOM[id]; }); }, 8, 1000);
      }).then(function (gone) {
        if (!gone) {
          setBusy(false);
          return lastHelperMessage().then(function (message) { setStatus(message || t("noRemovalConfirm"), "error"); });
        }
        lastSignature = "";
        openEditor(unit, index);
      }).catch(function (error) {
        setBusy(false);
        setStatus(error && error.message ? error.message : t("removalFailed"), "error");
      });
    });

    function finish() { closeEditor(); lastSignature = ""; poll(); }
    closeBtn.addEventListener("click", closeEditor);
    cancelBtn.addEventListener("click", closeEditor);
    modal.addEventListener("click", function (event) { if (event.target === modal && !busy) closeEditor(); });

    function setBusy(value) {
      busy = value;
      saveBtn.disabled = value;
      cancelBtn.disabled = value;
      closeBtn.disabled = value;
    }

    // The CFS takes a moment to report the change: look at it a few times before giving up.
    function verify(tries) {
      window.setTimeout(function () {
        fetchStatus().then(function (data) {
          var u = data && data.units.filter(function (item) { return item.id === unit.id; })[0];
          var s = u && u.slots[index];
          if (s && s.id === materialId && s.color === color) {
            setStatus(t("saved"), "ok");
            window.setTimeout(finish, 900);
          } else if (tries > 1) {
            verify(tries - 1);
          } else {
            setBusy(false);
            setStatus(t("notReported"), "error");
          }
        }).catch(function () {
          if (tries > 1) verify(tries - 1);
          else { setBusy(false); setStatus(t("readFailed"), "error"); }
        });
      }, VERIFY_MS);
    }

    saveBtn.addEventListener("click", function () {
      if (busy || !materialId) return;
      setBusy(true);
      setStatus(t("saving"));
      var target = "BOX_MODIFY_TN_DATA ADDR=" + unit.id + " NUM=" + num;
      // Checked again here: a print may have started while the dialog was open.
      fetchStatus().then(function (data) {
        if (data && data.printing) throw new Error(t("printingNoEdit"));
        return runScript(target + " PART=material_type DATA=" + materialId);
      }).then(function () {
        // Klipper treats "#" as a comment: the color goes as 0RRGGBB.
        return runScript(target + " PART=color_value DATA=0" + color.slice(1).toUpperCase());
      }).then(function () {
        verify(VERIFY_TRIES);
      }).catch(function (error) {
        setBusy(false);
        setStatus(error && error.message ? error.message : t("changeFailed"), "error");
      });
    });

    if (latest && latest.printing) saveBtn.disabled = true;
    document.body.appendChild(modal);
  }

  // ---------- New filament ----------

  var NAME_PATTERN = /^[A-Za-z0-9._+-]+( [A-Za-z0-9._+-]+)*$/;

  function openCreator(unit, index, baseId) {
    closeEditor();
    var base = MATERIALS[baseId] ? baseId : materialIds()[0];
    var baseEntry = MATERIALS[base];
    var busy = false;

    modal = el("div", "pcfs-overlay");
    var dialog = el("div", "pcfs-dialog v-card v-sheet theme--dark rounded-md");
    modal.appendChild(dialog);

    var head = el("div", "pcfs-dialog-head");
    head.appendChild(el("span", "font-weight-light", t("newFilament")));
    var closeBtn = iconButton(ICONS.close, t("close"));
    head.appendChild(closeBtn);
    dialog.appendChild(head);

    var body = el("div", "pcfs-dialog-body");
    var baseSel = el("select");
    fillSelect(baseSel, materialIds(), materialIds().map(function (id) { return MATERIALS[id][0] + " " + MATERIALS[id][1]; }), base);
    var brandIn = el("input");
    brandIn.type = "text";
    brandIn.maxLength = 24;
    brandIn.setAttribute("list", "pcfs-brands");
    var brandList = el("datalist");
    brandList.id = "pcfs-brands";
    brandsList().forEach(function (b) { var o = el("option"); o.value = b; brandList.appendChild(o); });
    var nameIn = el("input");
    nameIn.type = "text";
    nameIn.maxLength = 24;
    var typeSel = el("select");
    fillSelect(typeSel, allTypes(), null, baseEntry[2]);
    function numberInput(value) {
      var input = el("input");
      input.type = "number";
      input.min = "150";
      input.max = "350";
      input.step = "1";
      input.value = String(value);
      return input;
    }
    var nozzleIn = numberInput(baseEntry[6] || baseEntry[5]);
    var minIn = numberInput(baseEntry[4]);
    var maxIn = numberInput(baseEntry[5]);
    var temps = el("div", "pcfs-temprow");
    [[t("nozzle"), nozzleIn], [t("min"), minIn], [t("max"), maxIn]].forEach(function (pair) {
      var cell = el("div", "pcfs-tempcell");
      cell.appendChild(el("label", "", pair[0]));
      cell.appendChild(pair[1]);
      temps.appendChild(cell);
    });
    var color = parseColor(baseEntry[3]) || "#ffffff";
    var cc = colorControl(color, function (value) { color = value; });

    body.appendChild(el("div", "pcfs-hint", t("hintBase")));
    body.appendChild(field(t("basedOn"), baseSel));
    body.appendChild(field(t("brand"), brandIn));
    body.appendChild(brandList);
    body.appendChild(field(t("name"), nameIn));
    body.appendChild(field(t("material"), typeSel));
    body.appendChild(field(t("temp"), temps));
    body.appendChild(field(t("color"), cc.box));
    var status = el("div", "pcfs-status");
    body.appendChild(status);
    dialog.appendChild(body);

    var actions = el("div", "pcfs-actions");
    var cancelBtn = textButton(t("back"), false);
    var createBtn = textButton(t("add"), true);
    actions.appendChild(cancelBtn);
    actions.appendChild(createBtn);
    dialog.appendChild(actions);

    function setStatus(text, kind) {
      status.textContent = text;
      status.className = "pcfs-status" + (kind ? " " + kind : "");
    }

    function setBusy(value) {
      busy = value;
      createBtn.disabled = value;
      cancelBtn.disabled = value;
      closeBtn.disabled = value;
    }

    // Choosing another base copies its material, temperatures and color.
    baseSel.addEventListener("change", function () {
      var entry = MATERIALS[baseSel.value];
      fillSelect(typeSel, allTypes(), null, entry[2]);
      nozzleIn.value = String(entry[6] || entry[5]);
      minIn.value = String(entry[4]);
      maxIn.value = String(entry[5]);
      cc.set(parseColor(entry[3]) || "#ffffff", false);
    });

    function back() { openEditor(unit, index, baseSel.value); }
    closeBtn.addEventListener("click", back);
    cancelBtn.addEventListener("click", back);

    function validate() {
      var brand = brandIn.value.trim();
      var name = nameIn.value.trim();
      if (!NAME_PATTERN.test(brand) || brand.length > 24) return t("brandInvalid");
      if (!NAME_PATTERN.test(name) || name.length > 24) return t("nameInvalid");
      var nozzle = Number(nozzleIn.value), min = Number(minIn.value), max = Number(maxIn.value);
      var ok = function (n) { return isFinite(n) && n === Math.round(n) && n >= 150 && n <= 350; };
      if (!ok(nozzle) || !ok(min) || !ok(max)) return t("tempsWhole");
      if (min > nozzle || nozzle > max) return t("tempsOrder");
      var exists = materialIds().some(function (id) { return MATERIALS[id][0] === brand && MATERIALS[id][1] === name; });
      if (exists) return t("exists", brand + " " + name);
      return "";
    }

    createBtn.addEventListener("click", function () {
      if (busy) return;
      var problem = validate();
      if (problem) { setStatus(problem, "error"); return; }
      var brand = brandIn.value.trim();
      var name = nameIn.value.trim();
      var space = function (text) { return text.replace(/ /g, "~"); };
      var command = "CFS_ADD_MATERIAL BASE=" + baseSel.value + " BRAND=" + space(brand) + " NAME=" + space(name) +
        " TYPE=" + space(typeSel.value) + " NOZZLE=" + nozzleIn.value + " MIN=" + minIn.value + " MAX=" + maxIn.value +
        " COLOR=" + color.slice(1).toUpperCase();
      setBusy(true);
      setStatus(t("adding"));
      var created = "";
      fetchStatus().then(function (data) {
        if (data && data.printing) throw new Error(t("printingNoDb"));
        return runScript(command);
      }).then(function () {
        return waitFor(function () {
          return loadCustom().then(function () {
            created = materialIds().filter(function (id) { return CUSTOM[id] && MATERIALS[id][0] === brand && MATERIALS[id][1] === name; })[0] || "";
            return !!created;
          });
        }, 8, 1000);
      }).then(function (found) {
        if (!found) {
          setBusy(false);
          return lastHelperMessage().then(function (message) { setStatus(message || t("noNewConfirm"), "error"); });
        }
        lastSignature = "";
        openEditor(unit, index, created);
      }).catch(function (error) {
        setBusy(false);
        setStatus(error && error.message ? error.message : t("addFailed"), "error");
      });
    });

    document.body.appendChild(modal);
  }

  // ---------- CFS Diagnostics ----------

  function formatSize(bytes) {
    if (bytes <= 0) return "0 KB";
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
    return Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  // State written by the diagnostics service (cfs_diag.status; null when it does not exist yet, undefined when it
  // could not be read) and the size of its log files, reported by Moonraker.
  function loadDiag() {
    var status = fetch(DIAG_STATUS_URL + "?t=" + Date.now(), { credentials: "same-origin", cache: "no-store" })
      .then(function (response) {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .catch(function () { return undefined; });
    var files = fetch(DIAG_LOGS_LIST_URL, { credentials: "same-origin", cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (json) {
        var list = (json && json.result) || [];
        var out = { size: 0, hasOld: false };
        list.forEach(function (f) {
          var name = String(f.path || f.filename || "");
          if (name === "cfs_diag.log") out.size = Number(f.size) || 0;
          if (name === "cfs_diag.log.1") out.hasOld = true;
        });
        return out;
      })
      .catch(function () { return null; });
    return Promise.all([status, files]).then(function (r) {
      return { status: r[0], size: r[1] ? r[1].size : null, hasOld: r[1] ? r[1].hasOld : false };
    });
  }

  function openDiagnostics() {
    closeEditor();
    var busy = false;
    var diag = null;

    modal = el("div", "pcfs-overlay");
    var dialog = el("div", "pcfs-dialog v-card v-sheet theme--dark rounded-md");
    modal.appendChild(dialog);

    var head = el("div", "pcfs-dialog-head");
    head.appendChild(el("span", "font-weight-light", t("diagTitle")));
    var closeBtn = iconButton(ICONS.close, t("close"));
    head.appendChild(closeBtn);
    dialog.appendChild(head);

    var body = el("div", "pcfs-dialog-body");
    var list = el("div", "pcfs-dialog-body");
    list.style.padding = "0";
    var info = el("div", "pcfs-hint");
    var status = el("div", "pcfs-status");
    body.appendChild(list);
    body.appendChild(info);
    body.appendChild(status);
    dialog.appendChild(body);

    var actions = el("div", "pcfs-actions");
    var deleteBtn = textButton(t("deleteLog"), false);
    var oldBtn = el("a", "v-btn theme--dark v-size--default v-btn--text");
    oldBtn.appendChild(el("span", "v-btn__content", t("previousLog")));
    oldBtn.setAttribute("href", DIAG_LOG_URL + ".1");
    oldBtn.setAttribute("download", "cfs_diag.log.1");
    var downloadBtn = el("a", "v-btn theme--dark v-size--default v-btn--has-bg primary");
    downloadBtn.appendChild(el("span", "v-btn__content", t("downloadLog")));
    downloadBtn.setAttribute("href", DIAG_LOG_URL);
    downloadBtn.setAttribute("download", "cfs_diag.log");
    actions.appendChild(deleteBtn);
    actions.appendChild(oldBtn);
    actions.appendChild(downloadBtn);
    dialog.appendChild(actions);

    function setStatus(text, kind) {
      status.textContent = text;
      status.className = "pcfs-status" + (kind ? " " + kind : "");
    }

    function setBusy(value) {
      busy = value;
      dialog.classList.toggle("pcfs-busy", value);
    }

    // Runs a macro and waits until the state shows the change (the shell command ends after the macro).
    function act(command, check) {
      if (busy) return;
      setBusy(true);
      setStatus(t("working"));
      runScript(command).then(function () {
        return waitFor(function () {
          return loadDiag().then(function (d) { diag = d; return check(d); });
        }, 8, 700);
      }).then(function (done) {
        setBusy(false);
        show(diag);
        setStatus(done ? t("done") : t("noChangeConfirm"), done ? "ok" : "error");
      }).catch(function (error) {
        setBusy(false);
        setStatus(error && error.message ? error.message : t("changeNotMade"), "error");
      });
    }

    function row(name, on, onText, offText, buttonText, command, check, enabled) {
      var r = el("div", "pcfs-diagrow");
      var left = el("div", "pcfs-diagleft");
      left.appendChild(el("span", "pcfs-diagname", name));
      left.appendChild(el("span", "pcfs-diagstate " + (on ? "on" : "off"), on ? onText : offText));
      r.appendChild(left);
      var btn = textButton(buttonText, false);
      btn.disabled = !enabled;
      btn.addEventListener("click", function () { act(command, check); });
      r.appendChild(btn);
      return r;
    }

    function show(d) {
      list.textContent = "";
      var s = d && d.status;
      if (d && s === undefined) {
        info.textContent = t("stateUnreadable");
      } else if (d && s === null) {
        info.textContent = t("stateMissing");
      } else if (d) {
        var parts = [];
        if (d.size !== null) parts.push(t("logSize", formatSize(d.size)));
        parts.push(t("events", Number(s.events) || 0));
        parts.push(t("cfsState", s.box === "connect" ? t("boxConnect") : s.box === "disconnect" ? t("boxDisconnect") : String(s.box)));
        info.textContent = parts.join(" · ");
      } else {
        info.textContent = "";
      }
      var known = !!s;
      var running = known && s.running === true;
      list.appendChild(row(t("service"), running, t("running"), t("stopped"), running ? t("stop") : t("start"),
        running ? "CFS_DIAG_DISABLE" : "CFS_DIAG_ENABLE", function (x) { return !!(x.status && x.status.running === !running); }, !!d));
      var logging = known && s.logging !== false;
      list.appendChild(row(t("log"), logging, t("on"), t("logOff"), logging ? t("turnOff") : t("turnOn"),
        logging ? "CFS_DIAG_LOG_OFF" : "CFS_DIAG_LOG_ON", function (x) { return !!(x.status && x.status.logging === !logging); }, known));
      var recover = known && s.autorecover === true;
      list.appendChild(row(t("usbRecovery"), recover, t("on"), t("off"), recover ? t("turnOff") : t("turnOn"),
        recover ? "CFS_DIAG_AUTORECOVER_OFF" : "CFS_DIAG_AUTORECOVER_ON", function (x) { return !!(x.status && x.status.autorecover === !recover); }, known));
      var hasLog = !!d && d.size !== null && d.size > 0;
      deleteBtn.disabled = !(hasLog || (!!d && d.hasOld));
      downloadBtn.style.display = hasLog ? "" : "none";
      oldBtn.style.display = d && d.hasOld ? "" : "none";
    }

    deleteBtn.addEventListener("click", function () {
      if (busy) return;
      if (!window.confirm(t("confirmClean"))) return;
      var before = diag && diag.size !== null ? diag.size : 0;
      act("CFS_DIAG_CLEAN", function (x) { return x.size !== null && (x.size < before || (x.size === 0 && !x.hasOld)); });
    });

    closeBtn.addEventListener("click", closeEditor);

    show(null);
    setStatus(t("reading"));
    loadDiag().then(function (d) {
      diag = d;
      show(d);
      setStatus("");
    });

    document.body.appendChild(modal);
  }

  // ---------- Loop ----------

  function schedule(delay) {
    if (pollTimer) window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(poll, delay);
  }

  function poll() {
    if (document.hidden) {
      schedule(POLL_MS);
      return;
    }
    fetchStatus()
      .then(function (data) {
        latest = data;
        if (!data) {
          // The printer has no CFS object: nothing to show.
          removeCard();
          schedule(POLL_ABSENT_MS);
          return;
        }
        if (!card) {
          build();
          lastSignature = "";
        }
        render(data);
        ensureMounted();
        schedule(POLL_MS);
      })
      .catch(function () {
        // Moonraker unreachable (restarting, offline): keep what is shown and retry.
        schedule(POLL_MS);
      });
  }

  // The custom filaments and the macros are read again now and then; after a failed read, in a few seconds.
  function scheduleRefresh(lastOk) {
    window.setTimeout(function () {
      Promise.all([loadCustom(), checkMacros()]).then(function (results) { scheduleRefresh(results[0]); });
    }, lastOk ? CUSTOM_REFRESH_MS : POLL_MS);
  }

  function init() {
    loadPrefs();
    addStyles();
    // The custom filaments first, so their names are known when the first status arrives.
    Promise.all([loadCustom(), checkMacros()]).then(function (results) {
      poll();
      scheduleRefresh(results[0]);
    });
    // Fluidd rebuilds the dashboard when the user changes page or edits the layout.
    window.setInterval(ensureMounted, MOUNT_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/**
 * ansicht.js – das Smart-Home-Dashboard in Material Design 3 mit Beer CSS.
 *
 * Nur die Ansicht ist neu. Controller, Store, Formate und Texte kommen aus
 * dem installierten Dashboard (../js/), deshalb liegt dieser Ordner als
 * Unterordner im Dashboard: …/dashboard/material/
 */
import { createController } from "../js/controller.js";
import { baseType, isControl } from "../js/widgets.js";
import { formatState, hsbToCss, numberOf } from "../js/format.js";
import { language, languages, locale, setLanguage, t } from "../js/i18n.js";
import { openDialog } from "../js/dialog.js";
import { openHistory } from "../js/history.js";
import { setupLock } from "../js/lock.js";

const config = window.DASHBOARD_CONFIG;
const params = new URLSearchParams(location.search);
const $ = (selector) => document.querySelector(selector);

// ─── Einstellungen merken (gleiche Schlüssel wie das Dashboard) ─────────────
function gemerkt(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function merken(key, value) {
  try { localStorage.setItem(key, value); } catch { /* privates Fenster */ }
}

// ─── Farben: Material leitet alle Töne aus einer Grundfarbe ab ──────────────
const MARKE = config.brandColor ?? "#c97a00";
const GRUNDFARBEN = [["Marke", MARKE], ["Blau", "#0b6bcb"], ["Grün", "#2e7d32"],
  ["Pink", "#d81b60"], ["Violett", "#6750a4"]];
const dunkel = matchMedia("(prefers-color-scheme: dark)");
let grundfarbe = gemerkt("md-farbe") ?? MARKE;
let modus = gemerkt("mode") ?? "auto";      // auto, light oder dark
const hellDunkel = () => ui("mode", modus === "auto"
  ? (dunkel.matches ? "dark" : "light") : modus);
await ui("theme", grundfarbe);
hellDunkel();
dunkel.addEventListener("change", hellDunkel);

setLanguage(params.get("lang") ?? gemerkt("lang") ?? config.language ?? "de");
document.title = `${config.title} · Material`;
$("#titel").textContent = config.title;

const controller = createController(config, {
  onStatus: (zustand, text) => {
    $("#status").className = zustand === "online" ? "primary" : "error";
    $("#status").title = text;
    $("#status").setAttribute("aria-label", text);
  },
  onError: (text) => {
    $("#hinweis").textContent = text;
    ui("#hinweis", 4000);                 // Beer CSS zeigt die Snackbar 4 s
  }
});
const { store, send } = controller;

// ─── Bausteine ───────────────────────────────────────────────────────────────

function el(tag, klassen = "", ...kinder) {
  const node = document.createElement(tag);
  if (klassen) node.className = klassen;
  node.append(...kinder);
  return node;
}

/** Runder Knopf mit Material-Symbol (Name des Symbols als Text) */
function symbol(name, beschriftung, onclick) {
  const b = el("button", "circle transparent", el("i", "", name));
  b.setAttribute("aria-label", beschriftung);
  b.addEventListener("click", onclick);
  return b;
}

// ─── Ein Bedienelement je Item-Typ ───────────────────────────────────────────

function schalter(item) {
  const input = el("input");
  input.type = "checkbox";
  input.setAttribute("aria-label", item.label);
  input.addEventListener("click", (event) => {
    event.preventDefault();               // Anzeige folgt der Meldung von openHAB
    send(item.name, input.checked ? "ON" : "OFF");
  });
  store.subscribe(item.name, (i) => (input.checked = i.state === "ON"
    || (baseType(i) === "Color" && numberOf(i.state.split(",")[2]) > 0)));
  return el("label", "switch", input, el("span"));
}

/** Material-Slider stehen unter der Zeile, die Zahl steht in der Zeile */
function regler(item) {
  const input = el("input");
  Object.assign(input, { type: "range", min: 0, max: 100 });
  input.setAttribute("aria-label", item.label);
  const zahl = el("span");
  input.addEventListener("change", () => send(item.name, input.value));
  store.subscribe(item.name, (i) => {
    zahl.textContent = formatState(i);
    if (document.activeElement === input) return;
    input.value = numberOf(i.state) ?? 0;
    input.dispatchEvent(new Event("input"));   // Beer CSS zeichnet die Spur neu
  });
  return el("div", "", el("div", "row", el("div", "max", item.label), zahl),
    el("label", "slider", input, el("span")));
}

function sollwert(item) {
  const { minimum, maximum, step = 1 } = item.stateDescription;
  const einheit = item.unitSymbol ? ` ${item.unitSymbol}` : "";
  const wert = el("span", "bold");
  const aendern = (richtung) => {
    const jetzt = numberOf(store.get(item.name).state) ?? minimum;
    const neu = Math.min(maximum, Math.max(minimum, jetzt + richtung * step));
    send(item.name, `${Number(neu.toFixed(3))}${einheit}`);
  };
  store.subscribe(item.name, (i) => (wert.textContent = formatState(i)));
  return el("nav", "no-space", symbol("remove", t("less"), () => aendern(-1)),
    wert, symbol("add", t("more"), () => aendern(1)));
}

function auswahl(item, optionen) {
  if (optionen.length === 1) {
    const [o] = optionen;
    const b = el("button", "", o.label || o.command);
    b.addEventListener("click", () => send(item.name, o.command));
    return b;
  }
  const select = el("select", "",
    ...optionen.map((o) => new Option(o.label || o.command, o.command)));
  select.setAttribute("aria-label", item.label);
  select.addEventListener("change", () => send(item.name, select.value));
  store.subscribe(item.name, (i) => (select.value = i.state));
  return el("div", "field border round", select, el("i", "", "arrow_drop_down"));
}

/** Material hat keinen Farbkreis – hier: feste Farben als runde Knöpfe */
const FARBEN = [["Warmweiß", "35,30,100"], ["Orange", "28,85,90"],
  ["Rot", "0,90,90"], ["Grün", "130,70,80"], ["Blau", "220,80,90"],
  ["Violett", "275,70,85"]];

function farbe(item) {
  const knoepfe = FARBEN.map(([name, hsb]) => {
    const b = el("button", "circle");
    b.style.background = hsbToCss(hsb);
    b.setAttribute("aria-label", name);
    b.addEventListener("click", () => send(item.name, hsb));
    return b;
  });
  store.subscribe(item.name, (i) => knoepfe.forEach((b, n) =>
    b.setAttribute("aria-pressed", String(FARBEN[n][1] === i.state))));
  return el("div", "farben", ...knoepfe);
}

function bedienelement(item) {
  const optionen = item.commandDescription?.commandOptions ?? [];
  if (optionen.length) return auswahl(item, optionen);
  const senden = (befehl) => () => send(item.name, befehl);
  switch (baseType(item)) {
    case "Switch": return schalter(item);
    case "Color": return farbe(item);
    case "Rollershutter": return el("nav", "no-space",
      symbol("arrow_upward", t("up"), senden("UP")),
      symbol("stop", t("stop"), senden("STOP")),
      symbol("arrow_downward", t("down"), senden("DOWN")));
    case "Player": return el("nav", "no-space",
      symbol("skip_previous", t("previous"), senden("PREVIOUS")),
      symbol("play_pause", t("play"), () => send(item.name,
        store.get(item.name).state === "PLAY" ? "PAUSE" : "PLAY")),
      symbol("skip_next", t("next"), senden("NEXT")));
    case "Number":
      if (item.stateDescription?.minimum !== undefined) return sollwert(item);
  }
  return anzeige(item);
}

const ZAHLEN = ["Number", "Dimmer", "Rollershutter"];

function anzeige(item) {
  const typ = baseType(item);
  if (typ === "Image") {
    const bild = el("img", "bild");
    bild.alt = item.label;
    store.subscribe(item.name, (i) => {
      bild.hidden = !String(i.state).startsWith("data:image");
      if (!bild.hidden) bild.src = i.state;
    });
    return bild;
  }
  // Zahlen öffnen per Klick ihren Verlauf (wenn openHAB Verläufe liefert)
  const verlauf = ZAHLEN.includes(typ) && controller.loadHistory;
  const wert = el(verlauf ? "a" : "span", verlauf ? "link" : "");
  if (verlauf) {
    wert.href = "#";
    wert.setAttribute("aria-label", `${item.label}: ${t("history")}`);
    wert.addEventListener("click", (event) => {
      event.preventDefault();
      openHistory(item, controller.loadHistory);
    });
  }
  store.subscribe(item.name, (i) => (wert.textContent = formatState(i)));
  return wert;
}

function zeile(item) {
  if (isControl(item) && baseType(item) === "Dimmer") return regler(item);
  return el("div", "row wrap", el("div", "max", item.label),
    isControl(item) ? bedienelement(item) : anzeige(item));
}

// ─── Seiten: Übersicht und Räume ─────────────────────────────────────────────

const karte = ({ group, points }) => el("div", "s12 m6 l4",
  el("article", "round", el("h6", "", group.label), ...points.map(zeile)));

/** Übersicht: Kacheln aus config.overview, bei Gruppen "3 von 7" */
function uebersicht() {
  return (config.overview ?? []).map((name) => store.get(name)).filter(Boolean)
    .map((item) => {
      const wert = el("h4", "");
      if (["Switch", "Contact"].includes(item.groupType)) {
        const mitglieder = store.members(item.name);
        const zaehlen = () => {
          const aktiv = mitglieder.filter((m) => ["ON", "OPEN"].includes(m.state));
          wert.textContent = `${aktiv.length} ${t("of")} ${mitglieder.length}`;
        };
        for (const m of mitglieder) store.subscribe(m.name, zaehlen);
      } else {
        store.subscribe(item.name, (i) => (wert.textContent = formatState(i)));
      }
      return el("div", "s6 m4 l2",
        el("article", "round center-align", wert, el("div", "", item.label)));
    });
}

let aktuell = params.get("room") ?? "overview";

function seiten() {
  const liste = [{ name: "overview", label: t("overview") }, ...controller.rooms()];
  const reiter = liste.map((seite) => {
    const a = el("a", "", seite.label);
    a.setAttribute("role", "tab");
    a.href = "#";
    a.addEventListener("click", (event) => {
      event.preventDefault();
      zeigen(seite);
    });
    return a;
  });
  $("#raeume").replaceChildren(...reiter);

  function zeigen(seite) {
    aktuell = seite.name;
    store.newView();                      // Beobachter der alten Seite abmelden
    reiter.forEach((a, i) => {
      a.classList.toggle("active", liste[i] === seite);
      a.setAttribute("aria-selected", liste[i] === seite);
    });
    $("#inhalt").replaceChildren(...(seite.name === "overview"
      ? uebersicht() : controller.devices(seite).map(karte)));
  }
  zeigen(liste.find((seite) => seite.name === aktuell) ?? liste[0]);
}

// ─── Einstellungen: Sprache, Grundfarbe, hell oder dunkel ───────────────────

function wahl(beschriftung, optionen, gewaehlt, aendern) {
  const select = el("select", "", ...optionen.map(([wert, text]) =>
    new Option(text, wert)));
  select.value = gewaehlt;
  select.setAttribute("aria-label", beschriftung);
  select.addEventListener("change", () => aendern(select.value));
  return el("div", "row wrap", el("div", "max", beschriftung),
    el("div", "field border round", select, el("i", "", "arrow_drop_down")));
}

function einstellungen() {
  openDialog(t("settings"),
    wahl(t("language"), languages().map((l) => [l, l.toUpperCase()]),
      language(), (wert) => {
        merken("lang", wert);
        setLanguage(wert);
        for (const dialog of document.querySelectorAll("dialog")) dialog.close();
        beschriften();
        seiten();
        einstellungen();
      }),
    wahl(t("theme"), GRUNDFARBEN.map(([name, farbe]) => [farbe, name]),
      grundfarbe, async (wert) => {
        grundfarbe = wert;
        merken("md-farbe", wert);
        await ui("theme", wert);
        hellDunkel();
      }),
    wahl(t("mode"), [["auto", t("auto")], ["light", t("light")],
      ["dark", t("dark")]], modus, (wert) => {
      modus = wert;
      merken("mode", wert);
      hellDunkel();
    }));
}

/** Texte der Kopfzeile in der aktuellen Sprache */
function beschriften() {
  $("#sperren").setAttribute("aria-label", t("lock"));
  $("#einstellungen").setAttribute("aria-label", t("settings"));
  uhr.tick?.();
}

const sperre = setupLock(config.lock);
$("#sperren").hidden = !config.lock?.pin;
$("#sperren").addEventListener("click", () => sperre.lock());
$("#einstellungen").addEventListener("click", einstellungen);
beschriften();

function uhr() {
  const node = $("#uhr");
  const tick = () => (node.textContent = new Date().toLocaleTimeString(locale(),
    { hour: "2-digit", minute: "2-digit" }));
  tick();
  uhr.tick = tick;
  setInterval(tick, 10000);
}

uhr();
$("#inhalt").textContent = t("loading");
if (await controller.connect()) {
  seiten();
  controller.watch();
} else {
  $("#inhalt").textContent = t("unreachable");
}

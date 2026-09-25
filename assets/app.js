/* Die Präsentation. Alle Inhalte kommen zur Laufzeit aus
   Folien-Lektion-01-22.txt — im Code steht kein Lektionsinhalt. */
import { parse, ARAB, istArabisch, wortzeile, zielTeil } from './parser.js';
import { hervorhebung, wortTreffer, wortTrefferZiel } from './treffer.js';
import { parseSkript, titelTeile } from './skript.js';

/* Pfad relativ zum Modul, nicht zur Seite — so stimmt er von überall. */
const QUELLE = new URL('../Folien-Lektion-01-22.txt', import.meta.url);
const $ = s => document.querySelector(s);

/* ---------- Zeilen zeichnen ------------------------------------------ */
/* marks: [{s,e,typ}] mit typ 'wort' | 'zeichen'. Arabische Läufe werden in
   <bdi> isoliert, damit die Wortfolge in gemischten Zeilen nicht springt. */
const esc = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
/* alles, was sich an den vorigen Buchstaben anlagert */
const KOMBI = /[\u064B-\u0655\u0670\u06D6-\u06ED\u0640]/;
/* Was zum arabischen Lauf gehört, ohne ein Buchstabe zu sein: Vokal- und
   Lesezeichen, Tatwîl — und die unsichtbaren Verbinder U+200C/U+200D, mit
   denen die Quelle die Form eines Buchstabens festlegt (in Lektion 3 steht
   eines vor dem ta marbûtah). Fehlt eines davon hier, zerfällt das Wort in
   zwei <bdi>-Inseln, und zwei Inseln stellt der Browser von links nach
   rechts nebeneinander: das ta marbûtah stünde dann vor dem Wort. */
const ZUSATZ = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200C\u200D]/;
const arabZeichen = c => ARAB.test(c) || ZUSATZ.test(c);
/* Was zwischen arabischen Zeichen stehen darf, ohne den Lauf zu brechen. */
const TRENNER = /[\s·+\-\u2010-\u2015]/;

function zeileHtml(zeile, marks = []){
  const typ = new Array(zeile.length).fill(null);
  /* Wortmarkierungen zuerst, Zeichenmarkierungen darauf — das einzelne
     Vokalzeichen ist die genauere Angabe und darf nicht überdeckt werden. */
  const sortiert = [...marks].sort((a,b) => (a.typ === 'zeichen') - (b.typ === 'zeichen'));
  for (const m of sortiert) for (let i = m.s; i < m.e && i < zeile.length; i++) typ[i] = m.typ;

  /* Ein Vokalzeichen allein läßt sich nicht einfärben: der Browser malt es
     zusammen mit seinem Trägerbuchstaben und nimmt dessen Farbe — die
     Markierung bliebe unsichtbar. Also kommt der Träger mit hinein. */
  for (let i = 0; i < zeile.length; i++){
    if (typ[i] !== 'zeichen' || !KOMBI.test(zeile[i])) continue;
    let j = i;
    while (j > 0 && KOMBI.test(zeile[j])) j--;
    if (j < i && typ[j] === null) typ[j] = 'zeichen';
  }

  const teile = [];
  let i = 0;
  while (i < zeile.length){
    const ar = arabZeichen(zeile[i]);
    let j = i;
    while (j < zeile.length){
      if (arabZeichen(zeile[j]) === ar){ j++; continue; }
      if (!ar) break;
      /* Trennzeichen zwischen zwei arabischen Zeichen gehören zum Lauf.
         „ن - ف - س" ist eine Wurzel, keine drei Inseln — drei Inseln stellt
         der Browser von links nach rechts nebeneinander, und die Wurzel
         stünde rückwärts da. Folgt nach dem Trenner kein Arabisch, endet
         der Lauf wie bisher: „هٰذَا — dies" bleibt zweigeteilt. */
      let k = j;
      while (k < zeile.length && TRENNER.test(zeile[k])) k++;
      if (k > j && k < zeile.length && arabZeichen(zeile[k])){ j = k; continue; }
      break;
    }
    if (j === i) j++;
    const stueck = zeile.slice(i, j);
    let inner = '';
    let k = i;
    while (k < j){
      let l = k; while (l < j && typ[l] === typ[k]) l++;
      const t = esc(zeile.slice(k, l));
      inner += typ[k] ? `<span class="m-${typ[k]}">${t}</span>` : t;
      k = l;
    }
    teile.push(ar ? `<bdi class="ar">${inner}</bdi>` : inner);
    i = j;
  }
  return teile.join('');
}

/* Mehrere Leerzeichen in der Datei bilden Spalten: das Wort über seiner
   Bedeutung. Solche Zeilen werden als Raster gesetzt, damit sie untereinander
   stehen bleiben. */
const spalten = z => z.trim().split(/\s{2,}/).filter(Boolean);
function spaltenHtml(zeilen, karte, verdeckt = ''){
  const n = spalten(zeilen[0]).length;
  /* Steht in der ersten Zeile Arabisch, laufen die Spalten von rechts nach
     links — sonst stünde das erste Wort links. Blöcke mit → bleiben, wie die
     Datei sie zeigt: der Pfeil gibt dort die Richtung vor. */
  /* Verwandlungen laufen von rechts nach links, wie Arabisch gelesen wird:
     die Ausgangsform rechts, das Ergebnis links. Ausgenommen sind Ketten mit
     deutschen Gliedern (ة → weiblich → هٰذِهِ): dort gibt die deutsche
     Leserichtung den Ausschlag. */
  const deutscheKette = zeilen.some(z => z.includes('→')) &&
                        zeilen.some(z => spalten(z).some(c => /[A-Za-z]/.test(c)));
  const rtl = istArabisch(zeilen[0]) && !deutscheKette;
  const reihen = zeilen.map(z => {
    const teile = [];
    let pos = 0;
    for (const c of spalten(z)){
      const i = z.indexOf(c, pos); pos = i + c.length;
      const eig = (karte.get(z.trim()) || [])
        .filter(m => m.s >= i && m.e <= pos).map(m => ({...m, s:m.s-i, e:m.e-i}));
      /* dir="auto" statt fester Richtung: „kein ة" enthält Arabisch, ist aber
         ein deutscher Text — in einem rtl-Raster rutschte „kein" sonst nach
         rechts neben den Buchstaben. Der Browser richtet sich nach dem
         ersten starken Zeichen der Zelle, und das ist hier das k. */
      /* Läuft die Reihe nach links, muß der Pfeil mitgehen — sonst zeigt er
         gegen die Richtung, in der gelesen wird. Nur die Anzeige: in der
         Datei bleibt → das Zeichen, an dem die Verwandlung erkannt wird.
         Gleiche Länge, also stimmen die Stellen der Markierungen weiter. */
      const gezeigt = (rtl && c === '→') ? '←' : c;
      teile.push(`<div class="sp ${istArabisch(c) ? '' : 'de'}" dir="auto">${zeileHtml(gezeigt, eig)}</div>`);
    }
    return teile.join('');
  });
  return `<div class="raster${verdeckt}${rtl ? ' rtl' : ''}" `
       + `style="grid-template-columns:repeat(${n},auto)">${reihen.join('')}</div>`;
}

/* die Kopula in Klammern setzen — am Rohtext, nicht am fertigen HTML */
function deutschHtml(z){
  const m = z.match(KOPULA);
  if (!m) return esc(z);
  const i = m.index + m[1].length;
  return esc(z.slice(0, i)) + `<span class="m-de">(${esc(m[2])})</span>` + esc(z.slice(i + m[2].length));
}

/* Es werden immer alle Schritte gesetzt; die noch nicht aufgedeckten bleiben
   unsichtbar, behalten aber ihren Platz. So bleibt die Schriftgröße beim
   Aufdecken stehen und die schon sichtbaren Zeilen springen nicht. */
function folieHtml(folie, bisSchritt, karte, istZeile, mitPlus = false){
  const out = [];
  for (let s = 0; s < folie.schritte.length; s++){
    const verdeckt = s > bisSchritt ? ' verdeckt' : '';
    const zeilen = folie.schritte[s];
    /* Die Vorschau zeigt die ganze Folie auf einmal. Das (+) markiert, wo
       beim Vortrag der nächste Aufdeckschritt anfängt — dieselbe Marke, die
       in der Quelldatei auf einer eigenen Zeile steht. */
    if (mitPlus && s > 0 && zeilen.some(z => z.trim())) out.push('<div class="plus">(+)</div>');
    const anfang = out.length;
    for (let i = 0; i < zeilen.length; i++){
      const z = zeilen[i].trim();
      if (!z){ out.push(`<div class="luecke${verdeckt}"></div>`); continue; }
      const wz = wortzeile(z);
      if (wz){
        const off = z.indexOf(wz.wort);
        const eig = (karte.get(z) || [])
          .filter(m => m.s >= off && m.e <= off + wz.wort.length)
          .map(m => ({...m, s:m.s-off, e:m.e-off}));
        /* zeileHtml liefert das arabische Wort schon in <bdi class="ar">.
           Noch eins drumherum hieße: 2,1em wirkt zweimal — dann stand das Wort
           gut doppelt so groß da wie der Beispielsatz auf derselben Folie. */
        out.push(`<div class="zl wz${verdeckt}"><span class="mk">${esc(wz.markierung)}</span>`
               + zeileHtml(wz.wort, eig)
               + `<span class="bd">— ${esc(wz.bedeutung)}</span></div>`);
        continue;
      }
      // zusammenhängender Block gleich breiter Spaltenzeilen?
      const n = spalten(z).length;
      if (n > 1){
        const block = [zeilen[i]];
        while (i+1 < zeilen.length && zeilen[i+1].trim() && spalten(zeilen[i+1]).length === n){ block.push(zeilen[++i]); }
        if (block.length > 1 || n > 1){ out.push(spaltenHtml(block, karte, verdeckt)); continue; }
      }
      const eigene = karte.get(z) || [];
      const inhalt = (z === istZeile) ? deutschHtml(z) : zeileHtml(z, eigene);
      out.push(`<div class="zl ${istArabisch(z) ? '' : 'de'}${verdeckt}">${inhalt}</div>`);
    }
    /* Die erste Zeile eines Schrittes fängt etwas an, sie setzt nichts fort.
       Steht dort Deutsch, ist es eine Überschrift über dem Arabischen und
       keine Übersetzung darunter — Lektion 4, „Naturdinge". */
    if (out.length > anfang) out[anfang] = out[anfang].replace('class="', 'class="schrittanfang ');
  }
  return out.join('');
}

/* Größte Schrift suchen, bei der der Inhalt noch ohne Scrollen passt —
   die Kästchen sollen gefüllt sein, nicht nur nicht überlaufen.
   Gemessen wird der innere Block, nicht das Kästchen: bei zentriertem Inhalt
   läuft der Überhang nach oben aus dem scrollHeight heraus. */
const hueller = inhalt => { const d = document.createElement('div'); d.className = 'inhalt';
  d.innerHTML = inhalt; return d; };
function einpassen(el, max = 2.2, min = .4, faktor = 1){
  const inner = el.querySelector(':scope > .inhalt');
  if (!inner) return;
  const cs = getComputedStyle(el);
  const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const b = el.clientWidth  - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (h <= 0 || b <= 0) return;
  const passt = g => { el.style.fontSize = g + 'rem';
    const r = inner.getBoundingClientRect();
    return r.height <= h + 1 && inner.scrollWidth <= b + 1; };
  if (passt(max)){ el.style.fontSize = Math.round(max * faktor * 100) / 100 + 'rem'; return; }
  let lo = min, hi = max;
  for (let i = 0; i < 14; i++){ const m = (lo + hi) / 2; passt(m) ? lo = m : hi = m; }
  /* abrunden, nicht runden: aufgerundet passt die gefundene Größe nicht mehr */
  let g = Math.max(min, Math.floor(lo * 100) / 100);
  while (g > min && !passt(g)) g = Math.round((g - .02) * 100) / 100;
  el.style.fontSize = Math.round(g * faktor * 100) / 100 + 'rem';
}

/* ---------- Start ---------------------------------------------------- */
const params = new URLSearchParams(location.search);
const nr = parseInt(params.get('l') || '1', 10);

const text = await (await fetch(QUELLE, { cache:'no-store' })).text();
const kurs = parse(text);
/* Das Sprechskript. Es ist noch nicht für alle Lektionen geschrieben — fehlt
   ein Abschnitt, springt die Erklärung der Folie ein. Wird die Datei später
   auf 22 Lektionen erweitert, muß ihr Name hier derselbe bleiben. */
const SKRIPT = new URL('../Skripte-Lektion-01-11.txt', import.meta.url);
const skript = parseSkript(await (await fetch(SKRIPT, { cache:'no-store' })).text());
const lek = kurs.find(l => l.nr === nr) || kurs[0];
document.title = `Lektion ${lek.nr} · ${lek.titel} — Quran verstehen lernen`;

let idx = 0, schritt = 0, wurzelOffen = null;
const aktiv = { wort: new Set(), gram: new Set() };

/* Die zuletzt erschienene Zeile mit arabischem Text. Nicht „der letzte Satz
   der Folie": beim Aufdecken wandert das Ziel mit, frühere Zeilen bleiben
   unberührt. Vokabelzeilen zählen mit — auch sie sind eine erschienene Zeile. */
/* Markiert wird, was zuletzt erschienen ist — und das können mehrere Zeilen
   sein: deckt ein Schritt drei Namen auf einmal auf, sind alle drei gerade
   erschienen und alle drei werden markiert. Zurück kommen deshalb alle
   arabischen Zeilen des letzten Schrittes, der überhaupt Arabisch zeigt.
   Eine Pfeilzeile zählt nur, wenn hinter dem Pfeil Arabisch steht —
   „مَا → Dinge" ist keine Zeile zum Markieren. */
function zielZeilen(){
  const f = lek.folien[idx];
  for (let s = Math.min(schritt, f.schritte.length-1); s >= 0; s--){
    const treffer = f.schritte[s].map(z => z.trim())
      .filter(z => istArabisch(z) && istArabisch(zielTeil(z).text));
    if (treffer.length) return treffer;
  }
  return [];
}
/* „Kein ist": im Arabischen steht zwischen Pronomen und Aussage nichts.
   Im Deutschen steht dort je nach Person ist, sind, bin, bist oder seid —
   dieses Wort wird in Klammern gesetzt und hervorgehoben. */
const KOPULA = /(^|\s)(ist|sind|bin|bist|seid)(?=[\s.,;:!?]|$)/;
function zielDeutsch(){
  const f = lek.folien[idx];
  for (let s = Math.min(schritt, f.schritte.length-1); s >= 0; s--){
    const zeilen = f.schritte[s];
    for (let i = zeilen.length-1; i >= 0; i--){
      const z = zeilen[i].trim();
      if (z && !istArabisch(z) && KOPULA.test(z)) return z;
    }
  }
  return null;
}

function neueWoerter(){
  const out = [];
  for (const f of lek.folien) for (const s of f.schritte) for (const z of s){
    const w = wortzeile(z);
    if (w && !out.some(x => x.wort === w.wort)) out.push(w);
  }
  return out;
}
const WOERTER = neueWoerter();

/* ---------- Zeichnen -------------------------------------------------- */
/* Jede Zielzeile bekommt ihre eigenen Stellen — die zählen ab Zeilenanfang
   und sind von Zeile zu Zeile verschieden. */
function marken(){
  const karte = new Map();
  for (const z of zielZeilen()){
    const alle = [];
    for (const w of aktiv.wort)
      for (const [s,e] of wortTrefferZiel(w, z)) alle.push({s, e, typ:'wort'});
    for (const name of aktiv.gram){
      const b = lek.hervorhebungen.find(h => h.name === name);
      if (!b) continue;
      const r = hervorhebung(lek, b, z);
      for (const [s,e] of r.wort)    alle.push({s, e, typ:'wort'});
      for (const [s,e] of r.zeichen) alle.push({s, e, typ:'zeichen'});
    }
    if (alle.length) karte.set(z, alle);
  }
  return karte;
}
/* Greift eine Hervorhebung auf der zuletzt erschienenen Zeile? Daran hängt
   beides: ob ihr Knopf anklickbar ist und ob ihre Erklärung dasteht. */
function greift(h, ziele = zielZeilen()){
  return ziele.some(z => { const r = hervorhebung(lek, h, z);
    return !!(r.wort.length || r.zeichen.length || r.deutsch); });
}
function deutschIst(){
  for (const name of aktiv.gram){
    const b = lek.hervorhebungen.find(h => h.name === name);
    if (b && zielZeilen().some(z => hervorhebung(lek, b, z).deutsch)) return true;
  }
  return false;
}

/* Oben der Vorschaustreifen: fünf Kästchen nebeneinander, jedes mit dem
   vollständigen Inhalt seiner Folie — auch das der aktuellen. Hier wird
   nichts Schritt für Schritt aufgedeckt und nichts hervorgehoben. */
/* Die aktuelle Folie steht immer im dritten von fünf Kästchen. Die Reihe
   gleitet also mit, statt seitenweise umzuspringen; am Anfang und am Ende
   der Lektion bleiben die Kästchen daneben leer — es gibt kein Fenster mehr,
   das nachgeführt werden müßte. */
function zeichneVorschau(){
  const box = $('#vorschau');
  box.replaceChildren();
  for (let p = 0; p < 5; p++){
    const i = idx - 2 + p;
    const d = document.createElement('div');
    const da = i >= 0 && i < lek.folien.length;
    d.className = 'vk' + (i === idx ? ' jetzt' : '') + (da ? '' : ' leer');
    if (da){
      const f = lek.folien[i];
      d.appendChild(hueller(folieHtml(f, f.schritte.length - 1, new Map(), null, true)));
      d.addEventListener('click', () => { if (!wurzelOffen){ idx = i; schritt = 0; zeichne(); } });
    }
    box.appendChild(d);
  }
  box.querySelectorAll('.vk').forEach(el => einpassen(el, 1.3, .3));
}

/* Folien mit Sätzen und Erklärungen bekommen eine gemeinsame Schriftgröße:
   die kleinste, die auf allen von ihnen paßt. Sonst springt die Schrift beim
   Weiterblättern von Folie zu Folie.
   Wortfolien und Folien mit Spaltenblöcken — Wort über Bedeutung, Form → Form
   — bleiben außen vor: sie sind anders gebaut und passen sich einzeln an. */
const wortfolie = f => {
  const zeilen = f.schritte.flat().map(z => z.trim()).filter(Boolean);
  return zeilen.length > 0 && zeilen.every(z => wortzeile(z));
};
function passtInsKaestchen(el){
  const inner = el.querySelector(':scope > .inhalt');
  if (!inner) return true;
  const cs = getComputedStyle(el);
  const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const b = el.clientWidth  - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  return inner.getBoundingClientRect().height <= h + 1 && inner.scrollWidth <= b + 1;
}
const satzfolie = f => {
  const zeilen = f.schritte.flat().map(z => z.trim()).filter(Boolean);
  return zeilen.length > 0 && zeilen.every(z => !wortzeile(z) && spalten(z).length < 2);
};
/* Volle Folie — vier Sätze oder mehr — braucht wenig Luft zwischen den
   Paaren, eine halbleere darf mehr haben. */
function luft(box){
  const saetze = box.querySelectorAll('.inhalt > .zl:not(.de)').length;
  box.style.setProperty('--luft', saetze >= 4 ? '1.3em' : '2em');
}

let einheit = null;
/* Den Maßstab setzt die erste Lektion: die kleinste Größe, die auf alle ihre
   Satzfolien paßt. Nähme man das Minimum über die gerade geöffnete Lektion,
   bekäme jede Lektion ihr eigenes Maß — eine einzige dichte Folie in Lektion 2
   ließe dort alles kleiner aussehen als in Lektion 1. Eine Folie, die mit dem
   Maß nicht auskommt, wird für sich allein kleiner gesetzt (zeichneFolie);
   der ganze übrige Kurs bleibt bei dem einen Maß. */
function einheitsGroesse(){
  const box = $('#folie');
  const erste = kurs.find(l => l.nr === 1) || kurs[0];
  let klein = Infinity;
  for (const f of erste.folien){
    if (!satzfolie(f)) continue;
    box.replaceChildren(hueller(folieHtml(f, f.schritte.length - 1, new Map(), null)));
    luft(box);
    einpassen(box, 8, .6, .8);
    klein = Math.min(klein, parseFloat(box.style.fontSize));
  }
  einheit = Number.isFinite(klein) ? klein : null;
  box.replaceChildren();
  box.style.removeProperty('--luft');
}

/* In der Mitte die Folie selbst, mit allem Platz, der da ist. Sie zeigt nur,
   was bis zum aktuellen Schritt aufgedeckt ist, und trägt die Markierungen. */
function zeichneFolie(){
  const box = $('#folie');
  box.replaceChildren();
  const f = lek.folien[idx];
  const iz = deutschIst() ? zielDeutsch() : null;
  box.appendChild(hueller(folieHtml(f, schritt, marken(), iz)));
  /* Die Wortfolie mit den neuen Wörtern bekommt ihre eigene Größe. Alle
     anderen nehmen die gemeinsame — und nur wenn eine Folie damit nicht
     auskommt, wird sie für sich kleiner gesetzt. */
  luft(box);
  if (einheit && !wortfolie(f)){
    box.style.fontSize = einheit + 'rem';
    /* Kommt eine dichte Folie mit dem gemeinsamen Maß nicht aus, wird sie so
       groß gesetzt, wie sie eben paßt — ohne den 20-%-Abschlag ein zweites
       Mal: der steckt schon im gemeinsamen Maß. Sonst fiele eine Folie, die
       nur um ein Haar zu groß ist, gleich auf drei Viertel zurück. */
    if (!passtInsKaestchen(box)) einpassen(box, einheit, .6, 1);
  } else einpassen(box, 8, .6, .8);   // 20 % kleiner als das, was paßen würde
}

/* Wo man gerade ist. Steht in der Knopfspalte, also außerhalb des 16:9-
   Rahmens, den die Folie bildet: es ist eine Hilfe beim Aufnehmen und
   gehört nicht in die Aufnahme. */
function zeichneStand(){
  $('#stand').innerHTML = `<a class="lek" href="index.html" title="zurück zur Übersicht">`
                        + `<span class="haus">⌂</span> Lektion ${lek.nr}</a>`
                        + `<span class="fol">Folie ${idx + 1}</span>`;
}

function zeichneWurzeln(){
  const box = $('#wurzeln');
  box.replaceChildren();
  for (let i = 0; i < 3; i++){
    const w = lek.wurzeln[i];
    const d = document.createElement('div');
    if (!w){ d.className = 'wk leer'; box.appendChild(d); continue; }
    d.className = 'wk' + (wurzelOffen === i ? ' an' : '');
    d.appendChild(hueller(`<div class="w">${esc(w.wort)}</div><div class="t">${esc(w.erklaerung.join(' '))}</div>`));
    d.addEventListener('click', () => { wurzelOffen = (wurzelOffen === i) ? null : i; zeichne(); });
    box.appendChild(d);
  }
  box.querySelectorAll('.wk').forEach(el => einpassen(el, .95, .42));
}

/* Links steht, was zu dieser Folie gesprochen wird: die Marke aus dem Skript
   als zweizeiliger Titel, darunter der Text. Eine Folie kann zwei Abschnitte
   tragen — den zur Folie und den zu einem Knopf darauf.
   Ohne Skript bleibt die Erklärung der Folie stehen; die „Notiz für mich"
   nicht mehr, die gehört nicht vor die Kamera. */
function zeichneSkript(){
  const box = $('#skript');
  box.replaceChildren();
  const inhalt = document.createElement('div'); inhalt.className = 'inhalt';
  box.appendChild(inhalt);
  /* Ohne Skriptabschnitt bleibt der Kasten leer — einen Ersatztext gibt es
     nicht mehr. */
  for (const a of skript.get(lek.nr)?.get(idx + 1) || []){
      const [oben, unten] = titelTeile(a.titel);
      const m = document.createElement('div'); m.className = 'marke';
      m.innerHTML = `<span class="nr">${esc(oben)}</span>`
                  + (unten ? `<span class="was">${esc(unten)}</span>` : '');
      inhalt.appendChild(m);
      for (const p of a.text){
        const d = document.createElement('div');
        d.className = 'satz' + (ohneDeutsch(p) ? ' nurar' : '');
        d.innerHTML = zeileHtml(p);
        inhalt.appendChild(d);
      }
  }
  /* Der Deckel liegt tief: die Spalte ist schmal, und bei 24 px brächen kurze
     Abschnitte nach drei Wörtern um. So bleibt die Größe über die Folien
     hinweg ruhig — was beim Vorlesen mehr zählt als ein voller Kasten. */
  einpassen(box, 1.1, .5);
}
/* Eine Zeile, die nur aus Arabisch besteht, steht im Skript für sich allein
   und wird vorgelesen — sie bekommt ihre eigene, mittige Zeile. */
const ohneDeutsch = z => istArabisch(z) && !/[A-Za-zÄÖÜäöüß]/.test(z);

function zeichneKnoepfe(){
  const sp = $('#knoepfe');
  sp.replaceChildren();
  const ziele = zielZeilen();
  const g1 = document.createElement('div'); g1.className = 'gruppe';
  /* Die neuen Wörter der Lektion stehen immer alle da, mit ihrer Bedeutung —
     sie sind der Vorrat, auf den die ganze Lektion zurückgreift. Anklickbar
     ist eins nur, wo es in der zuletzt erschienenen Zeile auch vorkommt. */
  for (const w of WOERTER){
    const dabei = ziele.some(z => wortTrefferZiel(w.wort, z).length > 0);
    const b = document.createElement('button');
    b.className = 'knopf wort' + (aktiv.wort.has(w.wort) ? ' an' : '');
    b.innerHTML = `<span class="w">${esc(w.wort)}</span>`
                + `<span class="bd">${esc(w.bedeutung)}</span>`;
    b.disabled = !dabei;
    if (!dabei) aktiv.wort.delete(w.wort);
    b.addEventListener('click', () => {
      aktiv.wort.has(w.wort) ? aktiv.wort.delete(w.wort) : aktiv.wort.add(w.wort);
      zeichne();
    });
    g1.appendChild(b);
  }
  sp.appendChild(g1);
  const ab = document.createElement('div'); ab.className = 'abstand'; sp.appendChild(ab);
  const g2 = document.createElement('div'); g2.className = 'gruppe';
  for (const h of lek.hervorhebungen){
    const b = document.createElement('button');
    const dabei = greift(h, ziele);
    b.className = 'knopf' + (aktiv.gram.has(h.name) ? ' an' : '');
    b.textContent = h.beschriftung;
    b.disabled = !dabei;
    if (!dabei) aktiv.gram.delete(h.name);
    b.addEventListener('click', () => {
      aktiv.gram.has(h.name) ? aktiv.gram.delete(h.name) : aktiv.gram.add(h.name);
      zeichne();
    });
    g2.appendChild(b);
  }
  sp.appendChild(g2);
}

function zeichneWurzelfolie(){
  const el = $('#wurzelfolie');
  if (wurzelOffen === null){ el.classList.remove('an'); el.replaceChildren(); return; }
  const w = lek.wurzeln[wurzelOffen];
  const bed = w.bedeutung.replace(/^.*?bedeutet\s*/, '').replace(/\.$/, '');
  const abl = w.ableitungen.map(a => {
    const i = a.indexOf('—');
    return { a: i < 0 ? a : a.slice(0, i).trim(), b: i < 0 ? '' : a.slice(i+1).trim() };
  });
  el.innerHTML = `<div class="wf">
    <div class="haupt" data-w="${esc(w.wort)}">${esc(w.wort)}</div>
    <div class="bed">${esc(bed)}</div>
    <div class="buchst">${esc(w.buchstaben.join(' '))}</div>
    <div class="abl">${abl.map(x => `<div class="zeile">
        <div class="a" data-w="${esc(x.a)}">${esc(x.a)}</div><div class="p">—</div><div class="b">${esc(x.b)}</div>
      </div>`).join('')}</div>
    <div class="kern">${esc(w.kern)}</div>
    <div class="schalter"><button class="knopf" id="wb">Wurzelbuchstaben hervorheben</button></div>
  </div>`;
  el.classList.add('an');
  let an = false;
  el.querySelector('#wb').addEventListener('click', async () => {
    an = !an;
    const { wurzelTreffer } = await import('./wurzel.js');
    el.querySelectorAll('[data-w]').forEach(n => {
      const wort = n.dataset.w;
      if (!an){ n.innerHTML = esc(wort); return; }
      const t = wurzelTreffer(wort, w.buchstaben);
      n.innerHTML = t.ok
        ? [...wort].map((c,i) => t.treffer.includes(i) ? `<span class="m-wurzel">${esc(c)}</span>` : esc(c)).join('')
        : esc(wort);
    });
    el.querySelector('#wb').classList.toggle('an', an);
  });
}

function zeichne(){
  if (einheit === null) einheitsGroesse();
  /* Lektionen ohne Wurzelkästen: die Knopfspalte behält ihren Platz für sich. */
  $('#spalte').classList.toggle('ohne-wurzeln', lek.wurzeln.length === 0);
  /* Erst die Knöpfe, dann die Wurzeln: wieviel Höhe die Wurzelkästen bekommen,
     entscheidet sich erst, wenn die Knöpfe ihre eigene Höhe haben. */
  zeichneStand(); zeichneVorschau(); zeichneFolie(); zeichneKnoepfe(); zeichneWurzeln();
  zeichneSkript(); zeichneWurzelfolie();
  $('#gesperrt').classList.toggle('an', wurzelOffen !== null);
}

/* ---------- Steuerung ------------------------------------------------- */
function vor(){
  const f = lek.folien[idx];
  if (schritt < f.schritte.length - 1) schritt++;
  else if (idx < lek.folien.length - 1){ idx++; schritt = 0; aktiv.wort.clear(); aktiv.gram.clear(); }
  else return;
  zeichne();
}
function zurueck(){
  if (schritt > 0) schritt--;
  else if (idx > 0){ idx--; schritt = lek.folien[idx].schritte.length - 1; aktiv.wort.clear(); aktiv.gram.clear(); }
  else return;
  zeichne();
}
addEventListener('keydown', e => {
  if (e.key === 'Escape'){ if (wurzelOffen !== null){ wurzelOffen = null; zeichne(); } else location.href = 'index.html'; return; }
  if (wurzelOffen !== null) { e.preventDefault(); return; }          // Navigation gesperrt
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown'){ e.preventDefault(); vor(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp'){ e.preventDefault(); zurueck(); }
  else if (e.key === 'Home'){ idx = 0; schritt = 0; zeichne(); }
  else if (e.key === 'f' || e.key === 'F'){ document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
});
$('#wurzelfolie').addEventListener('click', e => { if (e.target.id === 'wurzelfolie'){ wurzelOffen = null; zeichne(); } });
addEventListener('resize', () => { einheit = null; zeichne(); });

zeichne();

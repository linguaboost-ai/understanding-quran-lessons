/* Die Präsentation. Alle Inhalte kommen zur Laufzeit aus
   Folien-Lektion-01-22.txt — im Code steht kein Lektionsinhalt. */
import { parse, ARAB, istArabisch, wortzeile, zielTeil } from './parser.js';
import { hervorhebung, wortTreffer, wortTrefferZiel } from './treffer.js';

/* Pfad relativ zum Modul, nicht zur Seite — so stimmt er von überall. */
const QUELLE = new URL('../Folien-Lektion-01-22.txt', import.meta.url);
const $ = s => document.querySelector(s);

/* ---------- Zeilen zeichnen ------------------------------------------ */
/* marks: [{s,e,typ}] mit typ 'wort' | 'zeichen'. Arabische Läufe werden in
   <bdi> isoliert, damit die Wortfolge in gemischten Zeilen nicht springt. */
const esc = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
/* alles, was sich an den vorigen Buchstaben anlagert */
const KOMBI = /[\u064B-\u0655\u0670\u06D6-\u06ED\u0640]/;

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
    const ar = ARAB.test(zeile[i]) || /[ً-ْٰۡٓ-ٟـ]/.test(zeile[i]);
    let j = i;
    while (j < zeile.length &&
      (ARAB.test(zeile[j]) || /[ً-ْٰۡٓ-ٟـ]/.test(zeile[j]) ||
       (ar && /[\s·]/.test(zeile[j]) && j+1 < zeile.length &&
        (ARAB.test(zeile[j+1]) || /[ً-ْٰۡ]/.test(zeile[j+1])))) === ar) j++;
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
function spaltenHtml(zeilen, marks, markZeile, verdeckt = ''){
  const n = spalten(zeilen[0]).length;
  /* Steht in der ersten Zeile Arabisch, laufen die Spalten von rechts nach
     links — sonst stünde das erste Wort links. Blöcke mit → bleiben, wie die
     Datei sie zeigt: der Pfeil gibt dort die Richtung vor. */
  const rtl = istArabisch(zeilen[0]) && !zeilen.some(z => z.includes('→'));
  const reihen = zeilen.map(z => {
    const teile = [];
    let pos = 0;
    for (const c of spalten(z)){
      const i = z.indexOf(c, pos); pos = i + c.length;
      const eig = (z.trim() === markZeile)
        ? marks.filter(m => m.s >= i && m.e <= pos).map(m => ({...m, s:m.s-i, e:m.e-i}))
        : [];
      teile.push(`<div class="sp ${istArabisch(c) ? '' : 'de'}">${zeileHtml(c, eig)}</div>`);
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
function folieHtml(folie, bisSchritt, marks, markZeile, istZeile){
  const out = [];
  for (let s = 0; s < folie.schritte.length; s++){
    const verdeckt = s > bisSchritt ? ' verdeckt' : '';
    const zeilen = folie.schritte[s];
    for (let i = 0; i < zeilen.length; i++){
      const z = zeilen[i].trim();
      if (!z){ out.push(`<div class="luecke${verdeckt}"></div>`); continue; }
      const wz = wortzeile(z);
      if (wz){
        const off = z.indexOf(wz.wort);
        const eig = (z === markZeile)
          ? marks.filter(m => m.s >= off && m.e <= off + wz.wort.length)
                 .map(m => ({...m, s:m.s-off, e:m.e-off}))
          : [];
        out.push(`<div class="zl wz${verdeckt}"><span class="mk">${esc(wz.markierung)}</span>`
               + `<bdi class="ar">${zeileHtml(wz.wort, eig)}</bdi>`
               + `<span class="bd">— ${esc(wz.bedeutung)}</span></div>`);
        continue;
      }
      // zusammenhängender Block gleich breiter Spaltenzeilen?
      const n = spalten(z).length;
      if (n > 1){
        const block = [zeilen[i]];
        while (i+1 < zeilen.length && zeilen[i+1].trim() && spalten(zeilen[i+1]).length === n){ block.push(zeilen[++i]); }
        if (block.length > 1 || n > 1){ out.push(spaltenHtml(block, marks, markZeile, verdeckt)); continue; }
      }
      const eigene = (z === markZeile) ? marks : [];
      const inhalt = (z === istZeile) ? deutschHtml(z) : zeileHtml(z, eigene);
      out.push(`<div class="zl ${istArabisch(z) ? '' : 'de'}${verdeckt}">${inhalt}</div>`);
    }
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
const lek = kurs.find(l => l.nr === nr) || kurs[0];
document.title = `Lektion ${lek.nr} · ${lek.titel} — Quran verstehen lernen`;

let idx = 0, schritt = 0, fenster = 0, wurzelOffen = null;
const aktiv = { wort: new Set(), gram: new Set() };

/* Die zuletzt erschienene Zeile mit arabischem Text. Nicht „der letzte Satz
   der Folie": beim Aufdecken wandert das Ziel mit, frühere Zeilen bleiben
   unberührt. Vokabelzeilen zählen mit — auch sie sind eine erschienene Zeile. */
function zielZeile(){
  const f = lek.folien[idx];
  for (let s = Math.min(schritt, f.schritte.length-1); s >= 0; s--){
    const zeilen = f.schritte[s];
    for (let i = zeilen.length-1; i >= 0; i--){
      const z = zeilen[i].trim();
      /* Eine Pfeilzeile zählt nur, wenn hinter dem Pfeil Arabisch steht —
         „مَا → Dinge" ist keine Zeile zum Markieren. */
      if (istArabisch(z) && istArabisch(zielTeil(z).text)) return z;
    }
  }
  return null;
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
function marken(){
  const z = zielZeile();
  const alle = [];
  if (z){
    for (const w of aktiv.wort)
      for (const [s,e] of wortTrefferZiel(w, z)) alle.push({s, e, typ:'wort'});
    for (const name of aktiv.gram){
      const b = lek.hervorhebungen.find(h => h.name === name);
      if (!b) continue;
      const r = hervorhebung(lek, b, z);
      for (const [s,e] of r.wort)    alle.push({s, e, typ:'wort'});
      for (const [s,e] of r.zeichen) alle.push({s, e, typ:'zeichen'});
    }
  }
  return alle;
}
function deutschIst(){
  for (const name of aktiv.gram){
    const b = lek.hervorhebungen.find(h => h.name === name);
    if (b && (hervorhebung(lek, b, zielZeile()||'').deutsch)) return true;
  }
  return false;
}

/* Oben der Vorschaustreifen: fünf Kästchen nebeneinander, jedes mit dem
   vollständigen Inhalt seiner Folie — auch das der aktuellen. Hier wird
   nichts Schritt für Schritt aufgedeckt und nichts hervorgehoben. */
function zeichneVorschau(){
  const box = $('#vorschau');
  box.replaceChildren();
  for (let p = 0; p < 5; p++){
    const i = fenster + p;
    const d = document.createElement('div');
    d.className = 'vk' + (i === idx ? ' jetzt' : '') + (i >= lek.folien.length ? ' leer' : '');
    if (i < lek.folien.length){
      const f = lek.folien[i];
      d.appendChild(hueller(folieHtml(f, f.schritte.length - 1, [], null, null)));
      d.addEventListener('click', () => { if (!wurzelOffen){ idx = i; schritt = 0; setzeFenster(); zeichne(); } });
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
let einheit = null;
function einheitsGroesse(){
  const box = $('#folie');
  let klein = Infinity;
  for (const f of lek.folien){
    if (!satzfolie(f)) continue;
    box.replaceChildren(hueller(folieHtml(f, f.schritte.length - 1, [], null, null)));
    einpassen(box, 8, .6, .8);
    klein = Math.min(klein, parseFloat(box.style.fontSize));
  }
  einheit = Number.isFinite(klein) ? klein : null;
  box.replaceChildren();
}

/* In der Mitte die Folie selbst, mit allem Platz, der da ist. Sie zeigt nur,
   was bis zum aktuellen Schritt aufgedeckt ist, und trägt die Markierungen. */
function zeichneFolie(){
  const box = $('#folie');
  box.replaceChildren();
  const f = lek.folien[idx];
  const iz = deutschIst() ? zielDeutsch() : null;
  box.appendChild(hueller(folieHtml(f, schritt, marken(), zielZeile(), iz)));
  /* Die Wortfolie mit den neuen Wörtern bekommt ihre eigene Größe. Alle
     anderen nehmen die gemeinsame — und nur wenn eine Folie damit nicht
     auskommt, wird sie für sich kleiner gesetzt. */
  /* Volle Folie — vier Sätze oder mehr — braucht wenig Luft zwischen den
     Paaren, eine halbleere darf mehr haben. */
  const saetze = box.querySelectorAll('.inhalt > .zl:not(.de)').length;
  box.style.setProperty('--luft', saetze >= 4 ? '.75em' : '1.75em');
  if (einheit && !wortfolie(f)){
    box.style.fontSize = einheit + 'rem';
    if (!passtInsKaestchen(box)) einpassen(box, 8, .6, .8);
  } else einpassen(box, 8, .6, .8);   // 20 % kleiner als das, was paßen würde
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

function zeichneErklaer(){
  const box = $('#erklaer');
  box.replaceChildren();
  const inhalt = document.createElement('div'); inhalt.className = 'inhalt';
  box.appendChild(inhalt);
  for (const zeile of lek.folien[idx].erklaerung){
    const t = zeile.indexOf('Notiz für mich:');
    const haupt = t < 0 ? zeile : zeile.slice(0, t).replace(/[—–-]\s*$/, '').trim();
    if (haupt){
      const d = document.createElement('div'); d.className = 'txt';
      d.innerHTML = zeileHtml(haupt); inhalt.appendChild(d);
    }
    if (t >= 0){
      const d = document.createElement('div'); d.className = 'notiz';
      d.innerHTML = `<b>Notiz für mich:</b> ` + zeileHtml(zeile.slice(t + 'Notiz für mich:'.length).trim());
      inhalt.appendChild(d);
    }
  }
  for (const name of aktiv.gram){
    const b = lek.hervorhebungen.find(h => h.name === name);
    if (!b || !b.erklaerung.length) continue;
    const d = document.createElement('div'); d.className = 'knopftext';
    d.innerHTML = zeileHtml(b.erklaerung.join(' ')); inhalt.appendChild(d);
  }
  einpassen(box, 1.35);
}

function zeichneKnoepfe(){
  const sp = $('#spalte');
  sp.replaceChildren();
  const z = zielZeile();
  const g1 = document.createElement('div'); g1.className = 'gruppe';
  const f = lek.folien[idx];
  const aufFolie = f.schritte.slice(0, schritt+1).flat().join('\n');
  for (const w of WOERTER){
    if (!wortTreffer(w.wort, aufFolie).length) continue;
    const greift = z && wortTrefferZiel(w.wort, z).length > 0;
    const b = document.createElement('button');
    b.className = 'knopf' + (aktiv.wort.has(w.wort) ? ' an' : '');
    b.innerHTML = `<span class="w">${esc(w.wort)}</span>`;
    b.disabled = !greift;
    if (!greift) aktiv.wort.delete(w.wort);
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
    const r = z ? hervorhebung(lek, h, z) : { wort:[], zeichen:[] };
    const greift = !!(r.wort.length || r.zeichen.length || r.deutsch);
    b.className = 'knopf' + (aktiv.gram.has(h.name) ? ' an' : '');
    b.textContent = h.beschriftung;
    b.disabled = !greift;
    if (!greift) aktiv.gram.delete(h.name);
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

function setzeFenster(){
  while (idx >= fenster + 4 && fenster + 5 < lek.folien.length + 4) fenster += 4;
  while (idx < fenster) fenster = Math.max(0, fenster - 4);
  if (fenster > idx) fenster = Math.max(0, idx);
}

function zeichne(){
  if (einheit === null) einheitsGroesse();
  /* Lektionen ohne Wurzelkästen: die Erklärbox bekommt die ganze Breite. */
  $('#links').classList.toggle('ohne-wurzeln', lek.wurzeln.length === 0);
  zeichneVorschau(); zeichneFolie(); zeichneWurzeln(); zeichneErklaer(); zeichneKnoepfe(); zeichneWurzelfolie();
  $('#gesperrt').classList.toggle('an', wurzelOffen !== null);
}

/* ---------- Steuerung ------------------------------------------------- */
function vor(){
  const f = lek.folien[idx];
  if (schritt < f.schritte.length - 1) schritt++;
  else if (idx < lek.folien.length - 1){ idx++; schritt = 0; aktiv.wort.clear(); aktiv.gram.clear(); }
  else return;
  setzeFenster(); zeichne();
}
function zurueck(){
  if (schritt > 0) schritt--;
  else if (idx > 0){ idx--; schritt = lek.folien[idx].schritte.length - 1; aktiv.wort.clear(); aktiv.gram.clear(); }
  else return;
  setzeFenster(); zeichne();
}
addEventListener('keydown', e => {
  if (e.key === 'Escape'){ if (wurzelOffen !== null){ wurzelOffen = null; zeichne(); } else location.href = 'index.html'; return; }
  if (wurzelOffen !== null) { e.preventDefault(); return; }          // Navigation gesperrt
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown'){ e.preventDefault(); vor(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp'){ e.preventDefault(); zurueck(); }
  else if (e.key === 'Home'){ idx = 0; schritt = 0; fenster = 0; zeichne(); }
  else if (e.key === 'f' || e.key === 'F'){ document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
});
$('#wurzelfolie').addEventListener('click', e => { if (e.target.id === 'wurzelfolie'){ wurzelOffen = null; zeichne(); } });
addEventListener('resize', () => { einheit = null; zeichne(); });

zeichne();

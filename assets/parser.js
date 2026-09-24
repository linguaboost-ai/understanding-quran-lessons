/* Liest Folien-Lektion-01-22.txt in die Struktur, die der Vorspann beschreibt.
   Die Datei ist die einzige Inhaltsquelle — hier steht kein Lektionsinhalt. */

export function parse(text){
  const zeilen = text.split(/\r?\n/);
  let start = zeilen.findIndex(z => /^#{20,}\s*$/.test(z));   // Vorspann überspringen
  start = start < 0 ? 0 : start + 1;

  const lektionen = [];
  let lektion = null, folie = null, block = null;

  for (let i = start; i < zeilen.length; i++){
    const roh = zeilen[i], z = roh.trimEnd();
    if (/^#{20,}\s*$/.test(z)) continue;
    let m;

    if ((m = z.match(/^#### LEKTION\s+(\d+)\s*\|\s*(.+)$/))){
      lektion = { nr:+m[1], titel:m[2].trim(), folien:[], hervorhebungen:[], wurzeln:[] };
      lektionen.push(lektion); folie = null; block = null; continue;
    }
    if (/^#### FOLIE\s*$/.test(z)){
      folie = { nr: lektion.folien.length + 1, schritte: [[]], erklaerung: [] };
      lektion.folien.push(folie); block = null; continue;
    }
    if ((m = z.match(/^#### HERVORHEBUNG\s*\|\s*(.+)$/))){
      block = { name:m[1].trim(), beschriftung:'', treffer:'', erklaerung:[] };
      lektion.hervorhebungen.push(block); folie = null; continue;
    }
    if ((m = z.match(/^#### WURZEL\s*\|\s*(.+)$/))){
      block = { wort:m[1].trim(), buchstaben:[], bedeutung:'', kern:'', ableitungen:[], erklaerung:[] };
      lektion.wurzeln.push(block); folie = null; continue;
    }

    if (block){
      if ((m = z.match(/^BESCHRIFTUNG:\s*(.*)$/)))     { block.beschriftung = m[1].trim(); continue; }
      if ((m = z.match(/^TREFFER:\s*(.*)$/)))          { block.treffer = m[1].trim(); continue; }
      if ((m = z.match(/^WURZELBUCHSTABEN:\s*(.*)$/))) { block.buchstaben = m[1].trim().split(/\s+/); continue; }
      if ((m = z.match(/^BEDEUTUNG:\s*(.*)$/)))        { block.bedeutung = m[1].trim(); continue; }
      if ((m = z.match(/^KERN:\s*(.*)$/)))             { block.kern = m[1].trim(); continue; }
      if ((m = z.match(/^ABLEITUNG:\s*(.*)$/)))        { block.ableitungen.push(m[1].trim()); continue; }
      if ((m = z.match(/^>\s?(.*)$/)))                 { block.erklaerung.push(m[1]); continue; }
      continue;
    }
    if (!folie) continue;
    if (z === '+'){ folie.schritte.push([]); continue; }
    if ((m = z.match(/^>\s?(.*)$/))){ folie.erklaerung.push(m[1]); continue; }
    folie.schritte[folie.schritte.length - 1].push(roh);
  }

  for (const l of lektionen) for (const f of l.folien)
    f.schritte = f.schritte.map(s => {
      const a = [...s];
      while (a.length && !a[0].trim()) a.shift();
      while (a.length && !a[a.length-1].trim()) a.pop();
      return a;
    });

  return lektionen;
}

/* ---- Zeichenklassen und Zeilenkunde ---------------------------------- */
export const ARAB  = /[ؠ-يٱ-ۓۺ-ۿ]/;
export const DIAK  = /[ً-ْٰٓ-ٕٖ-ٟۖ-ۭ]/;
/* Fürs Vergleichen zählen weder Vokalzeichen noch Tatwîl — und auch nicht
   die unsichtbaren Verbinder U+200C/U+200D: sie legen nur die Form eines
   Buchstabens fest. Ohne sie hier fände „قَرۡيَة" sein eigenes Vorkommen
   auf der Folie nicht wieder, und der Wortknopf bliebe aus. */
const DIAK_G = new RegExp(DIAK.source + '|ـ|[\\u200C\\u200D]', 'g');

export const istArabisch = z => ARAB.test(z);
/* Fürs Vergleichen ist ٱ dasselbe wie ا: das Hamzat wasl ist eine
   Schreibweise des Artikels, kein anderer Buchstabe. So greifen die
   Wortlisten weiter, egal welche Schreibweise in der Datei steht. */
export const skelett = s => s.replace(DIAK_G, '').replace(/\u0671/g, '\u0627')
                             .replace(/[.,؟?·—→+«»]/g, '').trim();

/* Wortzeile: <Markierung>  <arabisches Wort>  —  <Bedeutung>.
   An der Struktur erkannt, nicht an einer Emoji-Liste. */
export function wortzeile(z){
  const t = z.trim();
  if (!t.includes('—')) return null;
  const links = t.slice(0, t.indexOf('—')).trim();
  if (!links || ARAB.test(links[0])) return null;
  const m = links.match(/^(\S+)\s+(.+)$/);
  if (!m || !ARAB.test(m[2])) return null;
  return { markierung:m[1], wort:m[2].trim(), bedeutung:t.slice(t.indexOf('—')+1).trim() };
}

/* Eine Zeile, auf die sich die Knöpfe beziehen können: arabisch, aber keine
   Vokabelzeile und keine Umformung. Der Gedankenstrich allein schließt nichts
   aus — „مَنْ هٰذَا؟ — هٰذَا رَجُلٌ." ist ein Satz, keine Vokabel. */
export const satzzeile = z => istArabisch(z) && !wortzeile(z) && !z.includes('→');

/* Auf welchem Stück einer Zeile wird markiert?
     Vokabelzeile „Emoji Wort — Bedeutung"  →  nur das arabische Wort
     Pfeilzeile   „X → Y"                   →  nur das Ergebnis hinter dem Pfeil
     sonst                                 →  die ganze Zeile
   So trifft keine Regel die deutsche Bedeutung oder die Ausgangsform. */
export function zielTeil(zeile){
  const wz = wortzeile(zeile);
  if (wz) return { text: wz.wort, off: zeile.indexOf(wz.wort) };
  const i = zeile.lastIndexOf('→');
  if (i >= 0){
    const rest = zeile.slice(i + 1);
    const v = rest.search(/\S/);
    if (v >= 0) return { text: rest.slice(v), off: i + 1 + v };
  }
  return { text: zeile, off: 0 };
}

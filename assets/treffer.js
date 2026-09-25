/* Setzt die 48 TREFFER-Felder in Markierungen um.
   Jede Regel bekommt die zuletzt erschienene Zeile und liefert Bereiche:
     wort    — ganze Wörter oder Wortgruppen, farbig
     zeichen — einzelne Vokalzeichen, farbig und vergrößert
     deutsch — Sonderfall „Kein ist": Markierung in der deutschen Zeile */
import { skelett, ARAB, wortzeile, zielTeil } from './parser.js';
import { wurzelTreffer } from './wurzel.js';

const SATZZEICHEN = /[.,؟?·—→«»]/;
const DIAKRIT = /[ً-ْٰٓ-ٕ]/;

/* Die Quelle schreibt den Sukun wie im Quran: ۡ, der Kopf des Chā.
   Für den Abgleich zählt er wie der gewöhnliche Kreis-Sukun ْ — beide sind
   ein Zeichen lang, die Stellen im Text bleiben also dieselben. */
const einSukun = s => s.replace(/\u06E1/g, '\u0652');

export function tokens(zeile){
  const out = [], re = /\S+/g; let m;
  while ((m = re.exec(zeile))){
    let e = m.index + m[0].length;
    while (e > m.index && SATZZEICHEN.test(zeile[e-1])) e--;      // Punkt nicht mitmarkieren
    out.push({ t: einSukun(zeile.slice(m.index, e)), s: m.index, e, roh: m[0] });
  }
  return out;
}
const leer = () => ({ wort: [], zeichen: [] });
const spanne = (a, b) => [a.s, b.e];

/* Angehängte Pronomen tragen eigene Vokalzeichen. Die Kasusendung des Nomens
   steht davor — also erst den Anhang abschneiden. */
const ANHANG = ['هُمْ','هِمْ','هُنَّ','كُمْ','كُنَّ','هَا','نَا','هُ','هِ','كَ','كِ'];
function ohneAnhang(tok){
  /* Der Gottesname endet auf ـه, das zum Namen gehört. Die Prüfung „steht
     davor eine Kasusendung?" trägt hier nicht: in ٱللّٰه steht davor das
     Dolch-Alif, und ـهِ sähe aus wie das angehängte „sein". */
  if (istGottesname(tok)) return tok.e;
  for (const a of ANHANG){
    if (!tok.t.endsWith(a) || tok.t.length <= a.length + 1) continue;
    /* Vor dem Anhang muß die Kasusendung stehen — sonst ist es kein Anhang,
       sondern Teil des Wortes wie das ه in اللهُ. */
    const stamm = tok.t.slice(0, tok.t.length - a.length);
    if (DIAKRIT.test(stamm.slice(-1))) return tok.e - a.length;
  }
  return tok.e;
}
/* letztes Vokalzeichen eines Wortes = seine Endung */
function endung(tok){
  const ende = ohneAnhang(tok);
  for (let i = ende - 1; i >= tok.s; i--){
    if (DIAKRIT.test(tok.t[i - tok.s])) {
      let j = i;
      while (j > tok.s && DIAKRIT.test(tok.t[j-1-tok.s])) j--;
      return [j, i+1];
    }
  }
  return null;
}
/* jedes Vorkommen eines Zeichens in der Zeile */
const zeichenAlle = (z, ch) => [...z].flatMap((c,i) => c === ch ? [[i,i+1]] : []);
/* Zeichen nur am Wortende */
const zeichenAmEnde = (z, ch) => tokens(z).flatMap(t => t.t.endsWith(ch) ? [[t.e-1, t.e]] : []);

const inListe = (tok, liste) => liste.includes(skelett(tok.t));
const woerter = (z, liste) => tokens(z).filter(t => inListe(t, liste)).map(t => [t.s, t.e]);

const ZEIGE  = ['هٰذَا','هٰذِهِ','ذٰلِكَ','تِلْكَ','أُولٰئِكَ','هٰؤُلَاءِ'].map(skelett);
const PRAEP  = ['فِي','مِنْ','عَلَىٰ','إِلَىٰ','مَعَ','بَيْنَ','عِنْدَ','قَبْلَ','بَعْدَ','دُونَ'].map(skelett);
const FRAGE  = ['مَا','مَنْ'].map(skelett);
const PRONOM = ['هُوَ','هِيَ','هُمْ','أَنَا','أَنْتَ','أَنْتُمْ','نَحْنُ'].map(skelett);
/* Urwörter: Zeigewörter, Fragewörter, Präpositionen, Pronomen. An ihnen hängt
   kein Possessiv — das هِ in هٰذِهِ gehört zum Wort selbst.
   Nur das nackte Wort zählt: فِيهَا ist keins mehr. */
const URWORT = [...ZEIGE, ...FRAGE, ...PRAEP, ...PRONOM];
/* Der Gottesname zählt hier mit: an ihm hängt nie ein Possessiv. Beide
   Schreibweisen, mit und ohne Hamzat wasl — skelett läßt den Buchstaben ٱ
   stehen, weil er ein Buchstabe ist und kein Vokalzeichen. */
const GOTTESNAME = ['\u0671\u0644\u0644\u0647', '\u0627\u0644\u0644\u0647'];
const istGottesname = t => GOTTESNAME.includes(skelett(t.t));
const istUrwort = t => URWORT.includes(skelett(t.t)) || istGottesname(t);

/* Wort direkt hinter einem Anker */
function hinter(z, anker){
  const tk = tokens(z);
  const i = tk.findIndex(t => inListe(t, anker));
  return (i >= 0 && i < tk.length-1) ? tk[i+1] : null;
}

/* ---- die Regeln, nach Lektion und Name ------------------------------- */
const R = {};
/* Der Schlüssel gleicht die Schreibweise an: Regelnamen wie „Kein الـ"
   stehen in der Quelldatei und können dort mit oder ohne Hamzat wasl
   geschrieben sein. Ohne das Angleichen fände der Name seine Regel
   nicht mehr, sobald die Datei die andere Schreibweise benutzt. */
const schluessel = (lek, name) => lek + '|' + name.replace(/\u0671/g, '\u0627');
const setze = (lek, name, fn) => { R[schluessel(lek, name)] = fn; };

// L1
setze(1,'Tanwîn',        (l,b,z) => ({ wort:[], zeichen: zeichenAlle(z,'ٌ') }));
// L2
setze(2,'Fragewort',     (l,b,z) => { const t=tokens(z)[0]; return t && inListe(t,FRAGE) ? {wort:[[t.s,t.e]],zeichen:[]} : leer(); });
setze(2,'Antwortsatz',   (l,b,z) => { const i=z.indexOf('—'); if(i<0) return leer();
                                      const rest=z.slice(i+1); const v=rest.search(/\S/);
                                      return v<0?leer():{wort:[[i+1+v, z.length]],zeichen:[]}; });
// L3
setze(3,'Ta marbûtah',   (l,b,z) => ({ wort:[], zeichen: zeichenAmEnde(z,'ة').concat(
                                        tokens(z).flatMap(t=>/ة[ً-ْ]$/.test(t.t)?[[t.e-2,t.e-1]]:[])) }));
setze(3,'Zeigewort',     (l,b,z) => { const t=tokens(z)[0]; return t&&inListe(t,ZEIGE)?{wort:[[t.s,t.e]],zeichen:[]}:leer(); });
// L4
setze(4,'Kein ة',        (l,b,z) => { const tk=tokens(z); const t=tk[tk.length-1];
                                      return t && !/ة/.test(t.t) ? {wort:[[t.s,t.e]],zeichen:[]} : leer(); });
setze(4,'Zeigewort',     (l,b,z) => R['3|Zeigewort'](l,b,z));
// L5
setze(5,'Eigenschaftswort',(l,b,z)=>{ const tk=tokens(z); return tk.length<2?leer():{wort:[spanne(tk[tk.length-1],tk[tk.length-1])],zeichen:[]}; });
setze(5,'Angleichung',   (l,b,z) => { const tk=tokens(z); const t=tk[tk.length-1]; if(!t) return leer();
                                      const i=t.t.lastIndexOf('ة'); return i<0?leer():{wort:[],zeichen:[[t.s+i,t.s+i+1]]}; });
setze(5,'Gleiche Endung',(l,b,z) => ({ wort:[], zeichen: zeichenAlle(z,'ٌ') }));
// L6
/* الـ am Wortanfang, auch hinter وَ oder فَ. Gibt die Stelle des ال zurück. */
function artikel(t){
  /* Der Artikel wird mit Hamzat wasl geschrieben; die schlichte Schreibweise
     zählt weiter mit, falls sie irgendwo steht. Der Gottesname trägt keinen
     Artikel — sein ٱل gehört zum Namen. */
  if (istGottesname(t)) return null;
  if (!/^[وف]?[ً-ْ]?[اٱ]ل/.test(t.t)) return null;
  const at = t.t.search(/[اٱ]/);
  return [t.s + at, t.s + at + 2];
}
setze(6,'Der Artikel',   (l,b,z) => ({ wort: tokens(z).map(artikel).filter(Boolean), zeichen:[] }));
setze(6,'Die Endung',    (l,b,z) => { const t=tokens(z).find(artikel); if(!t) return leer();
                                      const e=endung(t); return e?{wort:[],zeichen:[e]}:leer(); });
/* „das Adjektiv am Satzende": mindestens zwei Wörter, und das letzte trägt
   kein الـ — sonst ist es eine Wortgruppe und noch keine Aussage. */
setze(6,'Das Eigenschaftswort',(l,b,z)=>{ const tk=tokens(z); if(tk.length<2) return leer();
                                      const t=tk[tk.length-1];
                                      return artikel(t) ? leer() : {wort:[[t.s,t.e]],zeichen:[]}; });
/* „beide الـ, am Nomen und am Adjektiv": zwei aufeinanderfolgende Wörter mit الـ. */
setze(6,'Zweimal الـ',   (l,b,z) => { const tk=tokens(z);
                                      for(let i=0;i<tk.length-1;i++){ const a=artikel(tk[i]), c=artikel(tk[i+1]);
                                        if(a&&c) return {wort:[a,c],zeichen:[]}; }
                                      return leer(); });
// L7
setze(7,'Zeigewort',     (l,b,z) => R['3|Zeigewort'](l,b,z));
// L8
setze(8,'Erstes Wort',   (l,b,z) => { const tk=tokens(z); return tk.length<2?leer():{wort:[[tk[tk.length-2].s,tk[tk.length-2].e]],zeichen:[]}; });
setze(8,'Zweites Wort',  (l,b,z) => { const tk=tokens(z); return tk.length<2?leer():{wort:[[tk[tk.length-1].s,tk[tk.length-1].e]],zeichen:[]}; });
// L9
setze(9,'Das kleine Wort',(l,b,z)=> ({ wort: woerter(z, PRAEP), zeichen:[] }));
setze(9,'Die Endung',    (l,b,z) => { const t=hinter(z,PRAEP); if(!t) return leer();
                                      const e=endung(t); return e?{wort:[],zeichen:[e]}:leer(); });
// L10
setze(10,'Das angeklebte Wort',(l,b,z)=>({ wort:[], zeichen: tokens(z).flatMap(t=>/^[بل][ً-ْ]/.test(t.t)?[[t.s,t.s+2]]:[]) }));
/* Die Endung sitzt am Nomen dahinter — auf dem nackten بِـ der Vokabelzeile
   gibt es keins, also auch nichts zu zeigen. */
setze(10,'Die Endung',   (l,b,z) => { const t=tokens(z).find(x=>/^[بل][ً-ْ]/.test(x.t) && skelett(x.t).length > 2);
                                      if(!t) return leer();
                                      const e=endung(t); return e?{wort:[],zeichen:[e]}:leer(); });
setze(10,'Die Verschmelzung',(l,b,z)=>({ wort: tokens(z).flatMap(t=>/^ل[ً-ْ]?ل/.test(t.t)?[[t.s,t.s+3]]:[]), zeichen:[] }));
// L11 / L12
setze(11,'Das Pronomen', (l,b,z) => ({ wort: woerter(z, ['هُوَ','هِيَ','هُمْ'].map(skelett)), zeichen:[] }));
/* Die Lücke liegt zwischen Pronomen und Aussage — es muß also ein Pronomen
   am Anfang stehen und etwas darauf folgen. Gezeigt wird sie im Deutschen. */
const keinIst = liste => (l,b,z) => { const tk = tokens(z), p = liste.map(skelett);
  return tk.length > 1 && p.includes(skelett(tk[0].t))
       ? { wort:[], zeichen:[], deutsch:true } : leer(); };
setze(11,'Kein „ist"',   keinIst(['هُوَ','هِيَ','هُمْ']));
setze(12,'Das Pronomen', (l,b,z) => ({ wort: woerter(z, ['أَنَا','أَنْتُمْ','أَنْتَ','نَحْنُ'].map(skelett)), zeichen:[] }));
setze(12,'Kein „ist"',   keinIst(['أَنَا','أَنْتُمْ','أَنْتَ','نَحْنُ']));
// L13 / L14 / L15 — angehängte Endungen
/* Ein Anhang sitzt hinter der Kasusendung des Nomens. Steht dort keine —
   اللهِ — oder ist das Wort ein Urwort — هٰذِهِ —, ist es kein Anhang. */
function anhang(t, liste){
  if (istUrwort(t)) return null;
  for (const s of liste){
    if (!t.t.endsWith(s) || skelett(t.t) === skelett(s)) continue;
    const stamm = t.t.slice(0, t.t.length - s.length);
    if (DIAKRIT.test(stamm.slice(-1))) return s;
  }
  return null;
}
const endeAuf = liste => (l,b,z) => ({ wort:[], zeichen: tokens(z).flatMap(t=>{
  const s = anhang(t, liste); return s ? [[t.e-s.length, t.e]] : []; }) });
const wortMitEndung = liste => (l,b,z) => ({ wort: tokens(z).flatMap(t=>{
  return anhang(t, liste) ? [[t.s,t.e]] : []; }), zeichen:[] });
setze(13,'Die Endung',   endeAuf(['هُ','هِ','هَا','هُمْ']));
setze(13,'Kein الـ',     wortMitEndung(['هُ','هِ','هَا','هُمْ']));
setze(14,'Die Endung',   endeAuf(['كَ','كُمْ','نَا']));
setze(14,'Kein الـ',     wortMitEndung(['كَ','كُمْ','نَا']));
/* ـهُ allein ist die nackte Endung aus der Aufgabenstellung, kein Wort. */
const nacktesEnde = t => /^ـ/.test(t.t);
setze(15,'Der Vokal davor',(l,b,z)=>{ for(const t of tokens(z)){ if(istUrwort(t)||nacktesEnde(t)) continue;
    for(const s of ['هِ','هِمْ','هُ','هُمْ','كُمْ'])
      if(t.t.endsWith(s)){ const p=t.e-s.length-1; return p>=t.s?{wort:[],zeichen:[[p,p+1]]}:leer(); } } return leer(); });
/* Hier zählt nur die Form am Wortende. Vor ـهِ steht in فِيهِ oder عَلَيْهِ
   keine Kasusendung, sondern ein langer Vokal — genau darum geht die Lektion. */
setze(15,'Die veränderte Endung',(l,b,z)=>({ wort:[], zeichen: tokens(z).flatMap(t=>{
  if (istUrwort(t) || nacktesEnde(t)) return [];
  for (const e of ['هِمْ','هِ'])
    if (t.t.endsWith(e) && skelett(t.t) !== skelett(e)) return [[t.e-e.length, t.e]];
  return []; }) }));
setze(15,'Das veränderte Wort',(l,b,z)=>({ wort:[], zeichen: tokens(z).flatMap(t=>/^لَ/.test(t.t)?[[t.s,t.s+2]]:[]) }));
// L16 / L17 / L18
setze(16,'Die Mehrzahlendung',(l,b,z)=>({ wort:[], zeichen: tokens(z).flatMap(t=>/ُونَ?$/.test(t.t)?[[t.e-(/َ$/.test(t.t)?4:3), t.e]]:[]) }));
setze(16,'Die drei neuen Wörter',(l,b,z)=>({ wort: woerter(z, ['قَبْلَ','بَعْدَ','عِنْدَ'].map(skelett)), zeichen:[] }));
setze(17,'Die Endung',   (l,b,z) => ({ wort:[], zeichen: tokens(z).flatMap(t=>{const i=t.t.search(/ِين/); return i<0?[]:[[t.s+i, t.e]];}) }));
setze(17,'Der Auslöser', (l,b,z) => { const tk=tokens(z); const i=tk.findIndex(t=>/ِين/.test(t.t));
                                      return i<1?leer():{wort:[[tk[i-1].s,tk[i-1].e]],zeichen:[]}; });
setze(18,'Die Mehrzahlendung',(l,b,z)=>({ wort:[], zeichen: tokens(z).flatMap(t=>{const i=t.t.search(/َات/); return i<0?[]:[[t.s+i,t.s+i+3]];}) }));
setze(18,'Das Zeigewort',(l,b,z)=>({ wort: woerter(z, ['أُولٰئِكَ','هٰؤُلَاءِ'].map(skelett)), zeichen:[] }));
// L19 — Wurzelbuchstaben im letzten Lektionswort der Zeile
function letztesWurzelwort(lek, z){
  const tk = tokens(z);
  for (let i = tk.length-1; i >= 0; i--){
    const s = skelett(tk[i].t);
    const w = lek.wurzeln.find(w => s.includes(skelett(w.wort)));
    if (w){ const t = wurzelTreffer(tk[i].t, w.buchstaben); if (t.ok) return { tok:tk[i], treffer:t.treffer }; }
  }
  return null;
}
setze(19,'Die drei Buchstaben',(l,b,z)=>{ const f=letztesWurzelwort(l,z); if(!f) return leer();
  return { wort:[], zeichen: f.treffer.map(i=>[f.tok.s+i, f.tok.s+i+1]) }; });
setze(19,'Die Vokale',   (l,b,z)=>{ const f=letztesWurzelwort(l,z); if(!f) return leer();
  // nur die Zeichen ZWISCHEN dem ersten und letzten Wurzelbuchstaben
  const von=Math.min(...f.treffer), bis=Math.max(...f.treffer), aus=[];
  for(let i=von;i<=bis;i++) if(DIAKRIT.test(f.tok.t[i]) && !f.treffer.includes(i)) aus.push([f.tok.s+i, f.tok.s+i+1]);
  return { wort:[], zeichen: aus }; });
// L20
const REL = ['الَّذِي','الَّتِي','الَّذِينَ'].map(skelett);
setze(20,'Das Anschlusswort',(l,b,z)=>({ wort: woerter(z, REL), zeichen:[] }));
setze(20,'Der Nebensatz',(l,b,z)=>{ const tk=tokens(z); const r=tk.findIndex(t=>inListe(t,REL));
  if(r<0) return leer();
  const letzt=tk[tk.length-1];
  const gebunden = tk.length<2 || /^وَ/.test(letzt.t) || (tk.length>=2 && inListe(tk[tk.length-2],PRAEP));
  const bis = gebunden ? tk.length-1 : tk.length-2;
  return bis<r ? leer() : { wort:[spanne(tk[r], tk[bis])], zeichen:[] }; });
// L21 / L22
setze(21,'Das Wort davor',(l,b,z)=>{ const t=tokens(z)[0]; return t&&['إِنَّ','إِنَّمَا'].map(skelett).includes(skelett(t.t))?{wort:[[t.s,t.e]],zeichen:[]}:leer(); });
setze(21,'Die Endung a', (l,b,z)=>{ const t=hinter(z,['إِنَّ','إِنَّمَا'].map(skelett)); if(!t) return leer();
  const e=endung(t); return e?{wort:[],zeichen:[e]}:leer(); });
setze(22,'Das Verneinungswort',(l,b,z)=>({ wort: tokens(z).filter(t=>['لَا','مَا'].map(skelett).includes(skelett(t.t))).map(t=>[t.s,t.e]), zeichen:[] }));
setze(22,'Die Endung a', (l,b,z)=>{ const t=hinter(z,['لَا','مَا'].map(skelett)); if(!t) return leer();
  const e=endung(t); return e?{wort:[],zeichen:[e]}:leer(); });
setze(22,'Die Ausnahme', (l,b,z)=>{ const tk=tokens(z); const i=tk.findIndex(t=>skelett(t.t)===skelett('إِلَّا'));
  return i<0?leer():{wort:[[tk[i].s, z.length]],zeichen:[]}; });

/* Öffentlich: liefert die Markierungen für einen Hervorhebungsblock. */
/* Die Regel arbeitet nur auf dem markierbaren Stück der Zeile (zielTeil):
   sonst träfe „das Eigenschaftswort" die deutsche Bedeutung „wissend"
   oder „الـ am Wortanfang" die Ausgangsform vor dem Pfeil. */
const ohneArabisch = z => !ARAB.test(z);
export function hervorhebung(lektion, block, zeile){
  const fn = R[schluessel(lektion.nr, block.name)];
  if (!fn || !zeile) return leer();
  const { text, off } = zielTeil(zeile);
  let r;
  try { r = fn(lektion, block, text) || leer(); } catch(e){ return leer(); }
  const sauber = liste => (liste || [])
    .map(([x,y]) => [x + off, y + off])
    .filter(([x,y]) => !ohneArabisch(zeile.slice(x,y)) || /[\u064B-\u0652\u0670\u06E1]/.test(zeile.slice(x,y)));
  return { wort: sauber(r.wort), zeichen: sauber(r.zeichen), deutsch: r.deutsch };
}

/* Wortknopf: das neue Wort im Satz finden. Treffer nur, wenn das Skelett den
   ganzen Token ausmacht — abzüglich erlaubter Vorsilben und Endungen. */
const VORSILBEN = ['','ال','و','ف','ب','ل','ك','وال','فال','بال','لل','كال'];
const NACHSILBEN = ['','ه','ها','هم','هن','ك','كم','كن','نا','ي','ون','ين','ات','ان'];
export function wortTreffer(wort_, zeile){
  const wort = einSukun(wort_);
  const k = skelett(wort);
  /* Vorsilbe: am Tatwîl zu erkennen — بِـ, لِـ —, aber auch daran, daß das
     Wort aus einem einzigen Buchstaben besteht. Ein Buchstabe mit seinem
     Vokal steht im Arabischen nicht für sich: وَ klebt am folgenden Wort.
     So greift der Knopf auch dort, wo die Datei kein Tatwîl schreibt. */
  const endung_ = /^ـ/.test(wort), vorsilbe = /ـ$/.test(wort) || k.length === 1;
  const rein = wort.replace(/^ـ|ـ$/g,'');   // vokalisiert, ohne Tatweel
  const kk = k.replace(/^ـ|ـ$/g,'');
  return tokens(zeile).flatMap(t => {
    const ts = skelett(t.t);
    /* tt nur zum Vergleichen: t.t behält seine Länge, weil andere Regeln
       darin Stellen abzählen. Zurück kommt ohnehin das ganze Wort. */
    const tt = t.t.replace(/[\u200C\u200D]/g, '');
    /* Anhänge und Vorsilben zeichengenau, nicht über das Skelett: sonst fängt
       „ـهُ“ auch اللهُ und هٰذِهِ. Vor dem Anhang muß die Kasusendung stehen. */
    if (endung_){
      if (!tt.endsWith(rein) || ts === kk) return [];
      const stamm = tt.slice(0, tt.length - rein.length);
      return DIAKRIT.test(stamm.slice(-1)) ? [[t.s,t.e]] : [];
    }
    if (vorsilbe){
      if (!tt.startsWith(rein)) return [];
      /* Steht die Vorsilbe für sich allein, zählt sie nur, wenn die Datei
         kein Tatwîl schreibt: „وَ" hat in Lektion 1 eine eigene Folie und
         wird dort markiert; „بِـ" mit Tatwîl meint ausdrücklich das Kleben
         am folgenden Wort und trifft die nackte Vorsilbe nicht. */
      return (ts !== kk || !/ـ$/.test(wort)) ? [[t.s,t.e]] : [];
    }
    for (const v of VORSILBEN) for (const n of NACHSILBEN)
      if (ts === v + kk + n) return [[t.s,t.e]];
    return [];
  });
}

/* Wortknopf auf der Zielzeile — dieselbe Einschränkung wie bei den Regeln. */
export function wortTrefferZiel(wort, zeile){
  const { text, off } = zielTeil(zeile);
  return wortTreffer(wort, text).map(([a,b]) => [a + off, b + off]);
}

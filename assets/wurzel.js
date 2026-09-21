/* Wurzelbuchstaben-Abgleich genau nach dem Vorspann:
   strikt der Reihe nach, Zwischenbuchstaben überspringen, Vokalzeichen zählen
   nicht mit, immer das erste passende Vorkommen, Schadda = zwei gleiche. */
const SCHADDA = 'ّ';
const VOKAL   = /[ً-ِْ-ٰٟۖ-ۭ]/;
const SCHWACH = new Set(['ا','و','ي','ى','آ']);
const HAMZA   = new Set(['ء','أ','إ','آ','ؤ','ئ']);

const gleich = (a,b) => a===b
  || (SCHWACH.has(a) && SCHWACH.has(b))
  || (HAMZA.has(a)   && HAMZA.has(b));

/* Liefert die Indizes der drei Wurzelbuchstaben im Wort — oder ok:false. */
export function wurzelTreffer(wort, wurzel){
  const buchst = [];
  for (let i = 0; i < wort.length; i++){
    const c = wort[i];
    if (VOKAL.test(c)) continue;
    if (c === SCHADDA){ if (buchst.length) buchst[buchst.length-1].schadda = true; continue; }
    if (/\s|[.,؟?·—→+«»]/.test(c)) continue;
    buchst.push({ c, i, schadda:false });
  }
  const treffer = [];
  let p = 0, offen = null;                       // offen: Schadda-Buchstabe, zählt noch einmal
  for (const w of wurzel){
    if (offen && gleich(offen.c, w)){ treffer.push(offen.i); offen = null; continue; }
    let gef = -1;
    for (let k = p; k < buchst.length; k++) if (gleich(buchst[k].c, w)){ gef = k; break; }
    if (gef < 0) return { ok:false, treffer, fehlt:w };
    treffer.push(buchst[gef].i);
    offen = buchst[gef].schadda ? buchst[gef] : null;
    p = gef + 1;
  }
  return { ok:true, treffer };
}

/* Das Sprechskript. Aufbau der Datei:

     #### SKRIPT LEKTION 1 | Zeigesätze
     [Folie 1 und 2 — Titel]
     … gesprochener Text …
     [Knopf: Endung hervorheben]
     … gesprochener Text …

   Eine Marke in eckigen Klammern eröffnet einen Abschnitt. Nennt sie mehrere
   Folien, gilt der Abschnitt für jede davon. Eine Knopf-Marke nennt keine
   Folie — sie gehört zu der zuletzt genannten und wird an sie angehängt. */
export function parseSkript(text){
  const kurs = new Map();                 // Lektion → Map(Folie → [Abschnitt])
  let lek = 0, folien = [], akt = null;
  for (const roh of text.split('\n')){
    const z = roh.trim();
    const ml = z.match(/^#### SKRIPT LEKTION (\d+)/);
    if (ml){ lek = +ml[1]; kurs.set(lek, new Map()); folien = []; akt = null; continue; }
    const mk = z.match(/^\[(.+)\]$/);
    if (mk && lek){
      const titel = mk[1];
      const f = titel.match(/^Folie\s+([^—]+?)\s*—/);
      if (f) folien = (f[1].match(/\d+/g) || []).map(Number);
      /* Eine Marke, die weder eine Folie nennt noch „Knopf:" ist — etwa
         „Entfallen — …" —, gehört zu keiner Folie mehr. Ihr Text bleibt in
         der Datei stehen, wird aber nicht angezeigt. */
      else if (!/^Knopf/.test(titel)) folien = [];
      akt = { titel, text: [] };
      for (const n of folien){
        const m = kurs.get(lek);
        if (!m.has(n)) m.set(n, []);
        m.get(n).push(akt);
      }
      continue;
    }
    /* Die Trennlinien zwischen den Lektionen gehören zu keinem Abschnitt.
       Stünden sie im Text, ließe sich die Zeile nicht umbrechen und der
       Kasten schrumpfte auf den Anschlag, um sie unterzubringen. */
    if (/^[=~_*-]{3,}$/.test(z)) continue;
    if (akt && z) akt.text.push(z);
  }
  return kurs;
}

/* „Folie 3 — die drei Wörter" wird zweizeilig gesetzt: die Nummer oben, die
   Beschreibung darunter. Sonst bricht der Titel an beliebiger Stelle um. */
export function titelTeile(t){
  const i = t.indexOf('—');
  if (i > 0) return [t.slice(0, i).trim(), t.slice(i + 1).trim()];
  const j = t.indexOf(':');
  if (j > 0) return [t.slice(0, j + 1).trim(), t.slice(j + 1).trim()];
  return [t, ''];
}

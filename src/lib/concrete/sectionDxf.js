// Esportazione DXF dei disegni del progetto sezione (unità mm):
//  - buildSectionDxf: sezione progettata quotata, scala 1:1;
//  - buildForcesDxf: sezione di lato con diagramma σc, forze interne e bracci
//    (altezze in scala 1:1, sviluppi orizzontali schematici come a schermo).
//
// Formato AutoCAD R12 (AC1009) volutamente minimale, letto senza errori da
// AutoCAD, BricsCAD, DraftSight, LibreCAD, QCAD e dai visualizzatori online:
// solo entità elementari (POLYLINE, CIRCLE, LINE, SOLID, TEXT). Le quote sono
// disegnate con linee, frecce piene e testi (nessuna entità DIMENSION né blocchi
// anonimi, che nelle versioni R12 sono la causa tipica dei file "non validi").

function num(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    const s = n.toFixed(4).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    return s === "-0" ? "0" : s;
}

const lbl = (value) => Number(value).toLocaleString("it-IT", { useGrouping: false, maximumFractionDigits: 1 });

// testo DXF: φ → %%c (diametro), − → "-", gli altri caratteri non ASCII
// (Ψ, λ, β, σ, ·, ∫ …) con la sequenza \U+XXXX letta da AutoCAD
const dxfText = (text) => String(text)
    .replace(/φ/g, "%%c").replace(/−/g, "-")
    .replace(/[^\x20-\x7e]/g, (ch) => `\\U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`);

// ---------------------------------------------------------------------------
// scrittore DXF R12 condiviso dai due disegni
// ---------------------------------------------------------------------------
function createDxf(TH) {
    const GAP = 2.2 * TH;   // distanza tra le linee di quota
    const ARW = 1.2 * TH;   // lunghezza delle frecce
    const ent = [];
    const push = (type, layer, pairs) => {
        ent.push("0", type, "8", layer);
        pairs.forEach(([c, v]) => ent.push(String(c), String(v)));
    };
    const line = (x1, y1, x2, y2, layer = "QUOTE") => push("LINE", layer, [
        [10, num(x1)], [20, num(y1)], [30, 0], [11, num(x2)], [21, num(y2)], [31, 0],
    ]);
    const circle = (x, y, r, layer) => push("CIRCLE", layer, [[10, num(x)], [20, num(y)], [30, 0], [40, num(r)]]);
    const poly = (pts, layer, closed = true) => {
        ent.push("0", "POLYLINE", "8", layer, "66", "1", "10", "0", "20", "0", "30", "0", "70", closed ? "1" : "0");
        pts.forEach(({ x, y, bulge }) => {
            ent.push("0", "VERTEX", "8", layer, "10", num(x), "20", num(y), "30", "0");
            if (bulge) ent.push("42", num(bulge));
        });
        ent.push("0", "SEQEND", "8", layer);
    };
    // freccia piena (triangolo) con la punta in (x, y) e direzione (ux, uy)
    const arrow = (x, y, ux, uy, layer = "QUOTE", len = ARW) => {
        const m = Math.hypot(ux, uy) || 1; ux /= m; uy /= m;
        const bx = x - ux * len, by = y - uy * len, wx = -uy * len / 6, wy = ux * len / 6;
        push("SOLID", layer, [
            [10, num(x)], [20, num(y)], [30, 0],
            [11, num(bx + wx)], [21, num(by + wy)], [31, 0],
            [12, num(bx - wx)], [22, num(by - wy)], [32, 0],
            [13, num(bx - wx)], [23, num(by - wy)], [33, 0],
        ]);
    };
    // testo in (x, y): align "c" centrato, "l" a sinistra, "r" a destra (sempre a metà altezza);
    // "base" = punto di inserimento sulla linea di base, allineato a sinistra
    const JUST = { c: 1, l: 0, r: 2 };
    const text = (s, x, y, { h = TH, rot = 0, layer = "TESTI", align = "c" } = {}) => push("TEXT", layer, [
        [10, num(x)], [20, num(y)], [30, 0], [40, num(h)], [1, dxfText(s)], [50, num(rot)],
        ...(align === "base" ? [] : [[72, JUST[align]], [73, 2], [11, num(x)], [21, num(y)], [31, 0]]),
    ]);
    // quota orizzontale tra x1 e x2, linea di quota a yDim, linee di richiamo da yEdge
    const hDim = (label, x1, x2, yDim, yEdge, above = yDim > yEdge, layer = "QUOTE") => {
        const s = Math.sign(yDim - yEdge) || -1;
        line(x1, yEdge + s * TH * 0.3, x1, yDim + s * TH * 0.4, layer);
        line(x2, yEdge + s * TH * 0.3, x2, yDim + s * TH * 0.4, layer);
        line(x1, yDim, x2, yDim, layer);
        const inside = Math.abs(x2 - x1) >= 2.4 * ARW;
        if (inside) { arrow(x1, yDim, -1, 0, layer); arrow(x2, yDim, 1, 0, layer); } else { arrow(x1, yDim, 1, 0, layer); arrow(x2, yDim, -1, 0, layer); }
        text(label, (x1 + x2) / 2, yDim + (above ? 0.9 : -0.9) * TH);
    };
    // quota verticale tra y1 e y2, linea di quota a xDim, linee di richiamo da xEdge
    const vDim = (label, y1, y2, xDim, xEdge, layer = "QUOTE") => {
        const s = Math.sign(xDim - xEdge) || -1;
        const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
        line(xEdge + s * TH * 0.3, lo, xDim + s * TH * 0.4, lo, layer);
        line(xEdge + s * TH * 0.3, hi, xDim + s * TH * 0.4, hi, layer);
        line(xDim, lo, xDim, hi, layer);
        const inside = hi - lo >= 2.4 * ARW;
        if (inside) { arrow(xDim, lo, 0, -1, layer); arrow(xDim, hi, 0, 1, layer); } else { arrow(xDim, lo, 0, 1, layer); arrow(xDim, hi, 0, -1, layer); }
        text(label, xDim - 0.9 * TH, (lo + hi) / 2, { rot: 90 });
    };

    // file completo: intestazione, tabelle (vista, tipi di linea, layer, stile) ed entità
    const build = (ext, layers) => {
        const vc = { x: (ext.x0 + ext.x1) / 2, y: (ext.y0 + ext.y1) / 2 };
        const vSize = 1.1 * Math.max(ext.y1 - ext.y0, (ext.x1 - ext.x0) / 1.6); // altezza della vista iniziale
        const dash = Math.max(4, Math.round(TH)), gap = Math.max(2, Math.round(TH / 2));
        const out = [
            "0", "SECTION", "2", "HEADER",
            "9", "$ACADVER", "1", "AC1009",
            "9", "$INSBASE", "10", "0", "20", "0", "30", "0",
            "9", "$EXTMIN", "10", num(ext.x0), "20", num(ext.y0), "30", "0",
            "9", "$EXTMAX", "10", num(ext.x1), "20", num(ext.y1), "30", "0",
            "9", "$LIMMIN", "10", num(ext.x0), "20", num(ext.y0),
            "9", "$LIMMAX", "10", num(ext.x1), "20", num(ext.y1),
            "9", "$VIEWCTR", "10", num(vc.x), "20", num(vc.y),
            "9", "$VIEWSIZE", "40", num(vSize),
            "9", "$FASTZOOM", "70", "1",
            "9", "$REGENMODE", "70", "1",
            "9", "$FILLMODE", "70", "1",
            "9", "$LTSCALE", "40", "1",
            "9", "$TEXTSIZE", "40", num(TH),
            "9", "$TEXTSTYLE", "7", "STANDARD",
            "9", "$CLAYER", "8", "0",
            "9", "$LUNITS", "70", "2",
            "9", "$LUPREC", "70", "2",
            "0", "ENDSEC",
            "0", "SECTION", "2", "TABLES",
            // vista attiva inquadrata sul disegno, zoom veloce (73 = 1) e
            // risoluzione dei cerchi 1000 (72): senza la tabella VPORT AutoCAD
            // crea una vista con valori nulli e lo zoom rigenera a ogni scatto
            "0", "TABLE", "2", "VPORT", "70", "1",
            "0", "VPORT", "2", "*ACTIVE", "70", "0",
            "10", "0", "20", "0", "11", "1", "21", "1",
            "12", num(vc.x), "22", num(vc.y),
            "13", "0", "23", "0", "14", "10", "24", "10", "15", "10", "25", "10",
            "16", "0", "26", "0", "36", "1", "17", "0", "27", "0", "37", "0",
            "40", num(vSize), "41", "1.6", "42", "50", "43", "0", "44", "0", "50", "0", "51", "0",
            "71", "0", "72", "1000", "73", "1", "74", "3", "75", "0", "76", "0", "77", "0", "78", "0",
            "0", "ENDTAB",
            "0", "TABLE", "2", "LTYPE", "70", "2",
            "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0",
            "0", "LTYPE", "2", "DASHED", "70", "0", "3", "Dashed __ __ __", "72", "65", "73", "2",
            "40", num(dash + gap), "49", num(dash), "49", num(-gap),
            "0", "ENDTAB",
            "0", "TABLE", "2", "LAYER", "70", String(layers.length + 1),
            ...[["0", 7, "CONTINUOUS"], ...layers].flatMap(([name, color, lt]) => ["0", "LAYER", "2", name, "70", "0", "62", String(color), "6", lt]),
            "0", "ENDTAB",
            // font TrueType (Arial) per i caratteri greci delle formule (Ψ, λ, β, σ)
            "0", "TABLE", "2", "STYLE", "70", "1",
            "0", "STYLE", "2", "STANDARD", "70", "0", "40", "0", "41", "1", "50", "0", "71", "0", "42", num(TH), "3", "arial.ttf", "4", "",
            "0", "ENDTAB",
            "0", "TABLE", "2", "VIEW", "70", "0", "0", "ENDTAB",
            "0", "TABLE", "2", "UCS", "70", "0", "0", "ENDTAB",
            "0", "TABLE", "2", "APPID", "70", "1",
            "0", "APPID", "2", "ACAD", "70", "0",
            "0", "ENDTAB",
            "0", "ENDSEC",
            "0", "SECTION", "2", "BLOCKS", "0", "ENDSEC",
            "0", "SECTION", "2", "ENTITIES", ...ent, "0", "ENDSEC",
            "0", "EOF",
        ];
        return out.join("\r\n") + "\r\n";
    };

    return { GAP, ARW, line, circle, poly, arrow, text, hDim, vDim, build };
}

// ---------------------------------------------------------------------------
// sezione progettata (scala 1:1). Origine: spigolo inferiore sinistro della
// sezione (per la T: dell'ala)
// ---------------------------------------------------------------------------
export function buildSectionDxf({ result, B, layT, layC, hanger, dTNom, dCNom, phiStirrup, cLeft, cRight }) {
    const h = Number(result.h);
    const width = Number(B);
    const phiT = Number(result.phi);
    const st = Number(phiStirrup) || 0;
    const cL = Number(cLeft) || 0, cR = Number(cRight) || 0;
    const flip = !!result.tensionTop; // M_Ed < 0: lembo compresso inferiore
    const isT = !!result.isT;
    const bw = isT ? Math.min(Number(result.bw), width) : width;
    const hf = isT ? Number(result.hf) : 0;
    const webL = (width - bw) / 2, webR = webL + bw;

    const rowsT = layT?.rows?.length ? layT.rows : [result.nBars];
    const hangerOnly = !!hanger && !(result.nBarsPrime > 0);
    const phiC = Number(hangerOnly ? hanger.phi : result.phiPrime || phiT);
    const rowsC = hangerOnly ? [hanger.n]
        : result.nBarsPrime > 0 ? (layC?.rows?.length ? layC.rows : [result.nBarsPrime]) : [];
    const sVT = Number(layT?.sV) || 0, sVC = Number(layC?.sV) || 0;
    // profondità misurate dal lembo compresso → ordinata y (y = 0 lembo inferiore)
    const yOf = (depth) => (flip ? depth : h - depth);

    // altezza dei testi e distanze delle quote proporzionate alla sezione
    const TH = Math.min(40, Math.max(6, Math.round(Math.max(width, h) / 45)));
    const { GAP, line, circle, poly, text, hDim, vDim, build } = createDxf(TH);

    // ---- contorno della sezione (rettangolo o T con l'ala sul lembo superiore) ----
    poly(isT
        ? [{ x: webL, y: 0 }, { x: webR, y: 0 }, { x: webR, y: h - hf }, { x: width, y: h - hf },
            { x: width, y: h }, { x: 0, y: h }, { x: 0, y: h - hf }, { x: webL, y: h - hf }]
        : [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: h }, { x: 0, y: h }], "SEZIONE");

    // ---- barre (nell'anima): barre d'angolo a c + φst + φ/2 dai bordi, le altre
    // equidistanti; se non ci stanno, interferro minimo e simmetriche all'asse ----
    const latL = (p) => Math.min(cL + st + p / 2, bw / 2 - p / 2);
    const latR = (p) => Math.min(cR + st + p / 2, bw / 2 - p / 2);
    const barsX = (n, p) => {
        const xL = latL(p), xR = bw - latR(p), pitch = p + Math.max(p, 20);
        const fits = n <= 1 || (n - 1) * pitch <= xR - xL + 1e-6;
        return Array.from({ length: Math.max(0, Math.trunc(n) || 0) }, (_, i) => webL + (n === 1 ? bw / 2
            : fits ? xL + ((xR - xL) * i) / (n - 1) : bw / 2 + (i - (n - 1) / 2) * pitch));
    };
    const depthT = (i) => h - dTNom - i * sVT;
    const depthC = (i) => dCNom + i * sVC;
    rowsT.forEach((n, i) => barsX(n, phiT).forEach((x) => circle(x, yOf(depthT(i)), phiT / 2, "ARMATURA_TESA")));
    rowsC.forEach((n, i) => barsX(n, phiC).forEach((x) =>
        circle(x, yOf(depthC(i)), phiC / 2, hangerOnly ? "REGGISTAFFA" : "ARMATURA_COMPRESSA")));

    // ---- staffa tangente alle barre d'angolo (contorno esterno e interno) ----
    const hasTop = rowsC.length > 0;
    const offT = (phiT + st) / 2, offC = ((hasTop ? phiC : phiT) + st) / 2;
    const axL = Math.min(webL + latL(phiT) - offT, hasTop ? webL + latL(phiC) - offC : Infinity);
    const axR = Math.max(webL + bw - latR(phiT) + offT, hasTop ? webL + bw - latR(phiC) + offC : -Infinity);
    const yEdgeT = yOf(depthT(0)) + (flip ? offT : -offT);
    const yEdgeC = yOf(dCNom) + (flip ? -offC : offC);
    const axB = Math.min(yEdgeT, yEdgeC), axTop = Math.max(yEdgeT, yEdgeC);
    const rr = (l, b, r, t, rad) => {
        const k = Math.max(0, Math.min(rad, (r - l) / 2, (t - b) / 2)), q = 0.4142135624;
        if (k < 1e-6) return [{ x: l, y: b }, { x: r, y: b }, { x: r, y: t }, { x: l, y: t }];
        return [
            { x: l + k, y: b }, { x: r - k, y: b, bulge: q }, { x: r, y: b + k }, { x: r, y: t - k, bulge: q },
            { x: r - k, y: t }, { x: l + k, y: t, bulge: q }, { x: l, y: t - k }, { x: l, y: b + k, bulge: q },
        ];
    };
    if (st > 0 && axR - axL > st && axTop - axB > st) {
        const rad = Math.min(offT, offC);
        poly(rr(axL - st / 2, axB - st / 2, axR + st / 2, axTop + st / 2, rad + st / 2), "STAFFA");
        poly(rr(axL + st / 2, axB + st / 2, axR - st / 2, axTop - st / 2, rad - st / 2), "STAFFA");
    }

    // ---- asse neutro (linea tratteggiata, tipo di linea DASHED) ----
    const X = Number(result.X) || 0;
    const yN = yOf(X);
    if (X > 0 && X < h) {
        const bAt = isT && yN > h - hf ? [0, width] : [webL, webR];
        line(bAt[0] - TH, yN, bAt[1] + TH, yN, "ASSE_NEUTRO");
    }

    // ---- quote ----
    const d = Number(result.d) || h - dTNom;
    const cP = dCNom + (Number(layC?.delta) || 0);
    const symT = flip ? "d''" : "d'", symC = flip ? "d'" : "d''";
    const effT = rowsT.length > 1 ? "eff" : "", effC = rowsC.length > 1 ? "eff" : "";
    const yComp = yOf(0);
    // sinistra: x e d (dal lembo compresso), d' / d'' lato teso
    vDim(`x = ${lbl(X)}`, yComp, yN, -GAP, isT ? (flip ? webL : 0) : 0);
    vDim(`d = ${lbl(d)}`, yComp, yOf(d), -2 * GAP, 0);
    vDim(`${symT}${effT} = ${lbl(h - d)}`, yOf(d), yOf(h), -2 * GAP, isT && !flip ? webL : 0);
    // destra: d'' / d' lato compresso, h (e s per la T)
    vDim(`${symC}${effC} = ${lbl(cP)}`, yComp, yOf(cP), width + GAP, width);
    vDim(`h = ${lbl(h)}`, 0, h, width + 2 * GAP, width);
    if (isT) vDim(`s = ${lbl(hf)}`, h - hf, h, width + 3 * GAP, width);
    // sotto: copriferri laterali c, c' e larghezza (B o b_w); sopra: B dell'ala
    hDim(`c = ${lbl(cL)}`, webL, webL + cL, -GAP, 0, false);
    hDim(`c' = ${lbl(cR)}`, webR - cR, webR, -GAP, 0, false);
    hDim(isT ? `bw = ${lbl(bw)}` : `B = ${lbl(width)}`, webL, webR, -2 * GAP, 0, false);
    if (isT) hDim(`B = ${lbl(width)}`, 0, width, h + GAP, h, true);

    // ---- didascalie ----
    const top = h + (isT ? 2.4 : 1.2) * GAP;
    text(`SEZIONE PROGETTATA${isT ? " A T" : ""} - SCALA 1:1 - UNITA' mm`, 0, top, { h: 1.2 * TH, align: "base" });
    const capY = -2 * GAP - 2 * TH;
    const caps = [`STAFFA φ${lbl(st)}`, `ARMATURA TESA ${rowsT.join("+")} φ${lbl(phiT)}`];
    if (hasTop) caps.push(`${hangerOnly ? "REGGISTAFFA" : "ARMATURA COMPRESSA"} ${rowsC.join("+")} φ${lbl(phiC)}`);
    caps.forEach((s, i) => text(s, width / 2, capY - i * 1.7 * TH));

    return build(
        { x0: -2 * GAP - 2 * TH, y0: capY - caps.length * 1.7 * TH, x1: width + (isT ? 3 : 2) * GAP + TH, y1: top + 2 * TH },
        [
            ["SEZIONE", 7, "CONTINUOUS"], ["STAFFA", 6, "CONTINUOUS"],
            ["ARMATURA_TESA", 1, "CONTINUOUS"], ["ARMATURA_COMPRESSA", 5, "CONTINUOUS"], ["REGGISTAFFA", 8, "CONTINUOUS"],
            ["ASSE_NEUTRO", 4, "DASHED"], ["QUOTE", 8, "CONTINUOUS"], ["TESTI", 7, "CONTINUOUS"],
        ],
    );
}

// ---------------------------------------------------------------------------
// forze interne (sezione di lato). Le altezze sono in scala 1:1 (mm), gli
// sviluppi orizzontali (trave, diagramma σc, frecce) sono schematici e
// proporzionati ad h. Origine: lembo inferiore della sezione di taglio.
// Forze e bracci in forma simbolica (in fase di progetto x non è un dato).
// ---------------------------------------------------------------------------
export function buildForcesDxf({ result }) {
    const h = Number(result.h);
    const X = Number(result.X) || 0;
    const d = Number(result.d) || 0;
    const flip = !!result.tensionTop;
    const isT = !!result.isT;
    const model = result.concreteModel || "rectangular";
    const hasCompr = result.AsPrime > 0;
    const NEd = Number(result.NEd) || 0, hasN = Math.abs(NEd) > 0.5;
    const MEd = Number(result.MEdSigned) || 0;
    const yOf = (depth) => (flip ? depth : h - depth);

    const TH = Math.min(40, Math.max(6, Math.round(h / 22)));
    const { GAP, line, poly, arrow, text, vDim, build } = createDxf(TH);
    const FA = 1.6 * TH; // punta delle frecce delle forze

    // geometria schematica (x orizzontale): taglio in x = 0, trave verso destra
    const Lb = 0.55 * h;            // tratto di trave disegnato
    const SW = 0.25 * h;            // larghezza del diagramma σc
    const xHead = -SW - 0.08 * h;   // punta delle frecce delle forze
    const xTail = xHead - 0.32 * h; // coda delle frecce
    const xLab = xTail - 0.5 * TH;  // etichette delle forze (allineate a destra)

    const yEdge0 = yOf(0), yNA = yOf(X), yG = yOf(result.yG ?? h / 2);
    const yCc = yOf(result.yc ?? (result.kG ?? 0.4) * X);
    const yCs = yOf(result.cC), yTs = yOf(d);

    // ---- trave: taglio, lembi e linea di interruzione a destra ----
    line(0, 0, 0, h, "TRAVE");
    line(0, 0, Lb, 0, "TRAVE");
    line(0, h, Lb, h, "TRAVE");
    const zz = 0.05 * h;
    poly([
        { x: Lb, y: -zz }, { x: Lb, y: h / 2 - zz }, { x: Lb + zz, y: h / 2 - zz / 3 },
        { x: Lb - zz, y: h / 2 + zz / 3 }, { x: Lb, y: h / 2 + zz }, { x: Lb, y: h + zz },
    ], "TRAVE", false);
    // sezione a T: attacco ala-anima (l'ala è sempre sul lembo superiore)
    if (isT) {
        const yFl = h - Number(result.hf);
        line(0, yFl, Lb, yFl, "TRAVE");
        line(-SW, yFl, 0, yFl, "RICHIAMI");
    }

    // ---- armature longitudinali ----
    line(0, yTs, Lb, yTs, "ARMATURA_TESA");
    if (hasCompr) line(0, yCs, Lb, yCs, "ARMATURA_COMPRESSA");

    // ---- asse neutro ----
    if (X > 0 && X < h) line(-SW - 0.5 * TH, yNA, Lb + TH, yNA, "ASSE_NEUTRO");

    // ---- diagramma σc adottato (a sinistra del taglio) ----
    const EPS_CU = 0.0035, EPS_C2 = 0.002, EPS_C3 = 0.00175;
    const sigmaFrac = (depth) => {
        const e = EPS_CU * (X - depth) / X;
        if (model === "bilinear") return e >= EPS_C3 ? 1 : e / EPS_C3;
        return e >= EPS_C2 ? 1 : 1 - Math.pow(1 - e / EPS_C2, 2);
    };
    if (X > 0) {
        if (model === "rectangular") {
            const a = Math.min(0.8 * X, h);
            poly([{ x: 0, y: yEdge0 }, { x: -SW, y: yEdge0 }, { x: -SW, y: yOf(a) }, { x: 0, y: yOf(a) }], "DIAGRAMMA_SIGMA");
        } else {
            const pts = [{ x: 0, y: yEdge0 }];
            const xe = Math.min(X, h);
            for (let i = 0; i <= 24; i++) {
                const depth = (xe * i) / 24;
                pts.push({ x: -sigmaFrac(depth) * SW, y: yOf(depth) });
            }
            pts.push({ x: 0, y: yOf(xe) });
            poly(pts, "DIAGRAMMA_SIGMA");
        }
        text("σc", -SW, yEdge0 + (flip ? -1 : 1) * 0.9 * TH, { align: "l", layer: "DIAGRAMMA_SIGMA" });
    }

    // ---- forze risultanti (simboliche) ----
    const fSteel = Math.abs(result.fs - result.fyd) < 1e-9 ? "yd" : "s";
    const lblCc = !isT ? "Cc = Ψ·B·x·fcd"
        : result.flangeMethod === "exact" ? "Cc = ∫σc·b dy"
            : result.inFlange ? (flip ? "Cc = Ψ·bw·x·fcd" : "Cc = Ψ·B·x·fcd")
                : "Cc = Ψ·bw·x·fcd + (B - bw)·s·fcd";
    const lblCs = result.mode === "fixBH" || result.givenTop ? "C's = A's·fyd" : "C's = β·As·fyd";
    const lblTs = `Ts = As·f${fSteel}`;
    // etichette di C_c e C'_s distanziate se troppo vicine
    let yLCc = yCc, yLCs = yCs;
    if (hasCompr && Math.abs(yCc - yCs) < 1.3 * TH) {
        const mid = (yCc + yCs) / 2, sep = 0.7 * TH;
        if (yCc >= yCs) { yLCc = mid + sep; yLCs = mid - sep; } else { yLCc = mid - sep; yLCs = mid + sep; }
    }
    const qX = Lb + 1.4 * GAP, qCc = qX + GAP, qTs = qCc + GAP, qCs = qTs + GAP;
    // compressioni → verso la sezione (destra); trazione → via dalla sezione (sinistra)
    line(xTail, yCc, xHead - FA, yCc, "FORZE_COMPRESSIONE");
    arrow(xHead, yCc, 1, 0, "FORZE_COMPRESSIONE", FA);
    text(lblCc, xLab, yLCc, { align: "r", layer: "FORZE_COMPRESSIONE" });
    text(isT ? "G (yc)" : "G (λ·x)", -0.3 * TH, yCc + 0.7 * TH, { h: 0.7 * TH, align: "r", layer: "QUOTE" });
    line(xTail, yCc, qCc, yCc, "RICHIAMI");
    if (hasCompr) {
        line(xTail, yCs, xHead - FA, yCs, "FORZE_COMPRESSIONE");
        arrow(xHead, yCs, 1, 0, "FORZE_COMPRESSIONE", FA);
        text(lblCs, xLab, yLCs, { align: "r", layer: "FORZE_COMPRESSIONE" });
        line(xTail, yCs, qCs, yCs, "RICHIAMI");
    }
    line(xHead, yTs, xTail + FA, yTs, "FORZE_TRAZIONE");
    arrow(xTail, yTs, -1, 0, "FORZE_TRAZIONE", FA);
    text(lblTs, xLab - FA * 0.2, yTs, { align: "r", layer: "FORZE_TRAZIONE" });
    line(xTail, yTs, qTs, yTs, "RICHIAMI");

    // ---- azioni applicate: N_Ed al baricentro, M_Ed come arco ----
    const xCross = xTail + 0.08 * h;
    if (hasN) {
        line(xTail, yG, 0, yG, "RICHIAMI");
        if (NEd > 0) { line(xTail, yG, xHead - FA, yG, "AZIONI"); arrow(xHead, yG, 1, 0, "AZIONI", FA); }
        else { line(xHead, yG, xTail + FA, yG, "AZIONI"); arrow(xTail, yG, -1, 0, "AZIONI", FA); }
        text(`NEd = ${lbl(Math.abs(NEd) / 1000)} kN`, xCross - 0.4 * TH, yG - 1.1 * TH, { align: "r", layer: "AZIONI" });
    }
    if (Math.abs(MEd) > 0) {
        const bw = 0.11 * h, mr = 0.12 * h, xa = xCross + bw;
        // M > 0 (fibre inferiori tese): arco dal basso verso l'alto; M < 0 il contrario
        const s = flip ? 1 : -1;
        const P0 = { x: xa, y: yG + s * mr }, P1 = { x: xCross, y: yG + s * mr * 0.5 },
            P2 = { x: xCross, y: yG - s * mr * 0.5 }, P3 = { x: xa, y: yG - s * mr };
        const bez = (t) => {
            const u = 1 - t;
            return {
                x: u * u * u * P0.x + 3 * u * u * t * P1.x + 3 * u * t * t * P2.x + t * t * t * P3.x,
                y: u * u * u * P0.y + 3 * u * u * t * P1.y + 3 * u * t * t * P2.y + t * t * t * P3.y,
            };
        };
        // arco fino alla base della freccia, poi punta piena tangente all'arco
        const pts = Array.from({ length: 21 }, (_, i) => bez((i / 20) * 0.88));
        poly(pts, "AZIONI", false);
        const end = pts[pts.length - 1];
        arrow(P3.x, P3.y, P3.x - end.x, P3.y - end.y, "AZIONI", Math.hypot(P3.x - end.x, P3.y - end.y));
        text(`MEd = ${lbl(Math.abs(MEd) / 1e6)} kNm`, xCross + bw / 2, yG - s * (mr + 1.1 * TH), { layer: "AZIONI" });
    }

    // ---- asse baricentrico e quote (x e bracci rispetto al baricentro) ----
    line(0, yG, qCs + TH, yG, "RICHIAMI");
    text(isT ? "baricentro G" : "baricentro (h/2)", 0.3 * TH, yG + 0.6 * TH, { h: 0.7 * TH, align: "l", layer: "QUOTE" });
    const symT = flip ? "d''" : "d'", symC = flip ? "d'" : "d''";
    const effT = (result.layT?.rows?.length || 0) > 1 ? "eff" : "", effC = (result.layC?.rows?.length || 0) > 1 ? "eff" : "";
    if (X > 0) vDim("x", yEdge0, yNA, qX, Lb);
    vDim(`${isT ? "yG - yc" : "h/2 - λx"}  (br. Cc)`, yG, yCc, qCc, Lb);
    vDim(`${isT ? "d - yG" : `h/2 - ${symT}${effT}`}  (br. Ts)`, yG, yTs, qTs, Lb);
    if (hasCompr) vDim(`${isT ? `yG - ${symC}${effC}` : `h/2 - ${symC}${effC}`}  (br. C's)`, yG, yCs, qCs, Lb);
    vDim(`h = ${lbl(h)}`, 0, h, xTail - 0.4 * h, xTail - 0.4 * h + 0.5 * TH);

    // ---- didascalie ----
    const xLeft = xTail - 0.4 * h - 2 * TH;
    text("FORZE INTERNE - SEZIONE DI LATO - altezze in scala 1:1 (mm), sviluppi orizzontali schematici",
        xLeft, h + 2.2 * TH, { h: 1.1 * TH, align: "base" });
    const notes = [
        "Cc cade nel baricentro G del diagramma σc.",
        `I bracci sono misurati dall'asse baricentrico ${isT ? "G della sezione a T" : "(h/2)"}.`,
        ...(flip ? ["MEd < 0: lato teso in alto."] : []),
    ];
    notes.forEach((s, i) => text(s, xLeft, -2 * TH - i * 1.5 * TH, { h: 0.8 * TH, align: "base" }));

    return build(
        { x0: xLeft - TH, y0: -2 * TH - notes.length * 1.5 * TH, x1: qCs + 2 * TH, y1: h + 4 * TH },
        [
            ["TRAVE", 7, "CONTINUOUS"], ["ARMATURA_TESA", 1, "CONTINUOUS"], ["ARMATURA_COMPRESSA", 5, "CONTINUOUS"],
            ["ASSE_NEUTRO", 4, "DASHED"], ["DIAGRAMMA_SIGMA", 3, "CONTINUOUS"],
            ["FORZE_COMPRESSIONE", 1, "CONTINUOUS"], ["FORZE_TRAZIONE", 3, "CONTINUOUS"], ["AZIONI", 5, "CONTINUOUS"],
            ["RICHIAMI", 8, "DASHED"], ["QUOTE", 8, "CONTINUOUS"], ["TESTI", 7, "CONTINUOUS"],
        ],
    );
}

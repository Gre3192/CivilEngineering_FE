function dxfNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(4).replace(/\.?0+$/, "") : "0";
}

function labelNumber(value) {
    return Number(value).toLocaleString("it-IT", { useGrouping: false, maximumFractionDigits: 2 });
}

export function buildSectionDxf({ result, B, layT, layC, hanger, dTNom, dCNom, phiStirrup, cLeft, cRight }) {
    const h = Number(result.h);
    const width = Number(B);
    const phiT = Number(result.phi);
    const stirrup = Number(phiStirrup);
    const flip = !!result.tensionTop;
    const tensionRows = layT?.rows?.length ? layT.rows : [result.nBars];
    const hangerOnly = !!hanger && !(result.nBarsPrime > 0);
    const phiC = Number(hangerOnly ? hanger.phi : result.phiPrime || phiT);
    const compressionRows = hangerOnly
        ? [hanger.n]
        : result.nBarsPrime > 0
            ? layC?.rows?.length ? layC.rows : [result.nBarsPrime]
            : [];
    const spacingT = Number(layT?.sV) || 0;
    const spacingC = Number(layC?.sV) || 0;
    const yFromCompressionFace = (depth) => flip ? depth : h - depth;

    const entities = [];
    const dimensionBlocks = [];
    let dimensionBlockCount = 0;
    const pushEntityTo = (target, type, layer, data = []) => {
        target.push("0", type, "8", layer, ...data.flatMap(([code, value]) => [String(code), String(value)]));
    };
    const pushEntity = (type, layer, data = []) => pushEntityTo(entities, type, layer, data);
    const addLineTo = (target, x1, y1, x2, y2, layer = "DIMENSIONS") => pushEntityTo(target, "LINE", layer, [
        [10, dxfNumber(x1)], [20, dxfNumber(y1)], [30, "0"],
        [11, dxfNumber(x2)], [21, dxfNumber(y2)], [31, "0"],
    ]);
    const addLine = (x1, y1, x2, y2, layer = "DIMENSIONS") => addLineTo(entities, x1, y1, x2, y2, layer);
    const addCircle = (x, y, radius, layer) => pushEntity("CIRCLE", layer, [
        [10, dxfNumber(x)], [20, dxfNumber(y)], [30, "0"], [40, dxfNumber(radius)],
    ]);
    const addPolyline = (points, layer, closed = false) => {
        entities.push("0", "POLYLINE", "8", layer, "66", "1", "70", closed ? "1" : "0", "10", "0", "20", "0", "30", "0");
        points.forEach(({ x, y, bulge = 0 }) => {
            entities.push("0", "VERTEX", "8", layer, "10", dxfNumber(x), "20", dxfNumber(y), "30", "0", "70", "0");
            if (bulge) entities.push("42", dxfNumber(bulge));
        });
        entities.push("0", "SEQEND", "8", layer);
    };
    const roundedRectangle = (left, bottom, right, top, radius) => {
        const r = Math.max(0, Math.min(radius, (right - left) / 2, (top - bottom) / 2));
        if (r < 1e-8) return [
            { x: left, y: bottom }, { x: right, y: bottom },
            { x: right, y: top }, { x: left, y: top },
        ];
        const q = 0.4142135624;
        return [
            { x: left + r, y: bottom }, { x: right - r, y: bottom, bulge: q },
            { x: right, y: bottom + r }, { x: right, y: top - r, bulge: q },
            { x: right - r, y: top }, { x: left + r, y: top, bulge: q },
            { x: left, y: top - r }, { x: left, y: bottom + r, bulge: q },
        ];
    };
    const addTextTo = (target, text, x, y, height = 2.5, rotation = 0, centered = true) => {
        const data = [
            [10, dxfNumber(x)], [20, dxfNumber(y)], [30, "0"], [40, dxfNumber(height)],
            [1, text], [50, dxfNumber(rotation)], [7, "STANDARD"],
        ];
        if (centered) data.push([72, "1"], [73, "2"], [11, dxfNumber(x)], [21, dxfNumber(y)], [31, "0"]);
        pushEntityTo(target, "TEXT", "TEXT", data);
    };
    const addText = (text, x, y, height = 2.5, rotation = 0, centered = true) => addTextTo(entities, text, x, y, height, rotation, centered);

    const addArrowH = (target, x, y, direction) => {
        const tip = 3;
        addLineTo(target, x, y, x + direction * tip, y + 1.2);
        addLineTo(target, x, y, x + direction * tip, y - 1.2);
    };
    const addArrowV = (target, x, y, direction) => {
        const tip = 3;
        addLineTo(target, x, y, x + 1.2, y + direction * tip);
        addLineTo(target, x, y, x - 1.2, y + direction * tip);
    };
    const addDimension = ({ prefix, value, x1, y1, x2, y2, lineX, lineY, textX, textY, rotation }) => {
        const blockName = `*D${++dimensionBlockCount}`;
        const blockEntities = [];
        const label = `${prefix} ${dim(value)}`;
        if (rotation === 0) {
            addLineTo(blockEntities, x1, y1, x1, lineY + 2);
            addLineTo(blockEntities, x2, y2, x2, lineY + 2);
            addLineTo(blockEntities, x1, lineY, x2, lineY);
            addArrowH(blockEntities, x1, lineY, 1);
            addArrowH(blockEntities, x2, lineY, -1);
        } else {
            const low = Math.min(y1, y2), high = Math.max(y1, y2);
            const extensionEndX = lineX + (lineX < x1 ? 2 : -2);
            addLineTo(blockEntities, x1, y1, extensionEndX, y1);
            addLineTo(blockEntities, x2, y2, extensionEndX, y2);
            addLineTo(blockEntities, lineX, low, lineX, high);
            addArrowV(blockEntities, lineX, low, 1);
            addArrowV(blockEntities, lineX, high, -1);
        }
        addTextTo(blockEntities, label, textX, textY, 2.5, rotation);
        dimensionBlocks.push({ name: blockName, entities: blockEntities });
        pushEntity("DIMENSION", "DIMENSIONS", [
            [2, blockName], [10, dxfNumber(lineX)], [20, dxfNumber(lineY)], [30, "0"],
            [11, dxfNumber(textX)], [21, dxfNumber(textY)], [31, "0"],
            [70, "0"], [1, `${prefix} <> mm`], [3, "STANDARD"], [42, dxfNumber(value)],
            [13, dxfNumber(x1)], [23, dxfNumber(y1)], [33, "0"],
            [14, dxfNumber(x2)], [24, dxfNumber(y2)], [34, "0"], [50, dxfNumber(rotation)],
        ]);
    };
    const horizontalDimension = (prefix, value, x1, x2, y1, y2, yDim, textY) => {
        addDimension({ prefix, value, x1, y1, x2, y2, lineX: (x1 + x2) / 2, lineY: yDim, textX: (x1 + x2) / 2, textY, rotation: 0 });
    };
    const verticalDimension = (prefix, value, xDim, x1, y1, x2, y2, textX) => {
        addDimension({ prefix, value, x1, y1, x2, y2, lineX: xDim, lineY: (y1 + y2) / 2, textX, textY: (Math.min(y1, y2) + Math.max(y1, y2)) / 2, rotation: 90 });
    };
    const barPositions = (count, diameter) => {
        const n = Math.max(0, Math.trunc(Number(count) || 0));
        if (!n) return [];
        const left = Math.min(cLeft + stirrup + diameter / 2, width / 2 - diameter / 2);
        const right = Math.min(cRight + stirrup + diameter / 2, width / 2 - diameter / 2);
        const xLeft = left;
        const xRight = width - right;
        const pitch = diameter + Math.max(diameter, 20);
        const fits = n <= 1 || (n - 1) * pitch <= xRight - xLeft + 1e-6;
        return Array.from({ length: n }, (_, i) => n === 1
            ? width / 2
            : fits
                ? xLeft + ((xRight - xLeft) * i) / (n - 1)
                : width / 2 + (i - (n - 1) / 2) * pitch);
    };

    // Sezione in scala 1:1, con il bordo inferiore come origine e le coordinate in mm.
    addPolyline([{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: h }, { x: 0, y: h }], "SECTION", true);

    tensionRows.forEach((count, row) => {
        const depth = h - dTNom - row * spacingT;
        const y = yFromCompressionFace(depth);
        barPositions(count, phiT).forEach((x) => addCircle(x, y, phiT / 2, "TENSION_BARS"));
    });
    compressionRows.forEach((count, row) => {
        const y = yFromCompressionFace(dCNom + row * spacingC);
        barPositions(count, phiC).forEach((x) => addCircle(x, y, phiC / 2, hangerOnly ? "HANGER_BARS" : "COMPRESSION_BARS"));
    });

    const yT = yFromCompressionFace(h - dTNom);
    const yC = yFromCompressionFace(dCNom);
    const offT = (phiT + stirrup) / 2;
    const offC = (phiC + stirrup) / 2;
    const yStirrupT = yT + (flip ? offT : -offT);
    const yStirrupC = yC + (flip ? -offC : offC);
    const xLeft = cLeft + stirrup / 2;
    const xRight = width - cRight - stirrup / 2;
    const yBottom = Math.min(yStirrupT, yStirrupC);
    const yTop = Math.max(yStirrupT, yStirrupC);
    const cornerRadius = Math.min(offT, offC, (xRight - xLeft) / 2, (yTop - yBottom) / 2);
    if (xRight > xLeft && yTop > yBottom) {
        const halfThickness = stirrup / 2;
        addPolyline(roundedRectangle(
            xLeft - halfThickness, yBottom - halfThickness,
            xRight + halfThickness, yTop + halfThickness,
            cornerRadius + halfThickness,
        ), "STIRRUP", true);
        addPolyline(roundedRectangle(
            xLeft + halfThickness, yBottom + halfThickness,
            xRight - halfThickness, yTop - halfThickness,
            cornerRadius - halfThickness,
        ), "STIRRUP", true);
    }

    const neutralY = yFromCompressionFace(Number(result.X) || 0);
    if (neutralY > 0 && neutralY < h) {
        const dash = 6, gap = 4;
        for (let x = 0; x < width; x += dash + gap) addLine(x, neutralY, Math.min(width, x + dash), neutralY, "NEUTRAL_AXIS");
    }

    const dim = (value) => `${labelNumber(value)} mm`;
    horizontalDimension("c =", cLeft, 0, cLeft, 0, 0, -10, -8);
    horizontalDimension("c' =", cRight, width - cRight, width, 0, 0, -10, -14);
    horizontalDimension("B =", width, 0, width, 0, 0, -30, -27);
    const tensionDepth = Number(result.d) || h - dTNom;
    const compressionDepth = dCNom + (Number(layC?.delta) || 0);
    const tensionY = yFromCompressionFace(tensionDepth);
    const compressionY = yFromCompressionFace(compressionDepth);
    const tensionCover = h - tensionDepth;
    const compressionCover = compressionDepth;
    const symT = flip ? "d''" : "d'";
    const symC = flip ? "d'" : "d''";
    verticalDimension("d =", tensionDepth, -22, 0, flip ? 0 : h, 0, tensionY, -26);
    verticalDimension("x =", result.X, -9, 0, flip ? 0 : h, 0, neutralY, -13);
    verticalDimension("h =", h, width + 28, width, 0, width, h, width + 32);
    verticalDimension(`${symC} =`, compressionCover, width + 9, width, flip ? 0 : h, width, compressionY, width + 12);
    verticalDimension(`${symT} =`, tensionCover, width + 9, width, tensionY, width, flip ? h : 0, width + 12);

    addText("SEZIONE PROGETTATA - SCALA 1:1 - UNITA' mm", 0, h + 14, 3.5, 0, false);
    addText(`STAFFA %%c${labelNumber(stirrup)}`, width / 2, -39, 2.5);
    addText(`ARMATURA TESA ${tensionRows.join("+")} %%c${labelNumber(phiT)}`, width / 2, -44, 2.5);
    if (compressionRows.length) {
        addText(`${hangerOnly ? "REGGISTAFFA" : "ARMATURA COMPRESSA"} ${compressionRows.join("+")} %%c${labelNumber(phiC)}`, width / 2, -49, 2.5);
    }

    // AC1009 (R12) non prevede la tabella BLOCK: le definizioni dei blocchi
    // sono dichiarate direttamente nella sezione BLOCKS.
    const header = [
        "0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC",
        "0", "SECTION", "2", "TABLES",
        "0", "TABLE", "2", "LTYPE", "70", "1",
        "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0.0",
        "0", "ENDTAB",
        "0", "TABLE", "2", "LAYER", "70", "9",
    ];
    const layers = [
        ["0", 7], ["SECTION", 7], ["STIRRUP", 6], ["TENSION_BARS", 1], ["COMPRESSION_BARS", 5],
        ["HANGER_BARS", 8], ["DIMENSIONS", 8], ["TEXT", 7], ["NEUTRAL_AXIS", 4],
    ];
    const layerTable = layers.flatMap(([name, color]) => [
        "0", "LAYER", "2", name, "70", "0", "62", String(color), "6", "CONTINUOUS",
    ]);
    const styleTable = [
        "0", "TABLE", "2", "STYLE", "70", "1",
        "0", "STYLE", "2", "STANDARD", "70", "0", "40", "0", "41", "1", "50", "0", "71", "0", "42", "2.5", "3", "txt",
        "0", "ENDTAB",
        "0", "TABLE", "2", "DIMSTYLE", "70", "1",
        "0", "DIMSTYLE", "2", "STANDARD", "70", "0", "40", "1", "41", "3", "42", "1", "43", "3.75", "44", "1.25", "140", "2.5", "147", "0.625",
        "0", "ENDTAB", "0", "ENDSEC",
        "0", "SECTION", "2", "BLOCKS",
        ...dimensionBlocks.flatMap(({ name, entities: blockEntities }) => [
            "0", "BLOCK", "8", "0", "2", name, "70", "1", "10", "0", "20", "0", "30", "0", "3", name,
            ...blockEntities, "0", "ENDBLK", "8", "0",
        ]),
        "0", "ENDSEC",
        "0", "SECTION", "2", "ENTITIES", ...entities, "0", "ENDSEC", "0", "EOF",
    ];
    return [...header, ...layerTable, "0", "ENDTAB", ...styleTable].join("\r\n");
}

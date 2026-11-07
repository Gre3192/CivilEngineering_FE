// src/components/concrete/useCenteredViewBox.js
// viewBox "0 0 W H" traslato in orizzontale in modo che il disegno (etichette
// comprese) risulti centrato nell'SVG, senza cambiarne la scala.

import { useLayoutEffect, useRef, useState } from "react";

const ARROW = 4; // punta di freccia degli assi: i marker non entrano nel getBBox

export default function useCenteredViewBox(W, H, deps) {
    const svgRef = useRef(null);
    const [x0, setX0] = useState(0);
    useLayoutEffect(() => {
        const b = svgRef.current?.getBBox();
        if (!b || !(b.width > 0)) return;
        const width = b.width + ARROW;
        setX0(b.x - (W - width) / 2);
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps
    return [svgRef, `${x0.toFixed(1)} 0 ${W} ${H}`];
}

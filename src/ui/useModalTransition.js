// src/ui/useModalTransition.js
//
// Animazione di apertura e chiusura dei modal dell'hub (prima era interna a
// SectionDesignTool): il modal entra con una dissolvenza dello sfondo e un
// leggero spostamento/ingrandimento del pannello; in chiusura fa il percorso
// inverso e solo alla fine della transizione chiama onClose (o la funzione
// passata a close). Con «riduci movimento» del sistema la chiusura è immediata.
//
// Uso:
//   const { isVisible, close, finishClose } = useModalTransition(onClose);
//   <div className={`fixed inset-0 … ${modalBackdropCls(isVisible)}`} onTransitionEnd={finishClose}>
//       <div className={`… ${modalPanelCls(isVisible)}`}>…</div>
//   </div>
// close()            → chiude e poi chiama onClose
// close(() => fn())  → chiude e poi chiama fn (es. conferma, salvataggio)

import { useCallback, useEffect, useRef, useState } from "react";

const DURATION = 300;           // ms, uguale a duration-300 delle classi

export function useModalTransition(onClose) {
    const [isVisible, setIsVisible] = useState(false);
    const closeTimeoutRef = useRef(null);
    const onCloseRef = useRef(onClose);
    const afterRef = useRef(null);
    const isClosingRef = useRef(false);

    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
    useEffect(() => {
        // due frame: il primo disegna lo stato iniziale, il secondo avvia la transizione
        // (riserva a tempo: i frame non arrivano se la scheda è in background)
        let secondFrame;
        const show = () => setIsVisible(true);
        const firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(show);
        });
        const fallback = window.setTimeout(show, 80);
        return () => {
            cancelAnimationFrame(firstFrame);
            if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
            window.clearTimeout(fallback);
            if (closeTimeoutRef.current !== null) window.clearTimeout(closeTimeoutRef.current);
        };
    }, []);

    const done = useCallback(() => {
        if (closeTimeoutRef.current !== null) window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
        const fn = afterRef.current ?? onCloseRef.current;
        afterRef.current = null;
        fn?.();
    }, []);

    // after: funzione da eseguire a chiusura avvenuta al posto di onClose (gli
    // eventi passati dai gestori di clic vengono ignorati)
    const close = useCallback((after) => {
        if (isClosingRef.current) return;
        isClosingRef.current = true;
        afterRef.current = typeof after === "function" ? after : null;
        setIsVisible(false);
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        // riserva: se transitionend non arriva (scheda in background, ecc.)
        closeTimeoutRef.current = window.setTimeout(done, reducedMotion ? 0 : DURATION + 100);
    }, [done]);

    const finishClose = useCallback((event) => {
        if (isVisible || !isClosingRef.current || closeTimeoutRef.current === null) return;
        if (event && (event.target !== event.currentTarget || event.propertyName !== "opacity")) return;
        done();
    }, [isVisible, done]);

    return { isVisible, close, finishClose };
}

// sfondo: dissolvenza
export const modalBackdropCls = (v) => `transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${v ? "opacity-100" : "opacity-0"}`;
// pannello centrale: leggero spostamento verso l'alto e ingrandimento
export const modalPanelCls = (v) => `transition-transform duration-300 ease-out motion-reduce:transition-none ${v ? "translate-y-0 scale-100" : "translate-y-2 scale-[0.98]"}`;
// pannello laterale: entra da destra
export const drawerPanelCls = (v) => `transition-transform duration-300 ease-out motion-reduce:transition-none ${v ? "translate-x-0" : "translate-x-full"}`;

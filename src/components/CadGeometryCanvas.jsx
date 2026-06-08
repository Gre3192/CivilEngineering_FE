// src/components/CadGeometryCanvas.jsx

import { useMemo, useRef, useState } from "react";
import {
    Stage,
    Layer,
    Rect,
    Circle,
    Line,
    Text,
    Group,
} from "react-konva";
import {
    MousePointer2,
    Square,
    Circle as CircleIcon,
    Pentagon,
    Trash2,
    Download,
    Plus,
    Minus,
    Magnet,
    CornerDownRight,
    Grid3X3,
    ZoomIn,
    ZoomOut,
} from "lucide-react";

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

const TOOLS = {
    SELECT: "select",
    RECTANGLE: "rectangle",
    CIRCLE: "circle",
    POLYGON: "polygon",
};

function createId(prefix = "shape") {
    return `${prefix}-${crypto.randomUUID()}`;
}

function snapToGrid(value, gridSize) {
    return Math.round(value / gridSize) * gridSize;
}

function applySnap(point, snapEnabled, gridSize) {
    if (!snapEnabled) return point;

    return {
        x: snapToGrid(point.x, gridSize),
        y: snapToGrid(point.y, gridSize),
    };
}

function applyOrtho(startPoint, currentPoint, orthoEnabled) {
    if (!orthoEnabled || !startPoint) return currentPoint;

    const dx = currentPoint.x - startPoint.x;
    const dy = currentPoint.y - startPoint.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
        return {
            x: currentPoint.x,
            y: startPoint.y,
        };
    }

    return {
        x: startPoint.x,
        y: currentPoint.y,
    };
}

function applyFixedLength(startPoint, currentPoint, length) {
    const numericLength = Number(length);

    if (!startPoint || !numericLength || numericLength <= 0) {
        return currentPoint;
    }

    const dx = currentPoint.x - startPoint.x;
    const dy = currentPoint.y - startPoint.y;
    const currentLength = Math.sqrt(dx * dx + dy * dy);

    if (currentLength === 0) {
        return currentPoint;
    }

    const ux = dx / currentLength;
    const uy = dy / currentLength;

    return {
        x: startPoint.x + ux * numericLength,
        y: startPoint.y + uy * numericLength,
    };
}

function getDistance(p1, p2) {
    if (!p1 || !p2) return 0;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    return Math.sqrt(dx * dx + dy * dy);
}

function getPointerPosition(stage, snapEnabled, gridSize, zoom) {
    const pointer = stage.getPointerPosition();

    if (!pointer) {
        return { x: 0, y: 0 };
    }

    const stagePosition = stage.position();

    const point = {
        x: (pointer.x - stagePosition.x) / zoom,
        y: (pointer.y - stagePosition.y) / zoom,
    };

    return applySnap(point, snapEnabled, gridSize);
}

function getLastPolygonPoint(points) {
    if (points.length < 2) return null;

    return {
        x: points[points.length - 2],
        y: points[points.length - 1],
    };
}

function normalizeDrawingPoint({
    rawPoint,
    startPoint,
    snapEnabled,
    orthoEnabled,
    gridSize,
    fixedLength,
}) {
    let point = rawPoint;

    point = applySnap(point, snapEnabled, gridSize);
    point = applyOrtho(startPoint, point, orthoEnabled);

    if (fixedLength && Number(fixedLength) > 0 && startPoint) {
        point = applyFixedLength(startPoint, point, fixedLength);
    } else {
        point = applySnap(point, snapEnabled, gridSize);
    }

    return point;
}

export default function CadGeometryCanvas() {
    const stageRef = useRef(null);

    const [tool, setTool] = useState(TOOLS.SELECT);
    const [shapes, setShapes] = useState([]);
    const [selectedShapeId, setSelectedShapeId] = useState(null);

    const [snapEnabled, setSnapEnabled] = useState(true);
    const [orthoEnabled, setOrthoEnabled] = useState(false);

    const [gridSize, setGridSize] = useState(25);
    const [zoom, setZoom] = useState(1);

    const [segmentLength, setSegmentLength] = useState("");

    const [isDrawing, setIsDrawing] = useState(false);
    const [draftShape, setDraftShape] = useState(null);
    const [polygonPoints, setPolygonPoints] = useState([]);
    const [cursorPoint, setCursorPoint] = useState(null);

    const selectedShape = useMemo(() => {
        return shapes.find((shape) => shape.id === selectedShapeId) || null;
    }, [shapes, selectedShapeId]);

    const lastPolygonPoint = useMemo(() => {
        return getLastPolygonPoint(polygonPoints);
    }, [polygonPoints]);

    const previewPolygonPoint = useMemo(() => {
        if (tool !== TOOLS.POLYGON || !lastPolygonPoint || !cursorPoint) {
            return null;
        }

        return normalizeDrawingPoint({
            rawPoint: cursorPoint,
            startPoint: lastPolygonPoint,
            snapEnabled,
            orthoEnabled,
            gridSize,
            fixedLength: segmentLength,
        });
    }, [
        tool,
        lastPolygonPoint,
        cursorPoint,
        snapEnabled,
        orthoEnabled,
        gridSize,
        segmentLength,
    ]);

    const currentSegmentLength = useMemo(() => {
        if (!lastPolygonPoint || !previewPolygonPoint) return 0;

        return getDistance(lastPolygonPoint, previewPolygonPoint);
    }, [lastPolygonPoint, previewPolygonPoint]);

    const gridLines = useMemo(() => {
        const lines = [];

        for (let x = 0; x <= CANVAS_WIDTH; x += gridSize) {
            lines.push(
                <Line
                    key={`v-${x}`}
                    points={[x, 0, x, CANVAS_HEIGHT]}
                    stroke="#e2e8f0"
                    strokeWidth={1 / zoom}
                />
            );
        }

        for (let y = 0; y <= CANVAS_HEIGHT; y += gridSize) {
            lines.push(
                <Line
                    key={`h-${y}`}
                    points={[0, y, CANVAS_WIDTH, y]}
                    stroke="#e2e8f0"
                    strokeWidth={1 / zoom}
                />
            );
        }

        return lines;
    }, [gridSize, zoom]);

    function handleStageMouseDown(e) {
        const stage = stageRef.current;
        const clickedOnEmpty = e.target === stage;

        if (tool === TOOLS.SELECT) {
            if (clickedOnEmpty) {
                setSelectedShapeId(null);
            }

            return;
        }

        const point = getPointerPosition(stage, snapEnabled, gridSize, zoom);

        if (tool === TOOLS.RECTANGLE) {
            setIsDrawing(true);

            setDraftShape({
                id: "draft-rectangle",
                type: "rectangle",
                x: point.x,
                y: point.y,
                startX: point.x,
                startY: point.y,
                width: 0,
                height: 0,
            });
        }

        if (tool === TOOLS.CIRCLE) {
            setIsDrawing(true);

            setDraftShape({
                id: "draft-circle",
                type: "circle",
                x: point.x,
                y: point.y,
                radius: 0,
                startX: point.x,
                startY: point.y,
            });
        }

        if (tool === TOOLS.POLYGON) {
            const lastPoint = getLastPolygonPoint(polygonPoints);

            const finalPoint = normalizeDrawingPoint({
                rawPoint: point,
                startPoint: lastPoint,
                snapEnabled,
                orthoEnabled,
                gridSize,
                fixedLength: segmentLength,
            });

            setPolygonPoints((prev) => [...prev, finalPoint.x, finalPoint.y]);
        }
    }

    function handleStageMouseMove() {
        const stage = stageRef.current;
        const point = getPointerPosition(stage, snapEnabled, gridSize, zoom);

        setCursorPoint(point);

        if (!isDrawing || !draftShape) return;

        const startPoint = {
            x: draftShape.startX,
            y: draftShape.startY,
        };

        let finalPoint = point;

        finalPoint = applyOrtho(startPoint, finalPoint, orthoEnabled);

        if (draftShape.type === "rectangle") {
            setDraftShape((prev) => ({
                ...prev,
                width: finalPoint.x - prev.startX,
                height: finalPoint.y - prev.startY,
            }));
        }

        if (draftShape.type === "circle") {
            const dx = finalPoint.x - draftShape.startX;
            const dy = finalPoint.y - draftShape.startY;
            const radius = Math.sqrt(dx * dx + dy * dy);

            setDraftShape((prev) => ({
                ...prev,
                radius,
            }));
        }
    }

    function handleStageMouseUp() {
        if (!isDrawing || !draftShape) return;

        if (draftShape.type === "rectangle") {
            const normalizedRect = normalizeRectangle(draftShape);

            if (normalizedRect.width > 0 && normalizedRect.height > 0) {
                const newShape = {
                    ...normalizedRect,
                    id: createId("rectangle"),
                    operation: "add",
                    fill: "#dbeafe",
                    stroke: "#2563eb",
                };

                setShapes((prev) => [...prev, newShape]);
                setSelectedShapeId(newShape.id);
            }
        }

        if (draftShape.type === "circle") {
            if (draftShape.radius > 0) {
                const newShape = {
                    id: createId("circle"),
                    type: "circle",
                    x: draftShape.x,
                    y: draftShape.y,
                    radius: draftShape.radius,
                    operation: "add",
                    fill: "#dcfce7",
                    stroke: "#16a34a",
                };

                setShapes((prev) => [...prev, newShape]);
                setSelectedShapeId(newShape.id);
            }
        }

        setIsDrawing(false);
        setDraftShape(null);
        setTool(TOOLS.SELECT);
    }

    function normalizeRectangle(rect) {
        const x = rect.width < 0 ? rect.startX + rect.width : rect.startX;
        const y = rect.height < 0 ? rect.startY + rect.height : rect.startY;

        return {
            ...rect,
            x,
            y,
            width: Math.abs(rect.width),
            height: Math.abs(rect.height),
        };
    }

    function finishPolygon() {
        if (polygonPoints.length < 6) return;

        const newShape = {
            id: createId("polygon"),
            type: "polygon",
            points: polygonPoints,
            operation: "add",
            fill: "#fef3c7",
            stroke: "#d97706",
            offsetX: 0,
            offsetY: 0,
        };

        setShapes((prev) => [...prev, newShape]);
        setSelectedShapeId(newShape.id);
        setPolygonPoints([]);
        setCursorPoint(null);
        setTool(TOOLS.SELECT);
    }

    function cancelPolygon() {
        setPolygonPoints([]);
        setCursorPoint(null);
        setTool(TOOLS.SELECT);
    }

    function deleteSelectedShape() {
        if (!selectedShapeId) return;

        setShapes((prev) => prev.filter((shape) => shape.id !== selectedShapeId));
        setSelectedShapeId(null);
    }

    function clearCanvas() {
        setShapes([]);
        setSelectedShapeId(null);
        setDraftShape(null);
        setPolygonPoints([]);
        setCursorPoint(null);
        setIsDrawing(false);
    }

    function updateShapePosition(shapeId, position) {
        const snappedPosition = applySnap(position, snapEnabled, gridSize);

        setShapes((prev) =>
            prev.map((shape) => {
                if (shape.id !== shapeId) return shape;

                if (shape.type === "polygon") {
                    return {
                        ...shape,
                        offsetX: snappedPosition.x,
                        offsetY: snappedPosition.y,
                    };
                }

                return {
                    ...shape,
                    x: snappedPosition.x,
                    y: snappedPosition.y,
                };
            })
        );
    }

    function updateSelectedShapeField(field, value) {
        if (!selectedShapeId) return;

        const numericValue = Number(value);

        setShapes((prev) =>
            prev.map((shape) => {
                if (shape.id !== selectedShapeId) return shape;

                return {
                    ...shape,
                    [field]: Number.isNaN(numericValue) ? 0 : numericValue,
                };
            })
        );
    }

    function updateSelectedShapeOperation(operation) {
        if (!selectedShapeId) return;

        setShapes((prev) =>
            prev.map((shape) => {
                if (shape.id !== selectedShapeId) return shape;

                return {
                    ...shape,
                    operation,
                    fill: operation === "subtract" ? "#fee2e2" : getDefaultFill(shape.type),
                    stroke: operation === "subtract" ? "#dc2626" : getDefaultStroke(shape.type),
                };
            })
        );
    }

    function exportGeometry() {
        const data = JSON.stringify(shapes, null, 4);
        console.log(data);
        alert("Geometria esportata in console");
    }

    function increaseZoom() {
        setZoom((prev) => Math.min(Number((prev + 0.1).toFixed(2)), 2.5));
    }

    function decreaseZoom() {
        setZoom((prev) => Math.max(Number((prev - 0.1).toFixed(2)), 0.4));
    }

    return (
        <div className="flex h-full w-full flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <ToolButton
                        active={tool === TOOLS.SELECT}
                        icon={MousePointer2}
                        label="Seleziona"
                        onClick={() => setTool(TOOLS.SELECT)}
                    />

                    <ToolButton
                        active={tool === TOOLS.RECTANGLE}
                        icon={Square}
                        label="Rettangolo"
                        onClick={() => {
                            setTool(TOOLS.RECTANGLE);
                            setPolygonPoints([]);
                        }}
                    />

                    <ToolButton
                        active={tool === TOOLS.CIRCLE}
                        icon={CircleIcon}
                        label="Cerchio"
                        onClick={() => {
                            setTool(TOOLS.CIRCLE);
                            setPolygonPoints([]);
                        }}
                    />

                    <ToolButton
                        active={tool === TOOLS.POLYGON}
                        icon={Pentagon}
                        label="Poligono"
                        onClick={() => setTool(TOOLS.POLYGON)}
                    />

                    <Divider />

                    <ToolButton
                        active={snapEnabled}
                        icon={Magnet}
                        label={`Snap ${snapEnabled ? "ON" : "OFF"}`}
                        onClick={() => setSnapEnabled((prev) => !prev)}
                    />

                    <ToolButton
                        active={orthoEnabled}
                        icon={CornerDownRight}
                        label={`Ortho ${orthoEnabled ? "ON" : "OFF"}`}
                        onClick={() => setOrthoEnabled((prev) => !prev)}
                    />

                    <Divider />

                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <Grid3X3 size={15} className="text-slate-500" />
                        <span className="text-xs font-semibold text-slate-500">
                            Griglia
                        </span>
                        <input
                            type="number"
                            min={5}
                            max={200}
                            step={5}
                            value={gridSize}
                            onChange={(e) => {
                                const value = Number(e.target.value);

                                if (!value || value < 5) return;

                                setGridSize(value);
                            }}
                            className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
                        />
                        <span className="text-xs text-slate-400">px</span>
                    </div>

                    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5">
                        <button
                            type="button"
                            onClick={decreaseZoom}
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
                        >
                            <ZoomOut size={15} />
                        </button>

                        <span className="w-12 text-center text-xs font-semibold text-slate-600">
                            {Math.round(zoom * 100)}%
                        </span>

                        <button
                            type="button"
                            onClick={increaseZoom}
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
                        >
                            <ZoomIn size={15} />
                        </button>
                    </div>

                    {tool === TOOLS.POLYGON && (
                        <>
                            <Divider />

                            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                <span className="text-xs font-semibold text-slate-500">
                                    Lunghezza
                                </span>

                                <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={segmentLength}
                                    placeholder="libera"
                                    onChange={(e) => setSegmentLength(e.target.value)}
                                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
                                />
                            </div>

                            <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                                Segmento: {currentSegmentLength.toFixed(2)}
                            </div>

                            <button
                                type="button"
                                onClick={finishPolygon}
                                disabled={polygonPoints.length < 6}
                                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Chiudi poligono
                            </button>

                            <button
                                type="button"
                                onClick={cancelPolygon}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                                Annulla
                            </button>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={deleteSelectedShape}
                        disabled={!selectedShapeId}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Trash2 size={15} />
                        Elimina
                    </button>

                    <button
                        type="button"
                        onClick={clearCanvas}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                        Pulisci
                    </button>

                    <button
                        type="button"
                        onClick={exportGeometry}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                    >
                        <Download size={15} />
                        Esporta JSON
                    </button>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                    <Stage
                        ref={stageRef}
                        width={CANVAS_WIDTH * zoom}
                        height={CANVAS_HEIGHT * zoom}
                        scaleX={zoom}
                        scaleY={zoom}
                        onMouseDown={handleStageMouseDown}
                        onMouseMove={handleStageMouseMove}
                        onMouseUp={handleStageMouseUp}
                        className="rounded-xl bg-white"
                    >
                        <Layer listening={false}>
                            {gridLines}

                            <Line
                                points={[0, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT / 2]}
                                stroke="#94a3b8"
                                strokeWidth={1.5 / zoom}
                            />

                            <Line
                                points={[CANVAS_WIDTH / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT]}
                                stroke="#94a3b8"
                                strokeWidth={1.5 / zoom}
                            />
                        </Layer>

                        <Layer>
                            {shapes.map((shape) => (
                                <GeometryShape
                                    key={shape.id}
                                    shape={shape}
                                    isSelected={shape.id === selectedShapeId}
                                    snapEnabled={snapEnabled}
                                    orthoEnabled={orthoEnabled}
                                    gridSize={gridSize}
                                    zoom={zoom}
                                    onSelect={() => setSelectedShapeId(shape.id)}
                                    onDragEnd={(position) =>
                                        updateShapePosition(shape.id, position)
                                    }
                                />
                            ))}

                            {draftShape && <DraftShape shape={draftShape} zoom={zoom} />}

                            {polygonPoints.length > 0 && (
                                <>
                                    <Line
                                        points={polygonPoints}
                                        stroke="#d97706"
                                        strokeWidth={2 / zoom}
                                    />

                                    {previewPolygonPoint && lastPolygonPoint && (
                                        <Line
                                            points={[
                                                lastPolygonPoint.x,
                                                lastPolygonPoint.y,
                                                previewPolygonPoint.x,
                                                previewPolygonPoint.y,
                                            ]}
                                            stroke="#ea580c"
                                            strokeWidth={2 / zoom}
                                            dash={[8 / zoom, 5 / zoom]}
                                        />
                                    )}

                                    {polygonPoints.length >= 6 && previewPolygonPoint && (
                                        <Line
                                            points={[
                                                previewPolygonPoint.x,
                                                previewPolygonPoint.y,
                                                polygonPoints[0],
                                                polygonPoints[1],
                                            ]}
                                            stroke="#f97316"
                                            strokeWidth={1.5 / zoom}
                                            dash={[6 / zoom, 6 / zoom]}
                                        />
                                    )}

                                    {toPointPairs(polygonPoints).map((point, index) => (
                                        <Circle
                                            key={`polygon-point-${index}`}
                                            x={point.x}
                                            y={point.y}
                                            radius={4 / zoom}
                                            fill="#d97706"
                                        />
                                    ))}

                                    {previewPolygonPoint && (
                                        <Circle
                                            x={previewPolygonPoint.x}
                                            y={previewPolygonPoint.y}
                                            radius={4 / zoom}
                                            fill="#ea580c"
                                        />
                                    )}
                                </>
                            )}
                        </Layer>

                        <Layer listening={false}>
                            <Text
                                x={12}
                                y={12}
                                text={`Tool: ${getToolLabel(tool)} | Snap: ${
                                    snapEnabled ? "ON" : "OFF"
                                } | Ortho: ${orthoEnabled ? "ON" : "OFF"} | Griglia: ${gridSize}px | Zoom: ${Math.round(
                                    zoom * 100
                                )}%`}
                                fontSize={13 / zoom}
                                fill="#475569"
                            />
                        </Layer>
                    </Stage>
                </div>

                <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-800">
                        Proprietà figura
                    </h2>

                    {!selectedShape && (
                        <p className="mt-3 text-sm text-slate-500">
                            Seleziona una figura per modificarne le proprietà.
                        </p>
                    )}

                    {selectedShape && (
                        <div className="mt-4 space-y-4">
                            <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase text-slate-400">
                                    Tipo
                                </p>
                                <p className="mt-1 text-sm font-semibold text-slate-700">
                                    {getShapeLabel(selectedShape.type)}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {selectedShape.type !== "polygon" && (
                                    <>
                                        <Field
                                            label="X"
                                            value={selectedShape.x}
                                            onChange={(value) =>
                                                updateSelectedShapeField("x", value)
                                            }
                                        />

                                        <Field
                                            label="Y"
                                            value={selectedShape.y}
                                            onChange={(value) =>
                                                updateSelectedShapeField("y", value)
                                            }
                                        />
                                    </>
                                )}

                                {selectedShape.type === "rectangle" && (
                                    <>
                                        <Field
                                            label="Base"
                                            value={selectedShape.width}
                                            onChange={(value) =>
                                                updateSelectedShapeField("width", value)
                                            }
                                        />

                                        <Field
                                            label="Altezza"
                                            value={selectedShape.height}
                                            onChange={(value) =>
                                                updateSelectedShapeField("height", value)
                                            }
                                        />
                                    </>
                                )}

                                {selectedShape.type === "circle" && (
                                    <Field
                                        label="Raggio"
                                        value={Math.round(selectedShape.radius)}
                                        onChange={(value) =>
                                            updateSelectedShapeField("radius", value)
                                        }
                                    />
                                )}

                                {selectedShape.type === "polygon" && (
                                    <>
                                        <Field
                                            label="Offset X"
                                            value={selectedShape.offsetX || 0}
                                            onChange={(value) =>
                                                updateSelectedShapeField("offsetX", value)
                                            }
                                        />

                                        <Field
                                            label="Offset Y"
                                            value={selectedShape.offsetY || 0}
                                            onChange={(value) =>
                                                updateSelectedShapeField("offsetY", value)
                                            }
                                        />
                                    </>
                                )}
                            </div>

                            <div>
                                <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                                    Operazione
                                </p>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => updateSelectedShapeOperation("add")}
                                        className={`
                                            inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition
                                            ${
                                                selectedShape.operation === "add"
                                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                            }
                                        `}
                                    >
                                        <Plus size={14} />
                                        Piena
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            updateSelectedShapeOperation("subtract")
                                        }
                                        className={`
                                            inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition
                                            ${
                                                selectedShape.operation === "subtract"
                                                    ? "border-red-300 bg-red-50 text-red-700"
                                                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                            }
                                        `}
                                    >
                                        <Minus size={14} />
                                        Foro
                                    </button>
                                </div>
                            </div>

                            <div>
                                <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                                    JSON figura
                                </p>

                                <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 text-[11px] text-slate-100">
                                    {JSON.stringify(selectedShape, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

function GeometryShape({
    shape,
    isSelected,
    snapEnabled,
    orthoEnabled,
    gridSize,
    zoom,
    onSelect,
    onDragEnd,
}) {
    const dragStartRef = useRef(null);

    function handleDragStart(e) {
        dragStartRef.current = {
            x: e.target.x(),
            y: e.target.y(),
        };
    }

    function handleDragMove(e) {
        if (!orthoEnabled || !dragStartRef.current) return;

        const node = e.target;

        const currentPoint = {
            x: node.x(),
            y: node.y(),
        };

        const orthoPoint = applyOrtho(dragStartRef.current, currentPoint, true);
        const finalPoint = applySnap(orthoPoint, snapEnabled, gridSize);

        node.position(finalPoint);
    }

    function handleDragEnd(e) {
        const currentPoint = {
            x: e.target.x(),
            y: e.target.y(),
        };

        const finalPoint = applySnap(currentPoint, snapEnabled, gridSize);

        onDragEnd(finalPoint);
        dragStartRef.current = null;
    }

    const commonProps = {
        draggable: true,
        onClick: onSelect,
        onTap: onSelect,
        onDragStart: handleDragStart,
        onDragMove: handleDragMove,
        onDragEnd: handleDragEnd,
        stroke: isSelected ? "#0f172a" : shape.stroke,
        strokeWidth: isSelected ? 3 / zoom : 2 / zoom,
        fill: shape.fill,
        opacity: shape.operation === "subtract" ? 0.65 : 1,
    };

    if (shape.type === "rectangle") {
        return (
            <Rect
                {...commonProps}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
            />
        );
    }

    if (shape.type === "circle") {
        return (
            <Circle
                {...commonProps}
                x={shape.x}
                y={shape.y}
                radius={shape.radius}
            />
        );
    }

    if (shape.type === "polygon") {
        return (
            <Group
                x={shape.offsetX || 0}
                y={shape.offsetY || 0}
                draggable
                onClick={onSelect}
                onTap={onSelect}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
            >
                <Line
                    points={shape.points}
                    closed
                    fill={shape.fill}
                    stroke={isSelected ? "#0f172a" : shape.stroke}
                    strokeWidth={isSelected ? 3 / zoom : 2 / zoom}
                    opacity={shape.operation === "subtract" ? 0.65 : 1}
                />
            </Group>
        );
    }

    return null;
}

function DraftShape({ shape, zoom }) {
    if (shape.type === "rectangle") {
        const normalizedRect = {
            x: shape.width < 0 ? shape.startX + shape.width : shape.startX,
            y: shape.height < 0 ? shape.startY + shape.height : shape.startY,
            width: Math.abs(shape.width),
            height: Math.abs(shape.height),
        };

        return (
            <Rect
                x={normalizedRect.x}
                y={normalizedRect.y}
                width={normalizedRect.width}
                height={normalizedRect.height}
                fill="#dbeafe"
                stroke="#2563eb"
                strokeWidth={2 / zoom}
                dash={[8 / zoom, 4 / zoom]}
            />
        );
    }

    if (shape.type === "circle") {
        return (
            <Circle
                x={shape.x}
                y={shape.y}
                radius={shape.radius}
                fill="#dcfce7"
                stroke="#16a34a"
                strokeWidth={2 / zoom}
                dash={[8 / zoom, 4 / zoom]}
            />
        );
    }

    return null;
}

function ToolButton({ active, icon: Icon, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`
                inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition
                ${
                    active
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }
            `}
        >
            <Icon size={15} />
            {label}
        </button>
    );
}

function Field({ label, value, onChange }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
                {label}
            </span>

            <input
                type="number"
                value={value ?? 0}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
        </label>
    );
}

function Divider() {
    return <div className="mx-1 h-7 w-px bg-slate-200" />;
}

function toPointPairs(points) {
    const pairs = [];

    for (let i = 0; i < points.length; i += 2) {
        pairs.push({
            x: points[i],
            y: points[i + 1],
        });
    }

    return pairs;
}

function getToolLabel(tool) {
    const labels = {
        [TOOLS.SELECT]: "Selezione",
        [TOOLS.RECTANGLE]: "Rettangolo",
        [TOOLS.CIRCLE]: "Cerchio",
        [TOOLS.POLYGON]: "Poligono",
    };

    return labels[tool] || tool;
}

function getShapeLabel(type) {
    const labels = {
        rectangle: "Rettangolo",
        circle: "Cerchio",
        polygon: "Poligono",
    };

    return labels[type] || type;
}

function getDefaultFill(type) {
    const fills = {
        rectangle: "#dbeafe",
        circle: "#dcfce7",
        polygon: "#fef3c7",
    };

    return fills[type] || "#e2e8f0";
}

function getDefaultStroke(type) {
    const strokes = {
        rectangle: "#2563eb",
        circle: "#16a34a",
        polygon: "#d97706",
    };

    return strokes[type] || "#334155";
}
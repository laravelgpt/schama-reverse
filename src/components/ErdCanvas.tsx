import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  CanonicalSchema,
  TableDefinition,
  RelationshipDefinition,
  RelationshipType
} from '../types/schema';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Search,
  Download,
  Layers,
  Sparkles,
  AlertTriangle,
  Key,
  Link2,
  Move,
  Grid,
  Play,
  Pause,
  Compass,
  MapPin,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  Minimize2,
  Globe,
  Printer,
  Image as ImageIcon
} from 'lucide-react';
import {
  exportCanvasAsPng,
  generateHtmlReport,
  generatePdfReport,
  downloadReportBlob
} from '../services/generators/reportGenerators';

interface ErdCanvasProps {
  schema: CanonicalSchema;
  selectedTable: string | null;
  onSelectTable: (tableName: string | null) => void;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ErdCanvas: React.FC<ErdCanvasProps> = ({
  schema,
  selectedTable,
  onSelectTable
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Viewport transformation
  const [scale, setScale] = useState(0.85);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Table Dragging State
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0
  });

  // User-modified table positions (persists per session / schema load)
  const [customPositions, setCustomPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Toolbar & Display Options
  const [searchQuery, setSearchQuery] = useState('');
  const [showIndexes, setShowIndexes] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [selectedRelationship, setSelectedRelationship] = useState<RelationshipDefinition | null>(null);
  const [hoveredRelationship, setHoveredRelationship] = useState<RelationshipDefinition | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<{ table: string; column: string } | null>(null);
  const [showMinimap, setShowMinimap] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);

  // Calculate default layout positions (Grid or Hierarchical)
  const defaultPositions = useMemo(() => {
    const posMap: Record<string, { x: number; y: number }> = {};
    const count = schema.tables.length;
    if (count === 0) return posMap;

    // Build dependency graph for hierarchical sorting
    const inDegree: Record<string, number> = {};
    const outDegree: Record<string, number> = {};
    schema.tables.forEach(t => {
      inDegree[t.name.toLowerCase()] = 0;
      outDegree[t.name.toLowerCase()] = 0;
    });

    schema.relationships.forEach(r => {
      const src = r.sourceTable.toLowerCase();
      const tgt = r.targetTable.toLowerCase();
      if (outDegree[src] !== undefined) outDegree[src]++;
      if (inDegree[tgt] !== undefined) inDegree[tgt]++;
    });

    // Layer 0: Root tables (referenced by others, no or few outgoing FKs)
    // Layer 1: Intermediate tables (both incoming & outgoing)
    // Layer 2: Leaf or Junction tables (many incoming FKs, e.g. order_items, pivot tables)
    const layers: string[][] = [[], [], []];

    schema.tables.forEach(t => {
      const tName = t.name.toLowerCase();
      const ins = inDegree[tName] || 0;
      const outs = outDegree[tName] || 0;

      if (outs === 0 && ins > 0) {
        layers[0].push(tName); // Root / dimension table
      } else if (ins > 0 && outs > 0) {
        layers[1].push(tName); // Core transactional entity
      } else if (outs > 1 && ins === 0) {
        layers[2].push(tName); // Pivot / junction table
      } else {
        layers[1].push(tName); // General entity
      }
    });

    // If layers are heavily unbalanced, fall back to balanced column grid
    const maxInAnyLayer = Math.max(...layers.map(l => l.length));
    const useHierarchical = count >= 4 && maxInAnyLayer <= count * 0.75;

    const colWidth = 320;
    const colGap = 70;
    const rowGap = 40;

    if (useHierarchical) {
      layers.forEach((layerTables, colIdx) => {
        let currentY = 40;
        layerTables.forEach(tName => {
          const table = schema.tables.find(t => t.name.toLowerCase() === tName);
          if (!table) return;
          const height = 48 + table.columns.length * 28 + (showIndexes ? Math.min(table.indexes.length * 20, 80) : 0) + 24;
          posMap[tName] = {
            x: 40 + colIdx * (colWidth + colGap),
            y: currentY
          };
          currentY += height + rowGap;
        });
      });
    } else {
      // Balanced bento column distribution
      const cols = count <= 3 ? count : count <= 6 ? 3 : 4;
      const columnHeights = new Array(cols).fill(40);

      schema.tables.forEach(table => {
        let targetCol = 0;
        let minH = columnHeights[0];
        for (let c = 1; c < cols; c++) {
          if (columnHeights[c] < minH) {
            minH = columnHeights[c];
            targetCol = c;
          }
        }

        const height = 48 + table.columns.length * 28 + (showIndexes ? Math.min(table.indexes.length * 20, 80) : 0) + 24;
        posMap[table.name.toLowerCase()] = {
          x: 40 + targetCol * (colWidth + colGap),
          y: columnHeights[targetCol]
        };
        columnHeights[targetCol] += height + rowGap;
      });
    }

    return posMap;
  }, [schema.tables, schema.relationships, showIndexes]);

  // Combined node positions with dimensions
  const nodePositions = useMemo(() => {
    const positions = new Map<string, NodePosition>();
    const colWidth = 320;

    schema.tables.forEach(table => {
      const tKey = table.name.toLowerCase();
      const custom = customPositions[tKey];
      const def = defaultPositions[tKey] || { x: 40, y: 40 };

      const x = custom ? custom.x : def.x;
      const y = custom ? custom.y : def.y;

      const headerH = 48;
      const colRowH = 28;
      const indexRowH = showIndexes ? Math.min(table.indexes.length * 20, 80) : 0;
      const height = headerH + table.columns.length * colRowH + indexRowH + 24;

      positions.set(tKey, {
        x,
        y,
        width: colWidth,
        height
      });
    });

    return positions;
  }, [schema.tables, defaultPositions, customPositions, showIndexes]);

  // Connected tables for the currently selected table
  const connectedTables = useMemo(() => {
    if (!selectedTable) return new Set<string>();
    const selLower = selectedTable.toLowerCase();
    const set = new Set<string>([selLower]);

    schema.relationships.forEach(r => {
      if (r.sourceTable.toLowerCase() === selLower) {
        set.add(r.targetTable.toLowerCase());
      }
      if (r.targetTable.toLowerCase() === selLower) {
        set.add(r.sourceTable.toLowerCase());
      }
    });
    return set;
  }, [selectedTable, schema.relationships]);

  // Filtered tables based on search
  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return schema.tables;
    const q = searchQuery.toLowerCase();
    return schema.tables.filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        t.columns.some(c => c.name.toLowerCase().includes(q))
    );
  }, [schema.tables, searchQuery]);

  // Total bounding box of all tables on canvas
  const schemaBounds = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodePositions.forEach(pos => {
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + pos.width > maxX) maxX = pos.x + pos.width;
      if (pos.y + pos.height > maxY) maxY = pos.y + pos.height;
    });

    if (minX === Infinity) {
      return { minX: 0, minY: 0, maxX: 1200, maxY: 800, width: 1200, height: 800 };
    }

    const padding = 100;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
      width: Math.max(1200, maxX - minX + padding * 2),
      height: Math.max(800, maxY - minY + padding * 2)
    };
  }, [nodePositions]);

  // Handle Table Drag Start (Mouse)
  const handleTableMouseDown = (tableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tKey = tableName.toLowerCase();
    const currentPos = nodePositions.get(tKey);
    if (!currentPos) return;

    setDraggingTable(tKey);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: currentPos.x,
      startY: currentPos.y
    };
  };

  // Handle Table Drag Start (Touch for mobile / tablet)
  const handleTableTouchStart = (tableName: string, e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const tKey = tableName.toLowerCase();
    const currentPos = nodePositions.get(tKey);
    if (!currentPos) return;

    setDraggingTable(tKey);
    dragStartRef.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      startX: currentPos.x,
      startY: currentPos.y
    };
  };

  // Window-level mousemove, mouseup, touchmove & touchend for butter-smooth dragging & panning
  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (draggingTable) {
        const dx = (clientX - dragStartRef.current.mouseX) / scale;
        const dy = (clientY - dragStartRef.current.mouseY) / scale;

        let newX = dragStartRef.current.startX + dx;
        let newY = dragStartRef.current.startY + dy;

        if (snapToGrid) {
          newX = Math.round(newX / 20) * 20;
          newY = Math.round(newY / 20) * 20;
        }

        setCustomPositions(prev => ({
          ...prev,
          [draggingTable]: { x: newX, y: newY }
        }));
      } else if (isPanning) {
        setPan({
          x: clientX - panStart.x,
          y: clientY - panStart.y
        });
      }
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleWindowEnd = () => {
      if (draggingTable) {
        setDraggingTable(null);
      }
      if (isPanning) {
        setIsPanning(false);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowEnd);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: true });
    window.addEventListener('touchend', handleWindowEnd);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowEnd);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowEnd);
    };
  }, [draggingTable, isPanning, scale, panStart, snapToGrid]);

  // Handle Canvas Background Pan (Mouse)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.table-card')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  // Handle Canvas Background Pan (Touch)
  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.table-card')) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsPanning(true);
      setPanStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  };

  // Zoom controls
  const handleZoom = (delta: number) => {
    setScale(prev => Math.min(2.5, Math.max(0.25, Number((prev + delta).toFixed(2)))));
  };

  const handleResetZoom = () => {
    setScale(0.85);
    setPan({ x: 40, y: 40 });
  };

  const handleFitToView = () => {
    if (!containerRef.current || schema.tables.length === 0) return;
    const containerW = containerRef.current.clientWidth || 1000;
    const containerH = containerRef.current.clientHeight || 700;

    const scaleX = (containerW - 80) / schemaBounds.width;
    const scaleY = (containerH - 80) / schemaBounds.height;
    const newScale = Math.min(1.2, Math.max(0.35, Math.min(scaleX, scaleY)));

    setScale(newScale);
    setPan({
      x: (containerW - schemaBounds.width * newScale) / 2 - schemaBounds.minX * newScale,
      y: (containerH - schemaBounds.height * newScale) / 2 - schemaBounds.minY * newScale
    });
  };

  // Focus directly onto a specific table
  const focusOnTable = (tableName: string) => {
    const pos = nodePositions.get(tableName.toLowerCase());
    if (!pos || !containerRef.current) return;
    const containerW = containerRef.current.clientWidth || 1000;
    const containerH = containerRef.current.clientHeight || 700;

    const targetScale = Math.max(0.8, scale);
    setScale(targetScale);
    setPan({
      x: containerW / 2 - (pos.x + pos.width / 2) * targetScale,
      y: containerH / 2 - (pos.y + pos.height / 2) * targetScale
    });
    onSelectTable(tableName);
  };

  // Auto-arrange layout resetting
  const handleAutoArrange = () => {
    setCustomPositions({});
    setTimeout(() => handleFitToView(), 50);
  };

  // Export SVG
  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schemaforge-${schema.database.engine}-erd.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export high-res PNG image
  const handleExportPng = async () => {
    if (!svgRef.current) return;
    setIsExportingPng(true);
    try {
      await exportCanvasAsPng(svgRef.current, `schemaforge-${schema.database.engine}-erd.png`);
    } catch (err) {
      console.error('Failed to export PNG:', err);
    } finally {
      setIsExportingPng(false);
    }
  };

  // Export standalone offline HTML report
  const handleExportHtml = () => {
    const html = generateHtmlReport(schema);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadReportBlob(blob, `schemaforge-${schema.database.engine}-data-dictionary.html`);
  };

  // Export printable / PDF dossier
  const handleExportPdf = () => {
    generatePdfReport(schema);
  };

  // High-precision connector calculation: connect to specific FK and PK column vertical ports
  const edges = useMemo(() => {
    return schema.relationships
      .map(rel => {
        const srcPos = nodePositions.get(rel.sourceTable.toLowerCase());
        const tgtPos = nodePositions.get(rel.targetTable.toLowerCase());
        if (!srcPos || !tgtPos) return null;

        const srcTable = schema.tables.find(t => t.name.toLowerCase() === rel.sourceTable.toLowerCase());
        const tgtTable = schema.tables.find(t => t.name.toLowerCase() === rel.targetTable.toLowerCase());

        // Find vertical offset of source foreign key column
        let srcColIdx = 0;
        if (srcTable && rel.sourceColumns.length > 0) {
          const idx = srcTable.columns.findIndex(c =>
            rel.sourceColumns.some(sc => sc.toLowerCase() === c.name.toLowerCase())
          );
          if (idx !== -1) srcColIdx = idx;
        }

        // Find vertical offset of target primary key column
        let tgtColIdx = 0;
        if (tgtTable && rel.targetColumns.length > 0) {
          const idx = tgtTable.columns.findIndex(c =>
            rel.targetColumns.some(tc => tc.toLowerCase() === c.name.toLowerCase())
          );
          if (idx !== -1) tgtColIdx = idx;
        }

        // Header is 48px, each column row is 28px, center is 14px
        const headerH = 48;
        const colRowH = 28;

        const srcPortY = srcPos.y + headerH + srcColIdx * colRowH + colRowH / 2;
        const tgtPortY = tgtPos.y + headerH + tgtColIdx * colRowH + colRowH / 2;

        // Determine if target is to the right or left of source
        const srcCenterX = srcPos.x + srcPos.width / 2;
        const tgtCenterX = tgtPos.x + tgtPos.width / 2;
        const srcOnRight = srcCenterX < tgtCenterX;

        const startX = srcOnRight ? srcPos.x + srcPos.width : srcPos.x;
        const startY = srcPortY;

        const endX = srcOnRight ? tgtPos.x : tgtPos.x + tgtPos.width;
        const endY = tgtPortY;

        // Smooth cubic Bezier curve with horizontal tangent handles
        const dx = Math.max(50, Math.abs(endX - startX) * 0.48);
        const control1X = srcOnRight ? startX + dx : startX - dx;
        const control2X = srcOnRight ? endX - dx : endX + dx;

        const pathData = `M ${startX} ${startY} C ${control1X} ${startY}, ${control2X} ${endY}, ${endX} ${endY}`;

        // Cardinality categorization
        const isM2M = rel.type === 'many-to-many';
        const isO2O = rel.type === 'one-to-one';
        const isO2M = rel.type === 'one-to-many' || rel.type === 'many-to-one';

        const isHighlighted = selectedTable
          ? rel.sourceTable.toLowerCase() === selectedTable.toLowerCase() ||
            rel.targetTable.toLowerCase() === selectedTable.toLowerCase()
          : true;

        const isHovered =
          hoveredRelationship?.id === rel.id ||
          (hoveredColumn &&
            rel.sourceTable.toLowerCase() === hoveredColumn.table.toLowerCase() &&
            rel.sourceColumns.some(c => c.toLowerCase() === hoveredColumn.column.toLowerCase()));

        return {
          rel,
          pathData,
          startX,
          startY,
          endX,
          endY,
          midX: (startX + endX) / 2,
          midY: (startY + endY) / 2,
          srcOnRight,
          isM2M,
          isO2O,
          isO2M,
          isHighlighted,
          isHovered
        };
      })
      .filter(Boolean);
  }, [schema.relationships, schema.tables, nodePositions, selectedTable, hoveredRelationship, hoveredColumn]);

  return (
    <div
      id="erd-canvas-container"
      ref={containerRef}
      className="relative w-full h-[560px] sm:h-[680px] lg:h-[750px] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden select-none cursor-grab active:cursor-grabbing shadow-inner"
      onMouseDown={handleCanvasMouseDown}
      onTouchStart={handleCanvasTouchStart}
    >
      {/* Dynamic Background Blueprint Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, #38bdf8 1.2px, transparent 0),
            linear-gradient(to right, rgba(51, 65, 85, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(51, 65, 85, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px, 120px 120px, 120px 120px'
        }}
      />

      {/* Embedded CSS Animations for High-Performance SVG Rendering */}
      <style>{`
        @keyframes erdFlowDash {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes erdFlowDashReverse {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: 24; }
        }
        @keyframes erdPulseGlow {
          0%, 100% { opacity: 0.6; filter: drop-shadow(0 0 2px currentColor); }
          50% { opacity: 1; filter: drop-shadow(0 0 6px currentColor); }
        }
        .erd-animated-flow {
          animation: erdFlowDash 1.2s linear infinite;
        }
        .erd-animated-flow-m2m {
          animation: erdFlowDash 0.9s linear infinite;
        }
        .erd-pulse-glow {
          animation: erdPulseGlow 2s ease-in-out infinite;
        }
      `}</style>

      {/* Top ERD Toolbar */}
      <div
        id="erd-toolbar"
        className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-auto"
      >
        {/* Search & Filter */}
        <div className="flex items-center gap-2 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 shadow-xl">
          <Search className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            type="text"
            placeholder="Search tables or columns..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-500 focus:outline-none w-44 md:w-56"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-slate-500 hover:text-slate-300 text-xs px-1"
            >
              ×
            </button>
          )}
        </div>

        {/* Action Controls & Toggles */}
        <div className="flex items-center flex-wrap gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 shadow-xl">
          {/* Snap to Grid */}
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            title="Snap to 20px Grid when Moving Tables"
            className={`px-2.5 py-1 text-xs rounded-lg font-medium flex items-center gap-1.5 transition ${
              snapToGrid ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid Snap</span>
          </button>

          {/* Animation Toggle */}
          <button
            onClick={() => setAnimationsEnabled(!animationsEnabled)}
            title={animationsEnabled ? 'Pause Relation Animations' : 'Enable Relation Animations'}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium flex items-center gap-1.5 transition ${
              animationsEnabled ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {animationsEnabled ? <Pause className="w-3.5 h-3.5 text-cyan-400" /> : <Play className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden md:inline">Flow Animation</span>
          </button>

          {/* Indexes Toggle */}
          <button
            onClick={() => setShowIndexes(!showIndexes)}
            title="Toggle Indexes Summary Row"
            className={`px-2.5 py-1 text-xs rounded-lg font-medium flex items-center gap-1.5 transition ${
              showIndexes ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Indexes</span>
          </button>

          {/* Auto Arrange Layout */}
          <button
            onClick={handleAutoArrange}
            title="Reset and Auto-Arrange Tables Hierarchically"
            className="px-2.5 py-1 text-xs text-slate-300 hover:text-cyan-300 hover:bg-slate-800 rounded-lg font-medium flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Auto Layout</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1" />

          {/* Zoom In/Out/Fit */}
          <button
            onClick={() => handleZoom(0.15)}
            title="Zoom In (+15%)"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleZoom(-0.15)}
            title="Zoom Out (-15%)"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            onClick={handleFitToView}
            title="Fit All Tables to Screen"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1" />

          {/* Export Diagram & Reports Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              title="Export Schema & Diagrams"
              className="px-2.5 py-1 text-xs bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30 rounded-lg font-medium flex items-center gap-1.5 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className={`w-3 h-3 text-cyan-400 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 text-xs font-sans animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setIsExportMenuOpen(false)}
              >
                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 tracking-wider uppercase border-b border-slate-800">
                  Export Options
                </div>
                <button
                  onClick={handleExportSvg}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 text-left transition"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <div>
                    <div className="font-semibold">Vector SVG</div>
                    <div className="text-[10px] text-slate-400">Scalable diagram with crisp lines</div>
                  </div>
                </button>
                <button
                  onClick={handleExportPng}
                  disabled={isExportingPng}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 text-left transition disabled:opacity-50"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <div>
                    <div className="font-semibold">{isExportingPng ? 'Rendering PNG...' : 'High-Res PNG'}</div>
                    <div className="text-[10px] text-slate-400">Raster image for docs & slides</div>
                  </div>
                </button>
                <button
                  onClick={handleExportHtml}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 text-left transition"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-semibold">Interactive HTML</div>
                    <div className="text-[10px] text-slate-400">Standalone offline searchable page</div>
                  </div>
                </button>
                <button
                  onClick={handleExportPdf}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 text-left transition"
                >
                  <Printer className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <div>
                    <div className="font-semibold">Print / Save PDF</div>
                    <div className="text-[10px] text-slate-400">Clean print-styled documentation</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Interactive Diagram Canvas */}
      <div
        className="absolute inset-0 origin-top-left transition-transform duration-75"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`
        }}
      >
        {/* SVG Bezier Edges & Crow's Foot Endpoints */}
        <svg
          ref={svgRef}
          className="absolute inset-0 overflow-visible pointer-events-none w-[6000px] h-[6000px]"
        >
          <defs>
            {/* 1. Crow's Foot "Many" Marker (Authoritative Cyan) */}
            <marker
              id="crowsfoot-many-auth"
              markerWidth="14"
              markerHeight="14"
              refX="12"
              refY="7"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path
                d="M 1 2 L 12 7 L 1 12 M 1 7 L 12 7"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </marker>

            {/* 2. Crow's Foot "One and Only One" Marker (Authoritative Cyan) */}
            <marker
              id="crowsfoot-one-auth"
              markerWidth="12"
              markerHeight="14"
              refX="10"
              refY="7"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path
                d="M 4 2 L 4 12 M 9 2 L 9 12"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </marker>

            {/* 3. Many-to-Many "Many" Marker (Violet) */}
            <marker
              id="crowsfoot-many-m2m"
              markerWidth="14"
              markerHeight="14"
              refX="12"
              refY="7"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path
                d="M 1 2 L 12 7 L 1 12 M 1 7 L 12 7"
                fill="none"
                stroke="#c084fc"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </marker>

            {/* 4. One-to-One Marker (Emerald Green) */}
            <marker
              id="crowsfoot-one-o2o"
              markerWidth="12"
              markerHeight="14"
              refX="10"
              refY="7"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path
                d="M 4 2 L 4 12 M 9 2 L 9 12"
                fill="none"
                stroke="#34d399"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </marker>

            {/* 5. Inferred Many Marker (Amber) */}
            <marker
              id="crowsfoot-many-inf"
              markerWidth="14"
              markerHeight="14"
              refX="12"
              refY="7"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path
                d="M 1 2 L 12 7 L 1 12 M 1 7 L 12 7"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </marker>

            {/* 6. Inferred One Marker (Amber) */}
            <marker
              id="crowsfoot-one-inf"
              markerWidth="12"
              markerHeight="14"
              refX="10"
              refY="7"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path
                d="M 4 2 L 4 12 M 9 2 L 9 12"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </marker>

            {/* 7. Dimmed Marker for unselected relationships */}
            <marker
              id="crowsfoot-dim"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path
                d="M 1 1 L 9 5 L 1 9"
                fill="none"
                stroke="#334155"
                strokeWidth="1.5"
              />
            </marker>

            {/* Linear Gradients for Edge Flows */}
            <linearGradient id="edge-grad-auth" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>

            <linearGradient id="edge-grad-m2m" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="50%" stopColor="#e879f9" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>

            <linearGradient id="edge-grad-o2o" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Render All Calculated Bezier Relationship Edges */}
          {edges.map((edge, idx) => {
            if (!edge) return null;
            const { rel, pathData, startX, startY, endX, endY, midX, midY, isM2M, isO2O, isO2M, isHighlighted, isHovered } = edge;

            const isAuth = rel.confidence === 'authoritative';

            // Theme color resolution
            const strokeColor = !isHighlighted
              ? '#1e293b'
              : isHovered
              ? '#38bdf8'
              : isM2M
              ? '#c084fc'
              : isO2O
              ? '#34d399'
              : isAuth
              ? '#38bdf8'
              : '#fbbf24';

            // Endpoint markers selection
            const startMarker = !isHighlighted
              ? undefined
              : isM2M
              ? 'url(#crowsfoot-many-m2m)'
              : isO2O
              ? 'url(#crowsfoot-one-o2o)'
              : isAuth
              ? 'url(#crowsfoot-one-auth)'
              : 'url(#crowsfoot-one-inf)';

            const endMarker = !isHighlighted
              ? 'url(#crowsfoot-dim)'
              : isM2M
              ? 'url(#crowsfoot-many-m2m)'
              : isO2O
              ? 'url(#crowsfoot-one-o2o)'
              : isAuth
              ? 'url(#crowsfoot-many-auth)'
              : 'url(#crowsfoot-many-inf)';

            return (
              <g
                key={rel.id || idx}
                className="cursor-pointer pointer-events-auto transition-opacity duration-200"
                onClick={() => setSelectedRelationship(rel)}
                onMouseEnter={() => setHoveredRelationship(rel)}
                onMouseLeave={() => setHoveredRelationship(null)}
              >
                {/* 1. Wide invisible stroke for easy click target & hover */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={24}
                />

                {/* 2. Soft background glow under highlighted/hovered path */}
                {isHighlighted && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHovered ? 8 : isM2M ? 5 : 4}
                    strokeOpacity={isHovered ? 0.4 : 0.15}
                    className={animationsEnabled ? 'erd-pulse-glow' : undefined}
                  />
                )}

                {/* 3. Base path with endpoint markers */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isHighlighted ? (isHovered ? 3 : 2) : 1}
                  strokeDasharray={isAuth ? undefined : '5,5'}
                  markerStart={startMarker}
                  markerEnd={endMarker}
                  className="transition-colors duration-150"
                />

                {/* 4. Animated flowing dashes demonstrating directionality */}
                {isHighlighted && animationsEnabled && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke={isM2M ? '#f472b6' : isO2O ? '#6ee7b7' : isAuth ? '#7dd3fc' : '#fde047'}
                    strokeWidth={isHovered ? 2.5 : 1.8}
                    strokeDasharray={isM2M ? '8,12' : '6,10'}
                    className={isM2M ? 'erd-animated-flow-m2m' : 'erd-animated-flow'}
                    strokeLinecap="round"
                  />
                )}

                {/* 5. Animated particle dot traveling along relation path */}
                {isHighlighted && animationsEnabled && (isHovered || selectedTable) && (
                  <circle r={isHovered ? 3.5 : 2.5} fill={isM2M ? '#f472b6' : '#38bdf8'}>
                    <animateMotion
                      path={pathData}
                      dur={isM2M ? '2.5s' : '3.2s'}
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* 6. Port Connection Anchor Dots at Table Boundaries */}
                {isHighlighted && (
                  <>
                    <circle
                      cx={startX}
                      cy={startY}
                      r={isHovered ? 4.5 : 3}
                      fill={strokeColor}
                      className="transition-transform"
                    />
                    <circle
                      cx={endX}
                      cy={endY}
                      r={isHovered ? 4.5 : 3}
                      fill={strokeColor}
                      className="transition-transform"
                    />
                  </>
                )}

                {/* 7. Cardinality Badge in the middle of the connector */}
                {isHighlighted && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-24}
                      y={-10}
                      width={48}
                      height={20}
                      rx={10}
                      fill="#020617"
                      stroke={strokeColor}
                      strokeWidth={isHovered ? 1.8 : 1.2}
                      className="shadow-lg"
                    />
                    <text
                      x={0}
                      y={3.5}
                      fill={strokeColor}
                      fontSize="9.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {isM2M ? 'N : M' : isO2O ? '1 : 1' : '1 : N'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Interactive Draggable Table Cards */}
        {filteredTables.map(table => {
          const tKey = table.name.toLowerCase();
          const pos = nodePositions.get(tKey);
          if (!pos) return null;

          const isSelected = selectedTable?.toLowerCase() === tKey;
          const isConnected = selectedTable ? connectedTables.has(tKey) : true;
          const isBeingDragged = draggingTable === tKey;
          const tableWarnings = schema.warnings.filter(w => w.table?.toLowerCase() === tKey);

          return (
            <div
              key={table.name}
              id={`table-card-${table.name}`}
              className={`table-card absolute bg-slate-900/95 backdrop-blur-md rounded-2xl border transition-shadow duration-150 ${
                isBeingDragged
                  ? 'border-cyan-400 ring-4 ring-cyan-500/40 shadow-2xl shadow-cyan-500/30 z-40 scale-[1.01] cursor-grabbing'
                  : isSelected
                  ? 'border-cyan-400 ring-2 ring-cyan-500/30 shadow-2xl shadow-cyan-950/60 z-30'
                  : isConnected
                  ? 'border-slate-700/90 hover:border-slate-500 shadow-xl z-10'
                  : 'border-slate-800/80 opacity-45 hover:opacity-100 shadow z-0'
              }`}
              style={{
                left: pos.x,
                top: pos.y,
                width: pos.width
              }}
              onClick={e => {
                e.stopPropagation();
                onSelectTable(isSelected ? null : table.name);
              }}
            >
              {/* Card Header (Drag Handle) */}
              <div
                className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800/80 bg-slate-800/50 rounded-t-2xl cursor-grab active:cursor-grabbing hover:bg-slate-800/80 transition"
                onMouseDown={e => handleTableMouseDown(table.name, e)}
                onTouchStart={e => handleTableTouchStart(table.name, e)}
                title="Drag to move this table anywhere on canvas"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Move className="w-3.5 h-3.5 text-cyan-400/80 shrink-0" />
                  <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                  <span className="font-bold text-xs text-slate-100 font-mono truncate">
                    {table.name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {tableWarnings.length > 0 && (
                    <span
                      title={`${tableWarnings.length} architectural warning(s) on table`}
                      className="flex items-center gap-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40"
                    >
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {tableWarnings.length}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
                    {table.columns.length} cols
                  </span>
                </div>
              </div>

              {/* Columns List with Port Indicators */}
              <div className="py-1 divide-y divide-slate-800/40 max-h-[380px] overflow-y-auto">
                {table.columns.map(col => {
                  const isPk = col.isPrimaryKey || table.primaryKey.includes(col.name);
                  const isFk = col.isForeignKey || table.foreignKeys.some(f => f.columns.includes(col.name));

                  const isColHovered =
                    hoveredColumn?.table.toLowerCase() === tKey &&
                    hoveredColumn?.column.toLowerCase() === col.name.toLowerCase();

                  return (
                    <div
                      key={col.name}
                      onMouseEnter={() => setHoveredColumn({ table: table.name, column: col.name })}
                      onMouseLeave={() => setHoveredColumn(null)}
                      className={`flex items-center justify-between px-3 py-1.5 text-xs transition group relative ${
                        isColHovered ? 'bg-cyan-500/15 text-cyan-200' : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isPk ? (
                          <span
                            title="Primary Key (Unique Record Identifier)"
                            className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 rounded flex items-center gap-0.5 shrink-0"
                          >
                            <Key className="w-2.5 h-2.5" /> PK
                          </span>
                        ) : isFk ? (
                          <span
                            title="Foreign Key (References target table)"
                            className="text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1 rounded flex items-center gap-0.5 shrink-0"
                          >
                            <Link2 className="w-2.5 h-2.5" /> FK
                          </span>
                        ) : (
                          <span className="w-3 text-slate-600 text-center text-[10px] shrink-0">•</span>
                        )}
                        <span
                          className={`font-mono truncate ${
                            isPk
                              ? 'text-amber-200 font-semibold'
                              : isFk
                              ? 'text-cyan-300 font-medium'
                              : 'text-slate-300'
                          }`}
                        >
                          {col.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-mono text-slate-400 group-hover:text-slate-200 transition">
                          {col.type}
                        </span>
                        {!col.nullable && (
                          <span title="NOT NULL Constraint" className="text-[9px] text-rose-400 font-mono font-bold">
                            NN
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Indexes Summary Footer */}
              {showIndexes && table.indexes.length > 0 && (
                <div className="px-3.5 py-1.5 bg-slate-950/80 border-t border-slate-800/80 rounded-b-2xl text-[10px] text-slate-400 font-mono flex items-center justify-between">
                  <span>{table.indexes.length} indexes</span>
                  {table.uniqueConstraints.length > 0 && (
                    <span className="text-cyan-400/90 font-semibold">
                      {table.uniqueConstraints.length} unique
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Relationship Detail Drawer (when edge clicked or hovered) */}
      {(selectedRelationship || hoveredRelationship) && (
        <div
          id="erd-relationship-inspector"
          className="absolute bottom-4 left-4 right-4 max-w-xl mx-auto z-30 bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-4 shadow-2xl text-slate-200 flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-150"
        >
          {(() => {
            const rel = selectedRelationship || hoveredRelationship!;
            const isM2M = rel.type === 'many-to-many';
            const isO2O = rel.type === 'one-to-one';

            return (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isM2M ? 'bg-purple-400' : isO2O ? 'bg-emerald-400' : 'bg-cyan-400'
                      } animate-pulse`}
                    />
                    <h4 className="font-bold text-xs tracking-wide text-slate-100">
                      {isM2M
                        ? 'Many-to-Many Relationship (N:M)'
                        : isO2O
                        ? 'One-to-One Relationship (1:1)'
                        : 'One-to-Many Relationship (1:N)'}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        rel.confidence === 'authoritative'
                          ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30'
                          : 'bg-amber-950/60 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {rel.confidence.toUpperCase()}
                    </span>
                  </div>
                  {selectedRelationship && (
                    <button
                      onClick={() => setSelectedRelationship(null)}
                      className="text-slate-400 hover:text-slate-100 text-xs px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-xs font-mono">
                  <button
                    onClick={() => focusOnTable(rel.sourceTable)}
                    className="text-cyan-400 font-bold hover:underline"
                  >
                    {rel.sourceTable}.{rel.sourceColumns.join(', ')}
                  </button>
                  <span className="text-slate-500">──►</span>
                  <button
                    onClick={() => focusOnTable(rel.targetTable)}
                    className="text-amber-400 font-bold hover:underline"
                  >
                    {rel.targetTable}.{rel.targetColumns.join(', ')}
                  </button>
                  {rel.junctionTable && (
                    <span className="ml-auto text-[11px] text-purple-300 bg-purple-950/40 border border-purple-800/40 px-2 py-0.5 rounded-md">
                      Junction: {rel.junctionTable}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  Architectural Rule: {rel.evidence}
                </p>
              </>
            );
          })()}
        </div>
      )}

      {/* Floating Interactive Minimap Radar in Bottom-Right Corner */}
      {showMinimap && (
        <div
          id="erd-minimap-radar"
          className="absolute bottom-4 right-4 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-2 shadow-2xl flex flex-col gap-1.5 pointer-events-auto w-44"
        >
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium px-1">
            <span className="flex items-center gap-1 text-cyan-400 font-semibold">
              <Compass className="w-3 h-3" /> Radar
            </span>
            <span className="font-mono text-[9px] text-slate-500">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setShowMinimap(false)}
              className="text-slate-500 hover:text-slate-300"
              title="Minimize Radar"
            >
              <Minimize2 className="w-3 h-3" />
            </button>
          </div>

          <div
            className="relative w-full h-24 bg-slate-950/90 rounded-lg border border-slate-800/80 overflow-hidden cursor-crosshair"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = (e.clientX - rect.left) / rect.width;
              const clickY = (e.clientY - rect.top) / rect.height;

              const targetX = schemaBounds.minX + clickX * schemaBounds.width;
              const targetY = schemaBounds.minY + clickY * schemaBounds.height;

              if (containerRef.current) {
                const cw = containerRef.current.clientWidth;
                const ch = containerRef.current.clientHeight;
                setPan({
                  x: cw / 2 - targetX * scale,
                  y: ch / 2 - targetY * scale
                });
              }
            }}
          >
            {/* Miniature Tables */}
            {schema.tables.map(table => {
              const pos = nodePositions.get(table.name.toLowerCase());
              if (!pos) return null;

              const isSel = selectedTable?.toLowerCase() === table.name.toLowerCase();

              const normX = ((pos.x - schemaBounds.minX) / schemaBounds.width) * 100;
              const normY = ((pos.y - schemaBounds.minY) / schemaBounds.height) * 100;
              const normW = (pos.width / schemaBounds.width) * 100;
              const normH = (pos.height / schemaBounds.height) * 100;

              return (
                <div
                  key={table.name}
                  className={`absolute rounded-[2px] transition-colors ${
                    isSel ? 'bg-cyan-400 shadow' : 'bg-slate-700'
                  }`}
                  style={{
                    left: `${Math.max(0, Math.min(95, normX))}%`,
                    top: `${Math.max(0, Math.min(95, normY))}%`,
                    width: `${Math.max(4, normW)}%`,
                    height: `${Math.max(3, normH)}%`
                  }}
                />
              );
            })}

            {/* Viewport Indicator Rectangle */}
            {containerRef.current && (
              <div
                className="absolute border border-cyan-400/80 bg-cyan-500/10 pointer-events-none rounded-[2px]"
                style={{
                  left: `${Math.max(0, ((-pan.x / scale - schemaBounds.minX) / schemaBounds.width) * 100)}%`,
                  top: `${Math.max(0, ((-pan.y / scale - schemaBounds.minY) / schemaBounds.height) * 100)}%`,
                  width: `${Math.min(100, ((containerRef.current.clientWidth / scale) / schemaBounds.width) * 100)}%`,
                  height: `${Math.min(100, ((containerRef.current.clientHeight / scale) / schemaBounds.height) * 100)}%`
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Re-open Minimap button if closed */}
      {!showMinimap && (
        <button
          onClick={() => setShowMinimap(true)}
          className="absolute bottom-4 right-4 z-20 p-2 bg-slate-900/90 border border-slate-800 text-cyan-400 hover:text-cyan-300 rounded-xl shadow-lg transition"
          title="Open Radar Minimap"
        >
          <Compass className="w-4 h-4" />
        </button>
      )}

      {/* Canvas Help Instructions */}
      <div className="absolute bottom-3 left-4 text-[11px] text-slate-500 pointer-events-none hidden sm:flex items-center gap-3">
        <span>✦ Drag table headers to reposition</span>
        <span>✦ Click relationships or tables to inspect</span>
        <span>✦ Drag background to pan canvas</span>
      </div>
    </div>
  );
};


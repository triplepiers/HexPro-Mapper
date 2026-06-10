import React, { useMemo, useState, useEffect } from 'react';
import useMeasure from 'react-use-measure';
import * as d3 from 'd3';
import { bbox, hexGrid, center, booleanPointInPolygon, distance, rewind } from '@turf/turf';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';

interface HexMapProps {
  geoJson: FeatureCollection<Polygon | MultiPolygon> | null;
  resolution: number; // 5 to 100
  color: string;
  showOutline: boolean;
  hexPadding: number; // 0 to 1
  onHexagonsGenerated?: (hexagons: FeatureCollection<Polygon> | null) => void;
  onHoverChange?: (city: string | null, stats: { name: string, value: number, color: string } | null) => void;
}

export function HexMap({ geoJson, resolution, color, showOutline, hexPadding, onHexagonsGenerated, onHoverChange }: HexMapProps) {
  const [measureRef, bounds] = useMeasure();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { width, height } = bounds;
  const [isProcessing, setIsProcessing] = useState(false);
  const [hexagons, setHexagons] = useState<FeatureCollection<Polygon> | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  
  // Pan and Zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  useEffect(() => {
    if (!containerRef.current) return;
    const svg = d3.select(containerRef.current).select<SVGSVGElement>('svg');
    if (svg.empty()) return;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });

    svg.call(zoom);

    // Reset zoom when geoJson changes
    svg.call(zoom.transform as any, d3.zoomIdentity);
    setTransform({ x: 0, y: 0, k: 1 });
  }, [geoJson, width, height]);

  // Compute hex grid in a non-blocking way
  useEffect(() => {
    if (!geoJson || !geoJson.features || geoJson.features.length === 0) {
      setHexagons(null);
      onHexagonsGenerated?.(null);
      return;
    }

    setIsProcessing(true);
    setHexagons(null);
    setMapError(null);
    
    // Defer execution to allow UI to show loader
    const timer = setTimeout(() => {
      try {
        const box = bbox(geoJson);
        if (!isFinite(box[0]) || !isFinite(box[1]) || !isFinite(box[2]) || !isFinite(box[3])) {
          throw new Error("Invalid bounding box");
        }
        
        const diag = distance([box[0], box[1]], [box[2], box[3]], { units: 'kilometers' });
        
        // Resolution is roughly how many hexes across the diagonal
        // e.g. diag = 5000km, res = 20 -> cellSide = 250km
        const MIN_CELL_SIDE = diag / 200; // Limit max hexes to roughly 200 across to prevent browser freeze
        const cellSide = Math.max(0.01, Math.max(MIN_CELL_SIDE, diag / (resolution * 2)));
        
        const rawGrid = hexGrid(box, cellSide, { units: 'kilometers' });
        // Fix D3 winding order logic where hexagons might be drawn as the entire world
        const grid = rewind(rawGrid, { reverse: true }) as FeatureCollection<Polygon>;
        
        // Filter hexes that intersect the boundary precisely using centroid masking
        const filteredFeatures: any[] = [];
        grid.features.forEach(hex => {
          const hexCenter = center(hex);
          for (const feature of geoJson.features) {
            try {
              if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                if (booleanPointInPolygon(hexCenter, feature as any)) {
                  filteredFeatures.push({
                    ...hex,
                    properties: {
                      ...hex.properties,
                      adcode: feature.properties?.adcode,
                      city: feature.properties?.name || 'Unknown',
                      value: feature.properties?.value || 0,
                      baseColor: feature.properties?.color || color
                    }
                  });
                  break; // found the containing feature
                }
              }
            } catch (e) {
              // ignore self-intersect rules
            }
          }
        });

        const result = {
          type: 'FeatureCollection' as const,
          features: filteredFeatures
        };

        setHexagons(result);
        onHexagonsGenerated?.(result);
      } catch (error: any) {
        console.error("Error generating hex grid:", error);
        setMapError(error.message || "Failed to generate grid. Is the GeoJSON valid?");
        setHexagons(null);
        onHexagonsGenerated?.(null);
      } finally {
        setIsProcessing(false);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [geoJson, resolution]);

  // D3 Projection and Path Generator
  const { projection, pathGenerator, correctedGeoJson } = useMemo(() => {
    if (!width || !height || !geoJson || !geoJson.features || geoJson.features.length === 0) {
      return { projection: null, pathGenerator: null, correctedGeoJson: null };
    }

    try {
      // Fix winding order for D3's fitExtent to prevent it from projecting the whole world
      const rewoundGeoJson = rewind(geoJson, { reverse: true });
      const padding = 40;
      const proj = d3.geoMercator().fitExtent([[padding, padding], [width - padding, height - padding]], rewoundGeoJson);
      
      // Use the rewound GeoJSON with the path generator to ensure correct SVG fills
      const pathGen = d3.geoPath().projection(proj);
      return { projection: proj, pathGenerator: pathGen, correctedGeoJson: rewoundGeoJson };
    } catch (e) {
      console.error("Projection error:", e);
      return { projection: null, pathGenerator: null, correctedGeoJson: null };
    }
  }, [width, height, geoJson]);

  return (
    <div ref={(node) => { measureRef(node); containerRef.current = node; }} className="absolute inset-0 overflow-hidden bg-[#050608] flex items-center justify-center p-8">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
      
      <div className="relative w-full h-full flex items-center justify-center">
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#050608]/50 z-10 backdrop-blur-sm">
            <div className="flex flex-col items-center text-cyan-400">
              <svg className="animate-spin h-8 w-8 mb-4 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="font-bold text-[10px] uppercase tracking-widest text-cyan-400">Generating Hexagons...</span>
            </div>
          </div>
        )}
        
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center text-red-400/80 text-[10px] uppercase tracking-widest font-bold z-20 bg-[#050608]/80 text-center px-4 leading-relaxed">
            Error: {mapError}
          </div>
        )}

        {!geoJson && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center text-white/30 text-[10px] uppercase tracking-widest font-bold">
            Upload a GeoJSON file to begin
          </div>
        )}

        {width > 0 && height > 0 && pathGenerator && !mapError && (
          <svg width={width} height={height} className="absolute inset-0 drop-shadow-[0_0_50px_rgba(0,229,255,0.1)] cursor-grab active:cursor-grabbing">
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
              {/* Base Map Outline */}
              {showOutline && correctedGeoJson && (
                <g className="transition-opacity duration-500 pointer-events-none" style={{ opacity: isProcessing || !hexagons ? 0.3 : 0.1 }}>
                  {correctedGeoJson.features.map((feature, i) => (
                    <path
                      key={`outline-${i}`}
                      d={pathGenerator(feature) || ''}
                      fill="transparent"
                      stroke="rgba(255,255,255,0.8)"
                      strokeWidth={1.5 / transform.k}
                    />
                  ))}
                </g>
              )}
              
              {/* Interaction Overlay (City Boundaries) */}
              {correctedGeoJson && (
                <g className="opacity-0">
                  {correctedGeoJson.features.map((feature, i) => (
                    <path
                      key={`interaction-${i}`}
                      d={pathGenerator(feature) || ''}
                      fill="rgba(0,0,0,0)" /* use a fully transparent fill instead of transparent to robustly catch mouse events in SVG */
                      className="cursor-pointer"
                      onMouseEnter={() => {
                        const city = feature.properties?.name || null;
                        setHoveredCity(city);
                        onHoverChange?.(city, {
                          name: city || 'Unknown',
                          value: feature.properties?.value || 0,
                          color: feature.properties?.color || color,
                        });
                      }}
                      onMouseLeave={() => {
                        setHoveredCity(null);
                        onHoverChange?.(null, null);
                      }}
                    />
                  ))}
                </g>
              )}

              {/* Hexagons */}
              {hexagons && correctedGeoJson && (
                <g className={isProcessing ? 'opacity-50 transition-opacity' : 'opacity-100 transition-opacity'}>
                  {hexagons.features.map((hex, i) => {
                    const path = pathGenerator(hex);
                    if (!path) return null;

                    // Simple scaling hack:
                    // To do proper padding in SVG paths, one could shrink the polygon, 
                    // but scaling around the centroid in SVG is easier per hex:
                    const centroid = d3.geoPath().projection(projection!).centroid(hex);
                    const scale = 1 - hexPadding;
                    const hexTransform = paddingEnabled(hexPadding, centroid, scale);

                    return (
                      <path
                        key={`hex-${i}`}
                        d={path}
                        fill={hoveredCity && hoveredCity === hex.properties?.city ? "#00e5ff" : (hex.properties?.baseColor || color)}
                        stroke="rgba(0,0,0,0.15)"
                        strokeWidth={1 / transform.k}
                        strokeLinejoin="round"
                        opacity={hoveredCity ? (hoveredCity === hex.properties?.city ? 1 : 0.25) : 0.85}
                        className="transition-all duration-300 pointer-events-none"
                        transform={hexTransform}
                      />
                    );
                  })}
                </g>
              )}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}

// Helper to generate a transform string that scales around a centroid
function paddingEnabled(padding: number, centroid: [number, number], scale: number) {
  if (padding === 0 || isNaN(centroid[0]) || isNaN(centroid[1])) return undefined;
  // Translate to origin, scale, translate back
  return `translate(${centroid[0]}, ${centroid[1]}) scale(${scale}) translate(${-centroid[0]}, ${-centroid[1]})`;
}

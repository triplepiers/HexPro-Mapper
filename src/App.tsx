import React, { useState, useEffect } from 'react';
import { Upload, SlidersHorizontal, Hexagon, Info, Map as MapIcon, Loader2 } from 'lucide-react';
import { HexMap } from './components/HexMap';
import type { FeatureCollection } from 'geojson';
import * as d3 from 'd3';

// A default GeoJSON string URL
const DEFAULT_COUNTRY = "Simple Square";

// A built-in default simple square outline so the map never starts completely blank
const defaultGeoData: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { ADMIN: "Fictional Island" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-122.5, 37.0],
            [-121.8, 37.2],
            [-121.5, 37.8],
            [-121.9, 38.4],
            [-122.4, 38.5],
            [-122.8, 38.1],
            [-123.0, 37.6],
            [-122.5, 37.0]
          ]
        ]
      }
    }
  ]
};

export default function App() {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [generatedHexagons, setGeneratedHexagons] = useState<FeatureCollection | null>(null);
  const [resolution, setResolution] = useState<number>(25); // 10 to 80
  const [hexColor, setHexColor] = useState<string>('#00e5ff'); // Immersive UI cyan-400
  const [showOutline, setShowOutline] = useState<boolean>(true);
  const [hexPadding, setHexPadding] = useState<number>(0.15); // 0 to 0.5
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('Zhejiang Province (DataV)');
  const [hoverData, setHoverData] = useState<{name: string, value: number, color: string} | null>(null);

  // Function to add deterministic mock heat data to GeoJSON features
  const enrichGeoJsonWithMockData = (data: any) => {
    if (data && Array.isArray(data.features)) {
      const heatScale = d3.scaleLinear<string>().range(['#001a22', '#00e5ff']).domain([0, 100]);
      data.features.forEach((f: any, i: number) => {
        const value = Math.floor(Math.abs(Math.sin((i + 1) * 12.5)) * 90) + 10;
        f.properties = f.properties || {};
        f.properties.name = f.properties.name || `Sub-region ${i + 1}`;
        f.properties.value = value;
        f.properties.color = heatScale(value);
      });
    }
    return data;
  };

  // Use static data on mount so we don't try fetching external URLs
  useEffect(() => {
    setIsLoading(true);
    // Use dynamic import or direct fetch; since we're in Vite, let's fetch to avoid bundling massive JSON, but make sure it uses the correct base
    fetch('/zhejiang.json')
      .then(res => res.json())
      .then(data => {
        setFileName('Zhejiang Province');
        setGeoData(enrichGeoJsonWithMockData(data));
      })
      .catch(e => {
        console.error("Failed to load local zhejiang geojson", e);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleExport = () => {
    if (!generatedHexagons) {
      alert("No hexagons generated yet.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(generatedHexagons));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    
    // Sanitize the filename prefix, fallback if empty
    const safePrefix = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'export';
    downloadAnchorNode.setAttribute("download", `${safePrefix}.geojson`);
    
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name.replace(/\.geo?json$/i, ''));
    setIsLoading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        let validGeoData: any = null;

        if (json.type === 'FeatureCollection') {
          validGeoData = json;
        } else if (json.type === 'Feature') {
          validGeoData = { type: 'FeatureCollection', features: [json] };
        } else if (json.type === 'Polygon' || json.type === 'MultiPolygon') {
          validGeoData = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: json }] };
        } else if (Array.isArray(json.features)) {
          validGeoData = { type: 'FeatureCollection', features: json.features };
        } else if (json.type === 'Topology') {
          throw new Error("TopoJSON is not supported. Please upload GeoJSON.");
        } else {
          throw new Error("Invalid format. Must be a GeoJSON FeatureCollection.");
        }

        if (!validGeoData.features || validGeoData.features.length === 0) {
          throw new Error("GeoJSON contains no features.");
        }

        setGeoData(enrichGeoJsonWithMockData(validGeoData));
      } catch (error: any) {
        console.error("Upload error:", error);
        setUploadError(error.message || 'Invalid JSON file.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#050608] text-[#e0e0e0] font-sans overflow-hidden">
      
      <nav className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-[#0a0b0e] shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-cyan-400 rounded flex items-center justify-center">
             <Hexagon className="w-5 h-5 text-black" fill="currentColor" />
          </div>
          <span className="font-bold tracking-tighter text-xl uppercase">HEX<span className="text-cyan-400">PRO</span> MAPPER</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-2 text-xs font-mono text-cyan-400/80">
            <span className="px-2 py-1 bg-cyan-400/10 border border-cyan-400/20 hidden sm:inline-block">GPU_ACCEL: ON</span>
            <span className="px-2 py-1 bg-cyan-400/10 border border-cyan-400/20 hidden sm:inline-block">EPSG: 4326</span>
          </div>
          <button onClick={handleExport} className="px-4 py-1.5 bg-cyan-400 text-black font-bold text-xs rounded shadow-[0_0_15px_rgba(0,229,255,0.4)] hover:bg-cyan-300 transition-colors">EXPORT GEOJSON</button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-[300px] bg-[#0a0b0e] border-r border-white/10 p-6 flex flex-col gap-8 shrink-0 overflow-y-auto">
          <section>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-4 font-bold">Source Input</h3>
            <label className="block relative cursor-pointer">
              <div className="border-2 border-dashed border-white/10 rounded-lg p-4 bg-white/5 text-center hover:border-cyan-400/50 hover:bg-cyan-400/5 transition-all">
                <input 
                  type="file" 
                  accept=".geojson,.json" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                />
                <p className="text-xs text-white/50 mb-2 truncate max-w-full" title={fileName}>{fileName}</p>
                <div className="text-[10px] text-cyan-300 underline uppercase font-bold tracking-wider flex items-center justify-center gap-1">
                   {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Change File'}
                </div>
              </div>
            </label>
            {uploadError && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px] break-words">
                {uploadError}
              </div>
            )}
          </section>

          <section className="space-y-6">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Grid Parameters</h3>
            <div className="space-y-4">
              
              {/* Resolution Slider */}
              <div>
                <div className="flex justify-between text-[11px] mb-2">
                  <span>Hexagon Resolution</span>
                  <span className="text-cyan-300 font-mono">{resolution}</span>
                </div>
                <input 
                  type="range" 
                  min="10" max="80" step="5"
                  value={resolution}
                  onChange={(e) => setResolution(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
              </div>

              {/* Cell Padding Slider */}
              <div>
                <div className="flex justify-between text-[11px] mb-2">
                  <span>Inter-tile Gap</span>
                  <span className="text-cyan-300 font-mono">{Math.round(hexPadding * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="0.5" step="0.05"
                  value={hexPadding}
                  onChange={(e) => setHexPadding(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                 <div className="p-3 bg-white/5 border border-white/10 rounded flex items-center justify-between pb-2 cursor-pointer" onClick={() => setShowOutline(!showOutline)}>
                   <p className="text-[9px] uppercase text-white/30 mb-1">Outline</p>
                   <p className={`text-xs font-bold ${showOutline ? 'text-cyan-300' : 'text-white/50'}`}>{showOutline ? 'ON' : 'OFF'}</p>
                 </div>
                 <div className="p-3 bg-white/5 border border-white/10 rounded relative overflow-hidden group">
                   <p className="text-[9px] uppercase text-white/30 mb-1">Fill Color</p>
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: hexColor }}></div>
                     <p className="text-xs font-bold font-mono text-cyan-300 truncate w-14">{hexColor}</p>
                   </div>
                   <input 
                     type="color" 
                     value={hexColor}
                     onChange={(e) => setHexColor(e.target.value)}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                   />
                 </div>
              </div>
            </div>
          </section>
        </aside>

        {/* Main Canvas */}
        <main className="flex-1 relative overflow-hidden flex flex-col bg-[#050608]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#050608]/50 z-20 backdrop-blur-sm">
              <div className="flex flex-col items-center text-cyan-400">
                 <Loader2 className="animate-spin h-8 w-8 mb-4 opacity-75" />
                 <span className="font-bold text-[10px] uppercase tracking-widest text-cyan-400">Downloading GeoJSON...</span>
              </div>
            </div>
          ) : hoverData ? (
            <div className="absolute top-4 left-4 p-3 border border-white/10 bg-black/60 backdrop-blur-md rounded-lg shadow-2xl z-10 min-w-32 text-left pointer-events-none transition-all duration-300 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm border border-white/20" style={{ backgroundColor: hoverData.color }}></div>
                <p className="text-sm text-white font-medium">{hoverData.name}</p>
              </div>
              <div className="pl-4">
                <p className="text-xl font-mono text-cyan-300">{hoverData.value}</p>
              </div>
            </div>
          ) : null}

          {/* We cast to any to avoid complex geojson type discrimination for the prototype */}
          <HexMap 
            geoJson={geoData as any} 
            resolution={resolution}
            color={hexColor}
            showOutline={showOutline}
            hexPadding={hexPadding}
            onHexagonsGenerated={setGeneratedHexagons as any}
            onHoverChange={(city, stats) => setHoverData(stats)}
          />
        </main>
      </div>

      <footer className="h-8 border-t border-white/10 bg-[#0a0b0e] flex items-center px-8 justify-between shrink-0">
        <div className="flex items-center gap-4 text-[10px] uppercase font-bold text-white/30 hidden sm:flex">
          <span>READY FOR EXPORT</span>
        </div>
        <div className="text-[10px] font-mono text-cyan-400/50 uppercase ml-auto">
          System Status: Optimized // Memory: 2.4GB // Tileset v2.1
        </div>
      </footer>
    </div>
  );
}

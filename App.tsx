import React, { useState, useCallback } from 'react';
import { UploadedImage, AppStatus, GenerationResult } from './types';
import { generateCharacterDraft, reprocessPixelArt } from './services/geminiService';
import { Button } from './components/Button';
import { ImageUploader } from './components/ImageUploader';

const App: React.FC = () => {
  const [refImages, setRefImages] = useState<UploadedImage[]>([]);
  const [targetImage, setTargetImage] = useState<UploadedImage | null>(null);
  const [userPrompt, setUserPrompt] = useState<string>('');
  
  // State for the 2-step process
  const [draftBase64, setDraftBase64] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  const [resolution, setResolution] = useState<number>(64);
  const [removeBackground, setRemoveBackground] = useState<boolean>(false);
  const [maxColors, setMaxColors] = useState<number>(32);

  const handleRefUpload = useCallback((files: File[]) => {
    const newImages = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    
    setRefImages(prev => {
      const combined = [...prev, ...newImages];
      return combined.slice(0, 10);
    });
  }, []);

  const handleTargetUpload = useCallback((files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setTargetImage({
        id: Math.random().toString(36).substr(2, 9),
        file,
        previewUrl: URL.createObjectURL(file)
      });
      // Reset everything when new target is uploaded
      setResult(null);
      setDraftBase64(null);
      setStatus(AppStatus.IDLE);
    }
  }, []);

  const removeRefImage = (id: string) => {
    setRefImages(prev => prev.filter(img => img.id !== id));
  };

  // Step 1: Generate Draft
  const handleGenerateDraft = async () => {
    if (!targetImage || refImages.length < 2) {
      setErrorMsg("Please upload at least 2 reference images and 1 target image.");
      return;
    }

    setStatus(AppStatus.GENERATING);
    setErrorMsg('');
    setResult(null); // Clear previous result if any

    try {
      // Step 1: Get the intermediate cartoon image
      const rawData = await generateCharacterDraft(refImages, targetImage, removeBackground, userPrompt, maxColors);
      setDraftBase64(rawData);
      setStatus(AppStatus.SUCCESS); 
    } catch (err: any) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setErrorMsg(err.message || "Failed to generate draft.");
    }
  };

  // Step 2: Finalize Blueprint (Process Draft)
  const handleFinalize = async () => {
    if (!draftBase64) return;

    setStatus(AppStatus.GENERATING);
    try {
      const data = await reprocessPixelArt(draftBase64, resolution, maxColors);
      setResult(data);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setErrorMsg("Failed to process blueprint.");
    }
  };

  const handleDiscardDraft = () => {
    setDraftBase64(null);
    setResult(null);
    setStatus(AppStatus.IDLE);
  };

  // Helper to determine what is currently being shown
  const isShowingDraft = draftBase64 && !result;
  const isShowingResult = !!result;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 font-sans">
      {/* Header */}
      <header className="mb-8 border-b border-retro-border pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-4xl md:text-5xl font-mono font-bold text-retro-accent tracking-tighter">
            <span className="text-white">PIXEL</span>FORGE
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm md:text-base">
            AI-POWERED STYLE REFACTORING ENGINE
          </p>
        </div>
        <div className="hidden md:block text-right">
          <div className="text-xs text-retro-warning font-mono border border-retro-warning px-2 py-1 inline-block rounded">
            v2.0.0 // DUAL_PHASE
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Inputs */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Reference Section */}
          <section className="bg-retro-panel/30 p-4 rounded-xl border border-retro-border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-mono text-slate-200">
                1. STYLE REFERENCES
              </h2>
              <span className={`text-xs font-mono px-2 py-1 rounded ${refImages.length >= 2 && refImages.length <= 10 ? 'bg-retro-success/20 text-retro-success' : 'bg-retro-error/20 text-retro-error'}`}>
                {refImages.length}/10 (Min 2)
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-4 min-h-[100px]">
              {refImages.map(img => (
                <div key={img.id} className="relative group aspect-square border border-retro-border bg-retro-dark overflow-hidden rounded">
                  <img src={img.previewUrl} alt="ref" className="w-full h-full object-cover pixelated" />
                  <button 
                    onClick={() => removeRefImage(img.id)}
                    className="absolute top-0 right-0 bg-retro-error text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
              {refImages.length < 10 && (
                 <div className="aspect-square">
                    <ImageUploader 
                      onUpload={handleRefUpload} 
                      multiple={true} 
                      label="+" 
                      subLabel="Add Ref"
                    />
                 </div>
              )}
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Upload 2-10 images to define the pixel art style (palette, shading, outlines).
            </p>
          </section>

          {/* Target Section */}
          <section className="bg-retro-panel/30 p-4 rounded-xl border border-retro-border">
            <h2 className="text-xl font-mono text-slate-200 mb-4">
              2. TARGET INPUT
            </h2>
            <div className="aspect-video w-full mb-4">
              {targetImage ? (
                <div className="relative w-full h-full border-2 border-retro-accent rounded overflow-hidden bg-retro-dark group">
                  <img src={targetImage.previewUrl} alt="target" className="w-full h-full object-contain" />
                  <button 
                    onClick={() => {
                        setTargetImage(null);
                        setDraftBase64(null);
                        setResult(null);
                    }}
                    className="absolute top-2 right-2 bg-retro-dark/80 text-white px-3 py-1 font-mono text-sm border border-white hover:bg-white hover:text-black transition-colors"
                  >
                    CHANGE
                  </button>
                </div>
              ) : (
                <ImageUploader 
                  onUpload={handleTargetUpload} 
                  label="Drop Target Image"
                  subLabel="The image to be refactored"
                />
              )}
            </div>
          </section>

          {/* Optional Prompt Section */}
          <section className="bg-retro-panel/30 p-4 rounded-xl border border-retro-border">
            <h2 className="text-xl font-mono text-slate-200 mb-2 flex justify-between items-center">
              <span>3. TEXT INSTRUCTION</span>
              <span className="text-xs text-slate-500 font-mono">OPTIONAL (50% WEIGHT)</span>
            </h2>
            <textarea
              className="w-full bg-retro-dark border border-retro-border rounded p-3 font-mono text-sm text-slate-200 focus:border-retro-accent focus:ring-1 focus:ring-retro-accent outline-none resize-none h-24 placeholder-slate-600"
              placeholder="e.g. Make the character wear a red hat, add flames to the sword..."
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
            />
          </section>

          {/* Config Section */}
          <section className="bg-retro-panel/30 p-4 rounded-xl border border-retro-border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-mono text-slate-200">4. CONFIGURATION</h2>
              <span className="text-retro-accent font-mono text-xl border border-retro-accent px-2 py-0.5 rounded bg-retro-accent/10">
                {resolution}x{resolution}
              </span>
            </div>
            
            {/* Resolution Slider */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-slate-400 mb-2">GRID RESOLUTION</label>
              <div className="flex items-center gap-4 px-2">
                <span className="font-mono text-xs text-slate-500">20px</span>
                <input 
                  type="range" 
                  min="20" 
                  max="200" 
                  step="2"
                  value={resolution} 
                  onChange={(e) => setResolution(parseInt(e.target.value))}
                  className="w-full h-2 bg-retro-dark rounded-lg appearance-none cursor-pointer accent-retro-accent hover:accent-retro-success transition-all"
                />
                <span className="font-mono text-xs text-slate-500">200px</span>
              </div>
            </div>

            {/* Max Colors Input */}
            <div className="mb-6">
              <label className="block text-xs font-mono text-slate-400 mb-2">MAX COLORS (PALETTE SIZE)</label>
              <div className="flex items-center gap-2 px-2">
                <input 
                  type="number" 
                  min="2" 
                  max="256" 
                  value={maxColors}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) setMaxColors(val);
                  }}
                  onBlur={() => {
                     setMaxColors(prev => Math.max(2, Math.min(256, prev)));
                  }}
                  className="w-full bg-retro-dark border border-retro-border rounded p-2 font-mono text-slate-200 focus:border-retro-accent outline-none"
                />
                <span className="text-xs text-slate-500 font-mono whitespace-nowrap">BLOCKS</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1 px-2">
                Applies to both Draft generation and Final Blueprint.
              </p>
            </div>

            <div className="bg-retro-dark/50 p-3 rounded border border-retro-border mb-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    checked={removeBackground}
                    onChange={(e) => setRemoveBackground(e.target.checked)}
                    className="peer h-5 w-5 appearance-none rounded border-2 border-retro-border bg-retro-dark checked:border-retro-accent checked:bg-retro-accent transition-all"
                  />
                  <svg 
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-retro-dark opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="4" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div>
                  <span className="block font-mono text-slate-200 group-hover:text-white transition-colors">
                    REMOVE BACKGROUND
                  </span>
                  <span className="block text-xs text-slate-500 font-mono mt-0.5">
                    Focus strictly on character & items. Transparent output.
                  </span>
                </div>
              </label>
            </div>

          </section>

          {/* Action Area */}
          <div className="pt-4 space-y-3">
             {errorMsg && (
               <div className="mb-4 p-3 bg-retro-error/20 border border-retro-error text-retro-error font-mono text-sm">
                 ERROR: {errorMsg}
               </div>
             )}

             {/* Logic for Buttons based on State */}
             {!draftBase64 ? (
                <Button 
                  onClick={handleGenerateDraft} 
                  className="w-full text-xl py-4"
                  disabled={status === AppStatus.GENERATING || !targetImage || refImages.length < 2}
                  isLoading={status === AppStatus.GENERATING}
                >
                  {status === AppStatus.GENERATING ? 'GENERATING CONCEPT...' : 'STEP 1: GENERATE DRAFT CONCEPT'}
                </Button>
             ) : (
                <div className="space-y-3">
                  {/* Step 2 Actions */}
                  <Button 
                    onClick={handleFinalize} 
                    className="w-full text-xl py-4 border-b-4 border-green-800 bg-retro-success hover:bg-green-400 text-retro-dark"
                    disabled={status === AppStatus.GENERATING}
                    isLoading={status === AppStatus.GENERATING}
                  >
                    {status === AppStatus.GENERATING ? 'CALCULATING BLUEPRINT...' : 'STEP 2: FINALIZE BLUEPRINT'}
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-3">
                     <Button 
                        onClick={handleGenerateDraft}
                        variant="secondary"
                        disabled={status === AppStatus.GENERATING}
                        className="text-sm py-3"
                     >
                        RETRY DRAFT
                     </Button>
                     <Button 
                        onClick={handleDiscardDraft}
                        variant="danger"
                        disabled={status === AppStatus.GENERATING}
                         className="text-sm py-3"
                     >
                        CLEAR ALL
                     </Button>
                  </div>
                  <p className="text-center text-xs font-mono text-slate-400 mt-2">
                    Adjust Grid Resolution or Max Colors above, then click Finalize to update the blueprint.
                  </p>
                </div>
             )}
          </div>

        </div>

        {/* Right Column: Output */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Output Image */}
          <section className="bg-black/40 rounded-xl border-2 border-retro-border p-1 flex flex-col">
            <div className="bg-retro-panel px-4 py-2 flex justify-between items-center border-b border-retro-border">
              <h2 className="font-mono text-slate-300">
                {isShowingResult ? 'FINAL BLUEPRINT' : isShowingDraft ? 'DRAFT CONCEPT PREVIEW' : 'OUTPUT TERMINAL'}
              </h2>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-4 min-h-[400px] relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
              
              {/* Idle State */}
              {status === AppStatus.IDLE && !draftBase64 && !result && (
                <div className="text-center text-slate-600 font-mono">
                  <p className="text-6xl mb-4 opacity-20">WAITING</p>
                  <p>System Ready. Awaiting Inputs.</p>
                </div>
              )}

              {/* Generating State */}
              {status === AppStatus.GENERATING && (
                <div className="text-center">
                  <div className="inline-block w-16 h-16 border-4 border-retro-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="font-mono text-retro-accent animate-pulse">
                    {draftBase64 ? 'PROCESSING GRID & COLORS...' : 'GENERATING DRAFT CONCEPT...'}
                  </p>
                </div>
              )}

              {/* Draft View */}
              {isShowingDraft && !isShowingResult && status !== AppStatus.GENERATING && (
                <div className="relative w-full h-full flex items-center justify-center">
                   <div className="relative max-w-full max-h-full border-4 border-retro-warning shadow-[0_0_20px_rgba(255,165,0,0.2)]">
                      <img 
                        src={`data:image/png;base64,${draftBase64}`}
                        alt="Draft Concept" 
                        className="max-w-full max-h-[600px] object-contain bg-checkered" 
                      />
                      <div className="absolute top-0 left-0 bg-retro-warning text-retro-dark text-xs font-mono px-2 py-1 font-bold">
                        DRAFT MODE
                      </div>
                   </div>
                </div>
              )}

              {/* Final Result View */}
              {isShowingResult && (
                <div className="relative w-full h-full flex items-center justify-center">
                   <div className="relative max-w-full max-h-full border-4 border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                      <img 
                        src={result!.imageUrl} 
                        alt="Generated Pixel Art" 
                        className="max-w-full max-h-[600px] pixelated object-contain bg-checkered" 
                      />
                      <div className="absolute bottom-0 left-0 bg-black/70 text-white text-xs font-mono px-2 py-1">
                        {result!.resolution}x{result!.resolution} // {result!.palette.length} COLORS
                      </div>
                   </div>
                </div>
              )}
            </div>
            
            {/* Download Actions */}
            <div className="bg-retro-panel p-4 border-t border-retro-border flex justify-between items-center">
               <span className="text-xs font-mono text-slate-500">
                  {isShowingDraft ? "Draft generated. Review shape and colors." : isShowingResult ? "Blueprint ready for export." : ""}
               </span>
               
               {result && (
                  <a 
                    href={result.imageUrl} 
                    download="pixel-forge-blueprint.png"
                    className="bg-retro-success text-retro-dark font-mono px-4 py-2 font-bold hover:bg-green-300 transition-colors uppercase"
                  >
                    Download Blueprint
                  </a>
               )}
            </div>
          </section>

          {/* Palette Legend (Only for Final Result) */}
          {result && result.palette.length > 0 && (
            <section className="bg-retro-panel/30 p-4 rounded-xl border border-retro-border">
              <h2 className="text-xl font-mono text-slate-200 mb-4 flex justify-between items-center">
                <span>COLOR BLUEPRINT KEY</span>
                <span className="text-xs text-slate-400">Total Unique Blocks: {result.palette.length}</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {result.palette.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 bg-retro-dark/50 p-2 rounded border border-retro-border">
                    <div 
                      className="w-10 h-10 border border-white/20 shadow-sm flex items-center justify-center font-bold font-mono text-lg shrink-0"
                      style={{ backgroundColor: p.hex, color: p.textColor }}
                    >
                      {p.id}
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono text-white text-sm">ID: {p.id}</div>
                      <div className="font-mono text-xs text-slate-500 truncate">{p.hex}</div>
                      <div className="font-mono text-[10px] text-slate-600">Cnt: {p.count}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

      </main>
    </div>
  );
};

export default App;
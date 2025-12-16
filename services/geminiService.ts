import { GoogleGenAI } from "@google/genai";
import { UploadedImage, GenerationResult, PaletteItem } from "../types";

const MODEL_NAME = "gemini-2.5-flash-image";

// Helper to convert File to Base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
};

const getContrastColor = (r: number, g: number, b: number) => {
  // Calculate luminance
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
};

// --- Quantization Logic ---

interface TempColor {
  r: number;
  g: number;
  b: number;
  count: number;
}

const generateStrictPalette = (data: Uint8ClampedArray, maxColors: number): PaletteItem[] => {
  const colorMap = new Map<string, TempColor>();
  
  // 1. Build Histogram
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // Skip transparent
    
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Initial rounding to reduce noise (optional but helpful for performance)
    // Rounding to nearest 4 helps group extremely similar colors
    const rR = Math.round(r / 4) * 4;
    const gR = Math.round(g / 4) * 4;
    const bR = Math.round(b / 4) * 4;
    
    const key = `${rR},${gR},${bR}`;
    if (colorMap.has(key)) {
      colorMap.get(key)!.count++;
    } else {
      colorMap.set(key, { r: rR, g: gR, b: bR, count: 1 });
    }
  }

  let palette = Array.from(colorMap.values());

  // 2. Reduce Palette (Iterative Greedy Merge)
  // If palette is too large, first merge very close colors aggressively
  if (palette.length > maxColors) {
    
    // Helper to calculate squared distance
    const distSq = (c1: TempColor, c2: TempColor) => 
      (c1.r - c2.r)**2 + (c1.g - c2.g)**2 + (c1.b - c2.b)**2;

    while (palette.length > maxColors) {
      // Find closest pair
      let minD = Infinity;
      let idx1 = -1;
      let idx2 = -1;

      for (let i = 0; i < palette.length - 1; i++) {
        for (let j = i + 1; j < palette.length; j++) {
          const d = distSq(palette[i], palette[j]);
          if (d < minD) {
            minD = d;
            idx1 = i;
            idx2 = j;
            if (d === 0) break; // Identical
          }
        }
        if (minD === 0) break;
      }

      if (idx1 !== -1 && idx2 !== -1) {
        // Merge idx2 into idx1
        const c1 = palette[idx1];
        const c2 = palette[idx2];
        const total = c1.count + c2.count;
        
        c1.r = Math.round((c1.r * c1.count + c2.r * c2.count) / total);
        c1.g = Math.round((c1.g * c1.count + c2.g * c2.count) / total);
        c1.b = Math.round((c1.b * c1.count + c2.b * c2.count) / total);
        c1.count = total;

        // Remove idx2 (swap with last and pop for O(1) removal, but order doesn't matter yet)
        palette[idx2] = palette[palette.length - 1];
        palette.pop();
      } else {
        break; // Should not happen
      }
    }
  }

  // 3. Convert to Final Palette Items
  return palette
    .sort((a, b) => b.count - a.count) // Sort by usage for nice ID ordering (1 = most common)
    .map((p, idx) => ({
      id: idx + 1,
      r: p.r,
      g: p.g,
      b: p.b,
      hex: rgbToHex(p.r, p.g, p.b),
      count: 0, // Will be recounted during mapping
      textColor: getContrastColor(p.r, p.g, p.b)
    }));
};

const findNearestColorId = (r: number, g: number, b: number, palette: PaletteItem[]): number => {
  let minD = Infinity;
  let id = 0;
  for (const p of palette) {
    const d = (p.r - r)**2 + (p.g - g)**2 + (p.b - b)**2;
    if (d < minD) {
      minD = d;
      id = p.id;
    }
  }
  return id;
};

// Helper: Physically force the image into a pixel grid, upscale, add WHITE BACKGROUND, GRID LINES, and NUMBERS.
const enforcePixelGrid = async (base64Data: string, resolution: number, maxColors: number): Promise<GenerationResult> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Step 1: Create the logical tiny canvas (The Data Layer)
      const tinyCanvas = document.createElement('canvas');
      tinyCanvas.width = resolution;
      tinyCanvas.height = resolution;
      const tinyCtx = tinyCanvas.getContext('2d');
      if (!tinyCtx) { reject(new Error('Canvas context failed')); return; }
      
      // High quality downsampling to average colors into the grid
      tinyCtx.imageSmoothingEnabled = true;
      tinyCtx.imageSmoothingQuality = 'high';
      tinyCtx.drawImage(img, 0, 0, resolution, resolution);

      // Get the raw pixel data
      const imgData = tinyCtx.getImageData(0, 0, resolution, resolution);
      const data = imgData.data;

      // --- STRICT QUANTIZATION ---
      const palette = generateStrictPalette(data, maxColors);
      const pixelMap: number[] = new Array(resolution * resolution).fill(0);

      // Step 2: Create the display/download canvas (The View Layer)
      const pixelScale = Math.max(16, Math.floor(1200 / resolution)); 
      const finalSize = resolution * pixelScale;
      
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = finalSize;
      finalCanvas.height = finalSize;
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) { reject(new Error('Final Canvas context failed')); return; }

      // A. Fill Background with PURE WHITE (#FFFFFF)
      finalCtx.fillStyle = '#FFFFFF';
      finalCtx.fillRect(0, 0, finalSize, finalSize);

      // Pass 1: Map Pixels to Palette
      for (let y = 0; y < resolution; y++) {
        for (let x = 0; x < resolution; x++) {
          const index = (y * resolution + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];

          if (a > 128) {
            const pid = findNearestColorId(r, g, b, palette);
            pixelMap[y * resolution + x] = pid;
            // Update count in palette
            const pItem = palette.find(p => p.id === pid);
            if (pItem) pItem.count++;
          } else {
            pixelMap[y * resolution + x] = 0; // Transparent
          }
        }
      }

      // Filter out unused colors from palette (if quantization left some stragglers not mapped to?)
      const usedPalette = palette.filter(p => p.count > 0).sort((a,b) => a.id - b.id);

      // Pass 2: Draw blocks, lines, and numbers
      finalCtx.textAlign = 'center';
      finalCtx.textBaseline = 'middle';
      const fontSize = Math.floor(pixelScale * 0.4); 
      finalCtx.font = `bold ${fontSize}px sans-serif`;

      for (let y = 0; y < resolution; y++) {
        for (let x = 0; x < resolution; x++) {
          const pid = pixelMap[y * resolution + x];
          if (pid === 0) continue; 

          const pItem = usedPalette.find(p => p.id === pid);
          if (!pItem) continue;

          const drawX = x * pixelScale;
          const drawY = y * pixelScale;

          // 1. Draw Color Block
          finalCtx.fillStyle = `rgb(${pItem.r},${pItem.g},${pItem.b})`;
          finalCtx.fillRect(drawX, drawY, pixelScale, pixelScale);

          // 2. Draw GRID LINE
          finalCtx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
          finalCtx.lineWidth = 1;
          finalCtx.strokeRect(drawX, drawY, pixelScale, pixelScale);

          // 3. Draw NUMBER
          finalCtx.fillStyle = pItem.textColor;
          finalCtx.fillText(pid.toString(), drawX + pixelScale / 2, drawY + pixelScale / 2);
        }
      }
      
      resolve({
        imageUrl: finalCanvas.toDataURL('image/png'),
        palette: usedPalette,
        resolution
      });
    };
    img.onerror = reject;
    img.src = `data:image/png;base64,${base64Data}`;
  });
};

// STEP 1: Generate the Cartoon/Stylized Draft
export const generateCharacterDraft = async (
  referenceImages: UploadedImage[],
  targetImage: UploadedImage,
  removeBackground: boolean,
  userPrompt: string = "",
  maxColors: number = 32
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const referenceParts = await Promise.all(referenceImages.map(img => fileToGenerativePart(img.file)));
  const targetPart = await Promise.all([fileToGenerativePart(targetImage.file)]);

  const bgInstruction = removeBackground 
    ? "BACKGROUND: PURE WHITE (#FFFFFF). Output ONLY the character/object." 
    : "BACKGROUND: Simple, clean, fitting retro background.";

  const promptInstruction = userPrompt.trim() 
    ? `USER OVERRIDE: "${userPrompt}".` 
    : "";

  const prompt = `
    ROLE: You are a Vector Art & Pixel Style Concept Artist.
    
    TASK:
    1. Analyze STYLE REFERENCES for palette/shading.
    2. Analyze TARGET INPUT.
    3. RECOMPOSE and REDRAW the target subject to create a square concept art.
    4. ${promptInstruction}
    
    CRITICAL COMPOSITION RULES (MANDATORY):
    - EXTREME FILL: The character/object MUST occupy 95-100% of the canvas height or width.
    - NO PADDING: Do not leave ANY margin. The subject's hair/hat/shoes should touch the edges of the frame.
    - REFRAME: If the target is a full body, zoom in or widen the stance to fill the square. If it is a portrait, ensure the face/bust fills the ENTIRE square.
    - GOAL: Maximize the number of pixels used by the subject. Background space is wasted pixels.
    
    STYLE CONSTRAINTS:
    - ASPECT RATIO: 1:1 SQUARE.
    - STYLE: Flat colors, hard edges, NO gradients, NO blurring.
    - PALETTE: Use a LIMITED PALETTE of approximately ${maxColors} distinct colors.
    - SHAPES: Simplify details into clear "zones" of color.
    - ${bgInstruction}
    
    Output a high-quality, clean image that looks like it has been cropped specifically for a game icon or sprite.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [...referenceParts, ...targetPart, { text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });

    let rawBase64 = null;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        rawBase64 = part.inlineData.data;
        break;
      }
    }

    if (!rawBase64) throw new Error("No image data found in response.");
    return rawBase64;
  } catch (error: any) {
    console.error("Gemini API Error (Draft):", error);
    throw new Error(error.message || "Failed to generate draft.");
  }
};

// STEP 2: Process Draft into Blueprint (Grid + Quantization)
export const reprocessPixelArt = async (
  rawBase64: string, 
  resolution: number, 
  maxColors: number
): Promise<GenerationResult> => {
  const result = await enforcePixelGrid(rawBase64, resolution, maxColors);
  return { ...result, rawBase64 };
};

// Deprecated single-step function, but kept for compatibility if needed, 
// though UI will switch to 2-step.
export const generatePixelArtRefactor = async (
  referenceImages: UploadedImage[],
  targetImage: UploadedImage,
  resolution: number,
  removeBackground: boolean,
  userPrompt: string = "",
  maxColors: number = 32
): Promise<GenerationResult> => {
  const rawBase64 = await generateCharacterDraft(referenceImages, targetImage, removeBackground, userPrompt, maxColors);
  return await reprocessPixelArt(rawBase64, resolution, maxColors);
};

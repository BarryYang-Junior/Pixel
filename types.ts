export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface PixelArtConfig {
  resolutionStr: string; // e.g., "64x64"
}

export interface PaletteItem {
  id: number;
  r: number;
  g: number;
  b: number;
  hex: string;
  count: number;
  textColor: string;
}

export interface GenerationResult {
  imageUrl: string;
  palette: PaletteItem[];
  resolution: number;
  rawBase64?: string;
}
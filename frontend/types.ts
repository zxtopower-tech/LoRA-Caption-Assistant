
export enum GenerationStatus {
  IDLE = 'idle',
  GENERATING = 'generating',
  CHECKING = 'checking',
  SUCCESS = 'success',
  ERROR = 'error',
}

export type ApiProvider = 'gemini' | 'openaiCompatible';

export type QueueRequest =
  | { type: 'generate'; id: string; customInstructions?: string }
  | { type: 'quality'; id: string }
  | { type: 'segmentedAnalysis'; id: string };

/**
 * Represents a batch of queue items currently being processed
 */
export interface ProcessingBatch {
  /** The requests in this batch */
  requests: QueueRequest[];
  /** Timestamp when batch processing started */
  startedAt: number;
  /** IDs of items in this batch (for quick lookup) */
  requestIds: Set<string>;
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  sizeBytes?: number;
  durationSec?: number;
  fps?: number;
  frameCount?: number;
}

export type MetadataStatus = 'idle' | 'loading' | 'done' | 'error';

export interface ProfileGlobalSettings {
  provider: ApiProvider;
  gemini: {
    apiKey: string;
  };
  openaiCompatible: {
    endpoint: string;
    model: string;
    apiKey: string;
    videoFrameCount: number;
  };
  general: {
    triggerWord: string;
    datasetPrefix: string;
    characterTaggingEnabled: boolean;
    characterShowName: string;
  };
  instructions: {
    bulkGeneration: string;
    bulkRefinement: string;
  };
  queue: {
    enabled: boolean;
    rpmLimit: number;
    batchSize: number;
  };
  ui: {
    autofitTextareas: boolean;
    collapsedSections?: {
      userProfile?: boolean;
      globalSettings?: boolean;
      comfyUI?: boolean;
      segmentedAnalysis?: boolean;
    };
  };
  // ComfyUI Preview settings (also stored in extensions.comfy for compatibility)
  comfy?: ComfySettings;
  extensions?: Record<string, unknown>;
}

export interface ProfileFile {
  schemaVersion: number;
  savedAt: string;
  appVersion?: string;
  profileName: string;
  globalSettings: ProfileGlobalSettings;
}

export interface MediaFile {
  id: string;
  url: string;           // Backend static file URL
  name: string;          // Filename
  type: string;          // MIME type
  size: number;          // File size in bytes
  file?: File | null;    // Optional: Only fetch when needed (e.g., ComfyUI upload)
  /** @deprecated Use previewFile instead - will be removed in Phase 4 */
  comfyPreviewResult?: ComfyPreviewResult;
  /** @deprecated No longer needed for previewFile approach - will be removed in Phase 4 */
  comfyPreviewStatus?: ComfyPreviewStatus;
  /** @deprecated No longer needed for previewFile approach - will be removed in Phase 4 */
  comfyPreviewError?: string;
  /** @deprecated No longer needed for previewFile approach - will be removed in Phase 4 */
  comfyGeneratingPromptId?: string;
  previewFile?: File;
  originalUrl?: string; // Blob URL for original file (separate from previewUrl for ZIP uploads)
  previewUrl: string;
  caption: string;       // Current caption value
  initialCaption: string; // Initial caption value for change detection
  status: GenerationStatus;
  errorMessage?: string;
  isSelected: boolean;
  customInstructions: string;
  qualityScore?: number;
  metadata?: MediaMetadata;
  metadataStatus?: MetadataStatus;
  metadataError?: string;
  // Segmented analysis
  segmentedAnalysis?: SegmentedAnalysisResult;
}

export type SegmentStep = 'background' | 'costume' | 'pose' | 'bodyType';
export type PostProcessStep = 'integration' | 'review' | 'refine';

export type StepStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'error';

export interface SegmentStepResult {
  status: StepStatus;
  result?: string;
  error?: string;
  timestamp?: number;
}

export interface SegmentedAnalysisResult {
  enabled: boolean;
  steps: {
    segments: Record<SegmentStep, SegmentStepResult>;
    postProcessing: Record<PostProcessStep, SegmentStepResult>;
  };
  finalCaption?: string;
  startedAt?: number;
  completedAt?: number;
  currentStep?: string;
}

export interface SegmentStepConfig {
  enabled: boolean;
  expanded: boolean;
  systemPrompt: string;
  temperature: number;
}

export interface PostProcessStepConfig {
  enabled: boolean;
  expanded: boolean;
  prompt: string;
}

export interface SegmentedAnalysisConfig {
  enabled: boolean;
  segments: {
    background: SegmentStepConfig;
    costume: SegmentStepConfig;
    pose: SegmentStepConfig;
    bodyType: SegmentStepConfig;
  };
  postProcessing: {
    integration: PostProcessStepConfig;
    review: PostProcessStepConfig;
    refine: PostProcessStepConfig;
  };
}

// === ComfyUI Preview Types ===

/** @deprecated Use previewFile instead - will be removed in Phase 4 */
export type ComfyPreviewStatus = 'idle' | 'pending' | 'generating' | 'completed' | 'error';

/** @deprecated Use previewFile instead - will be removed in Phase 4 */
export interface ComfyPreviewResult {
  promptId: string;          // ComfyUI job ID
  filename: string;          // Generated image file name
  subfolder?: string;
  type?: string;
  blobUrl: string;           // Blob URL generated after download
  completedAt: number;
  seed?: number;
}

export interface ComfySettings {
  serverUrl: string;         // ComfyUI Server URL (e.g. "http://192.168.10.3:8188")
  workflowId: string;        // Selected workflow filename
  seed: number;              // Seed (-1: Random)
  steps: number;             // Number of steps
}

export type ComfyWorkflowMode = 'single' | 'multi_steps' | 'full_multi';

export interface ComfyPreviewParams {
  seed?: number;
  steps?: number;
  stepsMin?: number;
  stepsMax?: number;
  seedLow?: number;
  seedHigh?: number;
}

export interface ComfyQueueStatus {
  queue_running: unknown[];
  queue_pending: unknown[];
}

export interface WorkflowInfo {
  filename: string;
  size: number;
  modified: number;
}

// === Project Types ===

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectsListResponse {
  projects: ProjectMetadata[];
  count: number;
}

// === History Types ===

/**
 * File history entry from GET /api/projects/{id}/files/{filename}/history
 * Response format: { "versions": FileHistoryEntry[] }
 */
export interface FileHistoryEntry {
  timestamp: string;  // Version timestamp (e.g., "20241226_123045_123456")
  size: number;       // File size in bytes
  modified: number;   // Unix timestamp (seconds since epoch)
}

/**
 * Media item history entry from GET /api/projects/{id}/items/{itemId}/history
 * Each entry represents a single file version (original, caption, or preview)
 */
export interface MediaItemHistoryEntry {
  timestamp: string;
  extension: string;           // File extension (e.g., .jpg, .txt, .png)
  size: number;
  modified: number;            // Unix timestamp (seconds)
  is_available: boolean;
  content_preview?: string;    // Caption content preview (only for caption subtype)
  thumbnail_url?: string;      // Thumbnail URL for this version (only for original/preview)
  subtype: 'original' | 'caption' | 'preview';
}

import type { SegmentStep, PostProcessStep, SegmentedAnalysisConfig, SegmentedAnalysisResult } from '../types';

interface SegmentPrompt {
  system_prompt: string;
  temperature: number;
}

// Prompt file paths (for fallback)
const PROMPT_FILE_BASE = '/_api-test';

// In-memory cache for prompts
const promptCache = new Map<string, string | SegmentPrompt>();

// Segment prompt filenames
const SEGMENT_FILENAMES: Record<SegmentStep, string> = {
  background: '01_background.json',
  costume: '02_costume.json',
  pose: '03_pose.json',
  bodyType: '04_body_type.json',
};

// Post-processing prompt filenames
const POST_PROCESS_FILENAMES: Record<PostProcessStep, string> = {
  integration: 'prompt_integrator.txt',
  review: 'prompt_reviewer.txt',
  refine: 'prompt_refiner.txt',
};

/**
 * Get segment prompt from config (new approach)
 */
export function getSegmentPrompt(step: SegmentStep, config: SegmentedAnalysisConfig): SegmentPrompt {
  return {
    system_prompt: config.segments[step].systemPrompt,
    temperature: config.segments[step].temperature,
  };
}

/**
 * Get post-processing prompt from config (new approach)
 */
export function getPostProcessPrompt(step: PostProcessStep, config: SegmentedAnalysisConfig): string {
  return config.postProcessing[step].prompt;
}

/**
 * Load segment prompt from JSON file (fallback for backward compatibility)
 */
export async function loadSegmentPrompt(step: SegmentStep): Promise<SegmentPrompt> {
  const cacheKey = `segment_${step}`;
  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey) as SegmentPrompt;
  }

  const filename = SEGMENT_FILENAMES[step];

  try {
    const response = await fetch(`${PROMPT_FILE_BASE}/segment-prompts/${filename}`);
    if (!response.ok) throw new Error(`Failed to load ${filename}`);
    const prompt = await response.json() as SegmentPrompt;
    promptCache.set(cacheKey, prompt);
    return prompt;
  } catch (error) {
    throw error;
  }
}

/**
 * Load post-processing prompt from TXT file (fallback for backward compatibility)
 */
export async function loadPostProcessingPrompt(step: PostProcessStep): Promise<string> {
  const cacheKey = `postprocess_${step}`;
  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey) as string;
  }

  const filename = POST_PROCESS_FILENAMES[step];

  try {
    const response = await fetch(`${PROMPT_FILE_BASE}/${filename}`);
    if (!response.ok) throw new Error(`Failed to load ${filename}`);
    const prompt = await response.text();
    promptCache.set(cacheKey, prompt);
    return prompt;
  } catch (error) {
    throw error;
  }
}

/**
 * Convert File to base64 (without data URI prefix)
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the data:image/...;base64, prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = error => reject(error);
  });
}

/**
 * Calculate total enabled steps based on config
 */
export function calculateTotalSteps(config: SegmentedAnalysisConfig): number {
  const segmentCount = Object.values(config.segments).filter(v => v.enabled).length;
  const postProcessCount = Object.values(config.postProcessing).filter(v => v.enabled).length;
  return segmentCount + postProcessCount;
}

/**
 * Initialize SegmentedAnalysisResult based on config
 */
export function initializeSegmentedAnalysis(config: SegmentedAnalysisConfig): SegmentedAnalysisResult {
  const steps: SegmentedAnalysisResult['steps'] = {
    segments: {
      background: { status: 'pending' },
      costume: { status: 'pending' },
      pose: { status: 'pending' },
      bodyType: { status: 'pending' },
    },
    postProcessing: {
      integration: { status: 'pending' },
      review: { status: 'pending' },
      refine: { status: 'pending' },
    },
  };

  // Disable steps based on config
  if (!config.segments.background.enabled) steps.segments.background.status = 'idle';
  if (!config.segments.costume.enabled) steps.segments.costume.status = 'idle';
  if (!config.segments.pose.enabled) steps.segments.pose.status = 'idle';
  if (!config.segments.bodyType.enabled) steps.segments.bodyType.status = 'idle';
  if (!config.postProcessing.integration.enabled) steps.postProcessing.integration.status = 'idle';
  if (!config.postProcessing.review.enabled) steps.postProcessing.review.status = 'idle';
  if (!config.postProcessing.refine.enabled) steps.postProcessing.refine.status = 'idle';

  return {
    enabled: config.enabled,
    steps,
    startedAt: Date.now(),
  };
}

/**
 * Build integration input from segment results
 */
export function buildIntegrationInput(segments: Record<string, string>): string {
  const segmentLabels: Record<string, string> = {
    background: 'Background',
    costume: 'Clothing',
    pose: 'Pose',
    bodyType: 'Body Type',
  };

  return Object.entries(segments)
    .map(([step, result]) => `**${segmentLabels[step]}:** ${result}`)
    .join('\n\n');
}

/**
 * Build review input
 */
export function buildReviewInput(integratedResult: string, segments: Record<string, string>): string {
  const segmentInput = buildIntegrationInput(segments);
  return `**Integrated Prompt:**\n${integratedResult}\n\n${segmentInput}`;
}

/**
 * Build refine input
 */
export function buildRefineInput(
  integratedResult: string,
  reviewResult: string,
  segments: Record<string, string>
): string {
  const segmentInput = buildIntegrationInput(segments);
  return `**Original Integrated Prompt:**\n${integratedResult}\n\n**Review JSON:**\n${reviewResult}\n\n${segmentInput}`;
}

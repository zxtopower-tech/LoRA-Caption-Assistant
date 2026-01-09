
/**
 * Service for interacting with OpenAI-compatible endpoints (Qwen-VL, etc.).
 * This supports OpenRouter, Ollama, vLLM, etc.
 */

import { DEFAULT_OPENAI_COMPATIBLE_MODEL } from '../constants';

// Constants
const VIDEO_TIMEOUT_MS = 60000;
const JPEG_QUALITY = 0.8;
const DEFAULT_MAX_TOKENS = 1000;
const DEFAULT_TEMPERATURE = 0.2;
const QUALITY_CHECK_MAX_TOKENS = 10;
const QUALITY_CHECK_MAX_FRAMES = 4;

// Utility functions
function normalizeEndpoint(baseUrl: string, path: string): string {
  let endpoint = baseUrl;
  if (!endpoint.includes(path)) {
    endpoint = endpoint.replace(/\/+$/, '') + path;
  }
  return endpoint;
}

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey && apiKey.trim() !== '') {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return headers;
}

function checkMixedContentError(endpoint: string): void {
  if (window.location.protocol === 'https:' && endpoint.includes('http://')) {
    throw new Error("Security Error: Mixed Content (HTTPS -> HTTP). Please use a tunnel.");
  }
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result); // This includes the data:image/png;base64, prefix
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = error => reject(error);
  });
};

const extractFramesFromVideo = async (videoFile: File, numberOfFrames: number): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    // Create URL but don't assign to src yet
    const url = URL.createObjectURL(videoFile);

    const frames: string[] = [];
    
    // Safety timeout to prevent hanging
    const timeout = setTimeout(() => {
        URL.revokeObjectURL(url);
        video.src = "";
        reject(new Error("Video processing timed out"));
    }, VIDEO_TIMEOUT_MS);

    // Using onloadeddata to ensure we can seek
    video.onloadeddata = async () => {
        const duration = video.duration;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            reject(new Error("Could not create canvas context"));
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Calculate sampling intervals (using midpoints for better coverage)
        const step = duration / numberOfFrames;
        
        try {
            for (let i = 0; i < numberOfFrames; i++) {
                // Calculate time for this frame
                const time = (step * i) + (step / 2);
                
                // Set up the listener BEFORE setting currentTime to avoid race conditions
                await new Promise<void>((frameResolve) => {
                    const onSeeked = () => {
                        video.removeEventListener('seeked', onSeeked);
                        frameResolve();
                    };
                    video.addEventListener('seeked', onSeeked);
                    video.currentTime = time;
                });
                
                // Draw frame to canvas
                ctx.drawImage(video, 0, 0);
                // Convert to base64 (JPEG quality)
                frames.push(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
            }
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            video.src = ""; // Cleanup
            resolve(frames);
        } catch (e) {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            reject(e);
        }
    };
    
    // FIX: Removed unused 'e' parameter to fix TS6133 build error
    video.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load video file"));
    };

    // Assign src AFTER setting up listeners
    video.src = url;
  });
};

const constructPrompt = (
    triggerWord: string, 
    customInstructions?: string,
    isCharacterTaggingEnabled?: boolean,
    characterShowName?: string
): string => {
  let basePrompt = `You are an expert captioner for AI model training data. Your task is to describe the provided image/video in detail for a style LoRA. Follow these rules strictly:
1. Start the caption with the trigger word: "${triggerWord}".
2. Describe EVERYTHING visible: characters, clothing, actions, background, objects, lighting, and camera angle.
3. Be objective and factual.
4. DO NOT mention the art style, "anime", "cartoon", "illustration", "2d", or "animation".
5. Write the description as a single, continuous paragraph.`;

  if (isCharacterTaggingEnabled && characterShowName && characterShowName.trim() !== '') {
    basePrompt += `\n6. After the description, identify any characters from the show "${characterShowName}" and append their tags to the very end of the caption, separated by commas. The format for each tag must be "char_[charactername]" (e.g., ", char_simon, char_kamina"). If no characters are recognized, add no tags.`;
  }

  if (customInstructions) {
    return `${basePrompt}\n\nIMPORTANT USER INSTRUCTIONS:\n${customInstructions}`;
  }
  return basePrompt;
};

export const generateCaptionOpenAICompatible = async (
  apiKey: string,
  baseUrl: string,
  model: string,
  file: File,
  triggerWord: string,
  customInstructions?: string,
  isCharacterTaggingEnabled?: boolean,
  characterShowName?: string,
  videoFrameCount: number = 8
): Promise<string> => {
  if (!baseUrl) throw new Error("Endpoint URL is required for the OpenAI-compatible API.");

  const endpoint = normalizeEndpoint(baseUrl, '/chat/completions');
  const prompt = constructPrompt(triggerWord, customInstructions, isCharacterTaggingEnabled, characterShowName);

  // Prepare message content (Text + Image(s))
  let contentParts: any[] = [
    { type: "text", text: prompt }
  ];

  if (file.type.startsWith('video/')) {
    try {
        const frames = await extractFramesFromVideo(file, videoFrameCount);
        if (frames.length === 0) throw new Error("No frames could be extracted from the video.");

        frames.forEach(frame => {
            contentParts.push({
                type: "image_url",
                image_url: { url: frame }
            });
        });
    } catch (e) {
        throw new Error("Failed to process video file. Ensure it is a supported format.");
    }
  } else {
    // Standard Image Handling
    const base64Image = await fileToBase64(file);
    contentParts.push({
        type: "image_url",
        image_url: { url: base64Image }
    });
  }

  const payload = {
    model: model || DEFAULT_OPENAI_COMPATIBLE_MODEL,
    messages: [
      {
        role: "user",
        content: contentParts
      }
    ],
    max_tokens: DEFAULT_MAX_TOKENS,
    temperature: DEFAULT_TEMPERATURE
  };

  const headers = buildHeaders(apiKey);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
      return content.trim();
    } else {
      throw new Error("No content returned from API.");
    }

  } catch (error) {
    if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        checkMixedContentError(endpoint);
        throw new Error("Security Error: The web app is running on HTTPS, but the endpoint uses HTTP (localhost). Browsers block this. Use a tunnel (Cloudflare/Ngrok) to get an HTTPS endpoint URL.");
    }

    if (error instanceof Error) throw error;
    throw new Error("Unknown error during OpenAI-compatible generation.");
  }
};

export const checkQualityOpenAICompatible = async (
  apiKey: string,
  baseUrl: string,
  model: string,
  file: File,
  caption: string,
  videoFrameCount: number = 8
): Promise<number> => {
  const endpoint = normalizeEndpoint(baseUrl, '/chat/completions');

  const prompt = `You are a quality assurance specialist. Evaluate the caption for the image/video.
Caption: "${caption}"

Criteria:
1. Accuracy
2. Completeness
3. Objectivity

Provide a single integer score from 1 to 5 (1=worst, 5=best).
IMPORTANT: Respond with ONLY the number.`;

  let contentParts: any[] = [
    { type: "text", text: prompt }
  ];

  if (file.type.startsWith('video/')) {
    try {
        const frames = await extractFramesFromVideo(file, Math.min(videoFrameCount, QUALITY_CHECK_MAX_FRAMES));
        frames.forEach(frame => {
            contentParts.push({
                type: "image_url",
                image_url: { url: frame }
            });
        });
    } catch (e) {
        throw new Error("Failed to process video for quality check.");
    }
  } else {
    const base64Image = await fileToBase64(file);
    contentParts.push({
        type: "image_url",
        image_url: { url: base64Image }
    });
  }

  const payload = {
    model: model || DEFAULT_OPENAI_COMPATIBLE_MODEL,
    messages: [
      {
        role: "user",
        content: contentParts
      }
    ],
    max_tokens: QUALITY_CHECK_MAX_TOKENS,
    temperature: 0.1
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey && apiKey.trim() !== '') {
      headers["Authorization"] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("Quality check failed API call");

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    
    const score = parseInt(text?.match(/\d+/)?.[0] || '0', 10);
    if (score >= 1 && score <= 5) return score;
    throw new Error(`Invalid score received: ${text}`);

  } catch (error) {
    if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        checkMixedContentError(endpoint);
    }
    throw new Error("Failed to check quality with the OpenAI-compatible API.");
  }
};

export interface OpenAIModel {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
}

export interface OpenAIModelsResponse {
  object: string;
  data: OpenAIModel[];
}

export const fetchOpenAIModels = async (
  baseUrl: string,
  apiKey?: string
): Promise<OpenAIModel[]> => {
  const endpoint = normalizeEndpoint(baseUrl, '/models');
  const headers = buildHeaders(apiKey);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }

    const data: OpenAIModelsResponse = await response.json();
    return data.data || [];
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
      checkMixedContentError(endpoint);
    }
    throw new Error(`Failed to fetch models: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export type EndpointStatus = 'idle' | 'checking' | 'success' | 'error';

export const checkEndpointStatus = async (
  baseUrl: string,
  apiKey?: string
): Promise<EndpointStatus> => {
  try {
    await fetchOpenAIModels(baseUrl, apiKey);
    return 'success';
  } catch {
    return 'error';
  }
};

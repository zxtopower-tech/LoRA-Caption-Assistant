import { useCallback, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { SegmentedAnalysisConfig, MediaFile, SegmentStep } from '../types';
import {
  getSegmentPrompt,
  getPostProcessPrompt,
  fileToBase64,
  initializeSegmentedAnalysis,
  buildIntegrationInput,
  buildReviewInput,
  buildRefineInput,
} from '../services/segmentedAnalysisService';

interface UseSegmentedAnalysisParams {
  mediaFiles: MediaFile[];
  config: SegmentedAnalysisConfig;
  apiProvider: 'gemini' | 'openaiCompatible';
  activeGeminiKey: string;
  openaiCompatibleApiKey: string;
  openaiCompatibleEndpoint: string;
  activeOpenAICompatibleModel: string;
  updateFile: (id: string, updates: Partial<MediaFile>) => void;
}

// Exponential retry with jitter
const withRetry = async <T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> => {
  let attempt = 0;
  while (true) {
    try {
      return await apiCall();
    } catch (error) {
      attempt++;
      if (
        error instanceof Error &&
        (error.message.includes('503') || error.message.toLowerCase().includes('overloaded')) &&
        attempt < maxRetries
      ) {
        const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
};

/**
 * Hook for executing segmented analysis workflow
 */
export const useSegmentedAnalysis = ({
  mediaFiles,
  config,
  apiProvider,
  activeGeminiKey,
  openaiCompatibleApiKey,
  openaiCompatibleEndpoint,
  activeOpenAICompatibleModel,
  updateFile,
}: UseSegmentedAnalysisParams) => {

  const processingRef = useRef<Set<string>>(new Set());

  /**
   * Execute single segment analysis with vision API
   */
  const executeSegment = useCallback(async (
    file: File,
    _step: SegmentStep,
    prompt: string,
    temperature: number
  ): Promise<string> => {
    const base64Image = await fileToBase64(file);

    if (apiProvider === 'gemini') {
      if (!activeGeminiKey) throw new Error('Gemini API Key missing');

      const ai = new GoogleGenAI({ apiKey: activeGeminiKey });
      const apiCall = () => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: file.type, data: base64Image } },
            { text: prompt }
          ]
        },
        config: {
          temperature,
          maxOutputTokens: 1000,
        },
      });

      const response = await withRetry(apiCall);
      if (response.text) {
        return response.text.trim();
      }
      throw new Error('Empty response from Gemini');

    } else {
      // OpenAI Compatible
      const endpoint = openaiCompatibleEndpoint.replace(/\/+$/, '') + '/chat/completions';
      const model = activeOpenAICompatibleModel || 'Qwen/Qwen2.5-VL-7B-Instruct';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (openaiCompatibleApiKey) {
        headers['Authorization'] = `Bearer ${openaiCompatibleApiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64Image}` } },
                { type: 'text', text: prompt },
              ],
            },
          ],
          temperature,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('No content returned from API');
      return content.trim();
    }
  }, [
    apiProvider,
    activeGeminiKey,
    openaiCompatibleApiKey,
    openaiCompatibleEndpoint,
    activeOpenAICompatibleModel,
  ]);

  /**
   * Execute post-processing step (text-only)
   */
  const executePostProcessing = useCallback(async (
    input: string,
    prompt: string
  ): Promise<string> => {
    if (apiProvider === 'gemini') {
      if (!activeGeminiKey) throw new Error('Gemini API Key missing');

      const ai = new GoogleGenAI({ apiKey: activeGeminiKey });
      const apiCall = () => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          role: 'user',
          parts: [{ text: `${prompt}\n\n${input}` }],
        },
        config: { maxOutputTokens: 2000 },
      });

      const response = await withRetry(apiCall);
      if (response.text) {
        return response.text.trim();
      }
      throw new Error('Empty response from Gemini');

    } else {
      const endpoint = openaiCompatibleEndpoint.replace(/\/+$/, '') + '/chat/completions';
      const model = activeOpenAICompatibleModel || 'Qwen/Qwen2.5-VL-7B-Instruct';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (openaiCompatibleApiKey) {
        headers['Authorization'] = `Bearer ${openaiCompatibleApiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: input },
          ],
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('No content returned from API');
      return content.trim();
    }
  }, [
    apiProvider,
    activeGeminiKey,
    openaiCompatibleApiKey,
    openaiCompatibleEndpoint,
    activeOpenAICompatibleModel,
  ]);

  /**
   * Main execution function for segmented analysis
   */
  const executeSegmentedAnalysis = useCallback(async (id: string) => {
    const file = mediaFiles.find(mf => mf.id === id);
    if (!file || !config.enabled) return;

    // Prevent duplicate processing
    if (processingRef.current.has(id)) return;
    processingRef.current.add(id);

    // Initialize result
    const result = initializeSegmentedAnalysis(config);
    updateFile(id, {
      segmentedAnalysis: result,
      status: 'generating' as any,
      errorMessage: undefined,
    });

    const apiKey = apiProvider === 'gemini' ? activeGeminiKey : openaiCompatibleApiKey;

    if (!apiKey) {
      updateFile(id, {
        status: 'error' as any,
        errorMessage: 'API Key missing',
      });
      processingRef.current.delete(id);
      return;
    }

    const segmentResults: Record<string, string> = {};
    let currentResult = { ...result };

    try {
      // Step 1: Execute enabled segments in parallel
      const activeSegments = Object.entries(config.segments)
        .filter(([_, enabled]) => enabled)
        .map(([step, _]) => step as SegmentStep);

      if (activeSegments.length === 0) {
        throw new Error('No segments enabled in configuration');
      }

      const segmentPromises = activeSegments.map(async (step) => {
        try {
          updateFile(id, {
            segmentedAnalysis: {
              ...currentResult,
              currentStep: `Analyzing ${step}...`,
            },
          });

          // Use prompts from config instead of loading from files
          const promptData = getSegmentPrompt(step, config);

          // For now, file is required for segmented analysis
          // In Phase 2, this will be updated to fetch the file when needed
          if (!file.file) {
            segmentResults[step] = 'Error: File not available';
            return;
          }

          const analysisResult = await executeSegment(file.file, step, promptData.system_prompt, promptData.temperature);

          segmentResults[step] = analysisResult;

          currentResult = { ...currentResult };
          (currentResult.steps.segments as Record<SegmentStep, any>)[step] = {
            status: 'completed',
            result: analysisResult,
            timestamp: Date.now(),
          };
          updateFile(id, { segmentedAnalysis: currentResult });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          currentResult = { ...currentResult };
          (currentResult.steps.segments as Record<SegmentStep, any>)[step] = {
            status: 'error',
            error: errorMessage,
            timestamp: Date.now(),
          };
          updateFile(id, { segmentedAnalysis: currentResult });
        }
      });

      await Promise.allSettled(segmentPromises);

      // Check if we have any successful results
      const successfulSegments = Object.entries(segmentResults).filter(([_, result]) => result);
      if (successfulSegments.length === 0) {
        throw new Error('All segment analyses failed');
      }

      // Step 2: Integration
      if (config.postProcessing.integration) {
        updateFile(id, {
          segmentedAnalysis: {
            ...currentResult,
            currentStep: 'Integrating segments...',
          },
        });

        // Use prompts from config instead of loading from files
        const integratorPrompt = getPostProcessPrompt('integration', config);
        const segmentInput = buildIntegrationInput(segmentResults);

        const integratedResult = await executePostProcessing(segmentInput, integratorPrompt);

        currentResult.steps.postProcessing.integration = {
          status: 'completed',
          result: integratedResult,
          timestamp: Date.now(),
        };
        let finalCaption = integratedResult;

        // Step 3: Review
        if (config.postProcessing.review) {
          updateFile(id, {
            segmentedAnalysis: {
              ...currentResult,
              currentStep: 'Reviewing quality...',
            },
          });

          const reviewerPrompt = getPostProcessPrompt('review', config);
          const reviewInput = buildReviewInput(integratedResult, segmentResults);

          const reviewResult = await executePostProcessing(reviewInput, reviewerPrompt);

          currentResult.steps.postProcessing.review = {
            status: 'completed',
            result: reviewResult,
            timestamp: Date.now(),
          };

          // Step 4: Refine
          if (config.postProcessing.refine) {
            updateFile(id, {
              segmentedAnalysis: {
                ...currentResult,
                currentStep: 'Refining caption...',
              },
            });

            const refinerPrompt = getPostProcessPrompt('refine', config);
            const refineInput = buildRefineInput(integratedResult, reviewResult, segmentResults);

            const refinedResult = await executePostProcessing(refineInput, refinerPrompt);

            currentResult.steps.postProcessing.refine = {
              status: 'completed',
              result: refinedResult,
              timestamp: Date.now(),
            };
            finalCaption = refinedResult;
          }
        }

        currentResult.finalCaption = finalCaption;
        updateFile(id, {
          segmentedAnalysis: {
            ...currentResult,
            completedAt: Date.now(),
            currentStep: undefined,
          },
          caption: finalCaption,
          status: 'success' as any,
        });
      } else {
        // No post-processing, use concatenated segment results
        const fallbackCaption = successfulSegments.map(([_, result]) => result).join(' ');
        currentResult.finalCaption = fallbackCaption;
        updateFile(id, {
          segmentedAnalysis: {
            ...currentResult,
            completedAt: Date.now(),
            currentStep: undefined,
          },
          caption: fallbackCaption,
          status: 'success' as any,
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateFile(id, {
        segmentedAnalysis: {
          ...currentResult,
          completedAt: Date.now(),
          currentStep: undefined,
        },
        status: 'error' as any,
        errorMessage: `Segmented analysis failed: ${errorMessage}`,
      });
    } finally {
      processingRef.current.delete(id);
    }
  }, [
    mediaFiles,
    config,
    apiProvider,
    activeGeminiKey,
    openaiCompatibleApiKey,
    openaiCompatibleEndpoint,
    activeOpenAICompatibleModel,
    updateFile,
    executeSegment,
    executePostProcessing,
  ]);

  return { executeSegmentedAnalysis };
};

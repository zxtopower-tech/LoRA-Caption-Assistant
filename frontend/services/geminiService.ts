
// FIX: Imported `GenerateContentResponse` to correctly type the Gemini API response,
// which resolves errors where response properties were not recognized by the type checker.
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

/**
 * A utility function to retry an async operation with exponential backoff.
 * @param apiCall The async function to call.
 * @param maxRetries The maximum number of retries.
 * @param initialDelay The initial delay in milliseconds.
 * @returns A promise that resolves with the result of the apiCall.
 */
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
      // Check if the error is a 503 "overloaded" error and we haven't exceeded retries.
      if (
        error instanceof Error &&
        (error.message.includes("503") || error.message.toLowerCase().includes("overloaded")) &&
        attempt < maxRetries
      ) {
        // Calculate delay with exponential backoff and jitter
        const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // If it's not a retryable error or max retries are reached, re-throw.
        throw error;
      }
    }
  }
};

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      }
    };
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const constructPrompt = (
    triggerWord: string, 
    customInstructions?: string,
    isCharacterTaggingEnabled?: boolean,
    characterShowName?: string
): string => {
  let basePrompt = `You are an expert captioner for AI model training data. Your task is to describe the provided image/video in detail for a style LoRA. Follow these rules strictly:
1. Start the caption with the trigger word: "${triggerWord}".
2. Describe EVERYTHING visible: characters, clothing, actions, background, objects, lighting, and camera angle (e.g., medium shot, close-up, overhead view).
3. Be objective and factual.
4. DO NOT mention the art style, "anime", "cartoon", "illustration", "2d", or "animation". The style should be learned implicitly by the model.
5. Write the description as a single, continuous paragraph.`;

  if (isCharacterTaggingEnabled && characterShowName && characterShowName.trim() !== '') {
    basePrompt += `\n6. After the description, identify any characters from the show "${characterShowName}" and append their tags to the very end of the caption, separated by commas. The format for each tag must be "char_[charactername]" (e.g., ", char_simon, char_kamina"). If no characters are recognized, add no tags.`;
  }

  if (customInstructions) {
    return `${basePrompt}\n\nAdditional user instructions: ${customInstructions}`;
  }
  return basePrompt;
};

export const generateCaption = async (
  apiKey: string,
  file: File,
  triggerWord: string,
  customInstructions?: string,
  isCharacterTaggingEnabled?: boolean,
  characterShowName?: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key not provided.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const imagePart = await fileToGenerativePart(file);
    const prompt = constructPrompt(triggerWord, customInstructions, isCharacterTaggingEnabled, characterShowName);

    // Using gemini-2.5-flash as it is the current standard recommendation for general multimodal tasks.
    const apiCall = () => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, { text: prompt }] },
    });

    // FIX: Explicitly typed the `response` variable to ensure its properties are correctly inferred.
    const response: GenerateContentResponse = await withRetry(apiCall);

    if (response.text) {
      return response.text.trim();
    }

    let errorMessage = "Failed to generate caption. The response was empty.";
    if (response.promptFeedback?.blockReason) {
        errorMessage += ` Reason: ${response.promptFeedback.blockReason}.`;
    } else {
        errorMessage += " This might be due to safety settings or content filters. Check the console for more details.";
        console.error("Gemini response missing text:", response);
    }
    throw new Error(errorMessage);

  } catch (error) {
    console.error("Error generating caption with Gemini:", error);
    if (error instanceof Error) {
        throw error;
    }
    throw new Error("An unknown error occurred while generating the caption.");
  }
};

export const checkCaptionQuality = async (
  apiKey: string,
  file: File,
  caption: string,
): Promise<number> => {
  if (!apiKey) {
    throw new Error("API Key not provided.");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  const imagePart = await fileToGenerativePart(file);

  const prompt = `You are a quality assurance specialist for AI model training data. Your task is to evaluate the provided caption for the given image/video.
**Caption to evaluate:** "${caption}"

**Evaluation Criteria:**
1. **Accuracy:** Does the caption accurately describe the content of the media?
2. **Completeness:** Does it cover all significant details (characters, actions, background, objects, etc.)?
3. **Objectivity:** Is the description factual and free of subjective interpretation or mention of art style?

Based on these criteria, provide a single integer score from 1 to 5, where 1 is the worst and 5 is the best.
**IMPORTANT: Respond with ONLY the number (e.g., "4") and absolutely nothing else.**`;

  try {
    const apiCall = () => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, { text: prompt }] },
    });
    
    // FIX: Explicitly typed the `response` variable to ensure its properties are correctly inferred.
    const response: GenerateContentResponse = await withRetry(apiCall);
    
    if (response.text) {
        const text = response.text.trim();
        const score = parseInt(text.match(/\d+/)?.[0] || '0', 10);
        if (score >= 1 && score <= 5) {
            return score;
        }
    }
    // Handle cases where parsing fails or response is empty
    let errorMessage = "Failed to parse quality score from response.";
    if (!response.text) {
        errorMessage = "Failed to get quality score. The response was empty.";
        if (response.promptFeedback?.blockReason) {
            errorMessage += ` Reason: ${response.promptFeedback.blockReason}.`;
        }
    } else {
        errorMessage += ` Got: "${response.text}"`;
    }
    throw new Error(errorMessage);

  } catch (error) {
    console.error("Error checking caption quality with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Quality check failed: ${error.message}`);
    }
    throw new Error("An unknown error occurred during quality check.");
  }
};

import type { SegmentedAnalysisConfig } from './types';

// export const DEFAULT_BULK_INSTRUCTIONS = `Dont use ambiguous language "perhaps" for example. Also dont mention the character's name beyond the character tag at the end of the prompt. So don't say "raven with her cloak" but rather say "a woman with her cloak" for example etc. Refrain from using phrases like "character, female, male, figure of" etc just stick with consistent terminology: "woman, girl, boy, man" etc. Also do not caption any of the clothing in the image.`;
export const DEFAULT_BULK_INSTRUCTIONS = `You are an expert image caption generator for LoRA training. Your task is to create a detailed, objective, and literal caption.

--- Critical Guidelines ---

1. Caption Structure:
Your caption MUST follow this exact order step-by-step:
1.  Subject(s): State the number of people and their general description (e.g., A woman, Three men).
2.  Detailed Physical Description: Describe each subject's appearance. Include skin tone (e.g., pale skin, tan skin, dark brown skin), hair style and color, physique (e.g., slim/slender/curvaceous/muscular/curvy/plump), and breast size (e.g., small breasts, large breasts) when applicable and visible.
3.  Clothing & Accessories: Detail all clothing, accessories, and jewelry for each subject.
4.  Pose & Action: Describe each subject's exact pose, posture, and any specific actions. Be precise about the position of hands and limbs.
5.  Background & Setting: Describe the environment, lighting, and any other objects in the scene.

2. Handling Multiple People:
* Start by stating the number of subjects (e.g., "Three women.").
* Use positional language to describe each person systematically (e.g., "The woman on the left...", "The man in the center...", "In the foreground, a child...").
* Apply the full descriptive structure (Physical Description, Clothing, Pose) to every clearly visible person in the image.
* For subjects in the distant background or significantly out of focus, a briefer description is acceptable.

3. Be Objective and Concrete:
Your goal is to describe the image like a camera sees it.
* NO abstract language: Do not use interpretive or emotional words like "confident," "seductive," "beautifully," or "provocatively."
* NO manner adverbs: Do not use adverbs that describe how an action is performed, such as "gracefully," "confidently," "elegantly," "boldly," "seductively," "provocatively," or similar words ending in "-ly." Describe the physical pose and action directly instead.
* Focus on visual facts: Describe the scene, pose, and objects literally.
* Describe Skin Tone and Ethnicity:
    * Objectively describe visible skin color using neutral terms like \`pale skin\`, \`fair skin\`, \`olive skin\`, \`tan skin\`, \`brown skin\`, \`dark brown skin\`.
    * When the skin tone is ambiguous or unclear, default to \`fair skin\`.
    * If a subject's race or ethnicity is clearly identifiable from visual cues, state it (e.g., \`East Asian woman\`, \`Black man\`, \`White woman\`). If it is not clear, simply describe the physical features like skin tone and hair. Do not guess.
* Detail specific actions: Be precise about poses. For example, instead of "holding a cup," describe it as "her fingers are wrapped around a white coffee cup."

4. Final Rules:
* Combine all structural elements into a single, descriptive paragraph of complete, natural sentences.
* Do NOT include any trigger words as tags in your caption.

--- Examples ---

1: A woman's face. She has bright green eyes framed by long black eyelashes, smooth pale skin with faint freckles across her nose, and full lips. She is looking directly into the camera with a neutral expression. The background is completely out of focus, appearing as a soft, dark blur.

2: A man standing indoors. He has short, curly brown hair, a square jaw, light skin, and light stubble on his chin. He wears a grey hooded sweatshirt with the hood down and a silver stud earring in his left ear. His head is turned slightly to the right, looking off-camera. He is in front of a window with raindrops on the glass.

3: Two women seated at a table. The woman on the right is an East Asian woman with fair skin, shoulder-length black hair, a slender build, and small breasts; she wears a white silk blouse and pearl earrings, and her right hand is holding a wine glass. The woman on the left is a White woman with pale skin, blonde hair, and a black dress; she is smiling. They are at a restaurant with a white tablecloth and soft lighting.

4: A Korean woman standing on the beach. She has shoulder-length brown hair styled in loose waves, fair skin, a slender build, and small breasts. Her makeup consists of peachy-pink eyeshadow, vibrant coral blush on the cheeks, and bright coral-pink lipstick. She wears a white tube top that exposes her midriff, paired with red lace underwear. Her legs are clad in black fishnet stockings with lace trim at the thighs. Her right hand is gripping the edge of a metallic structure, while her left hand rests on her thigh. She is positioned with one leg bent and the other extended. The background shows a sandy beach with small pebbles, calm waves, and a wooden pier extending into the water. The sky is clear with a few clouds, and even natural daylight illuminates the scene.

5: A man standing in a garage. He has a bald head, a thick brown beard, tan skin, and a muscular build. He wears a black leather jacket, a red t-shirt, torn blue jeans, and brown combat boots. He is standing with his legs apart and his hands in his jacket pockets. The setting is an empty parking garage at night, with concrete pillars and fluorescent lights in the background.

6: Three men on a basketball court. In the center, a Black man with dark brown skin, short dreadlocks, and an athletic build wears a yellow basketball jersey, black shorts, and white sneakers; he is dribbling a basketball with his right hand. To his left, a Hispanic man with olive skin is in a defensive stance wearing a red shirt. To his right, a White man with fair skin and a blue shirt is running. A chain-link fence is visible in the background.

7: One Mongolian woman on a grassland. She has dark hair and fair skin. She wears a bright red robe with embroidered patterns, a wide sash at her waist, and a traditional hat with a headdress. She is balancing six porcelain bowls on top of her head with her arms held out to her sides in a dance pose. The background is a grassland with several yurts, and the scene is lit by sunlight.

8: Two people, a man and a woman, lying on a sofa. The man on the right has light skin and short brown hair; he wears a beige shirt and black suspenders, holding a lit cigarette and smiling at the camera. The woman on the left has light skin and blonde hair; she wears a blue plaid top with her leg draped over the man, and she is also smiling at the camera. The background is a wall with floral patterned wallpaper, and the sofa has brown and yellow cushions.

9: A woman. She has fair skin and her hair is tied in a high ponytail. She wears a white tennis outfit, a necklace, and earrings. She is leaning forward and swinging a tennis racket, which is making contact with a tennis ball. Her body is angled towards the front as she looks forward. The background is a blue backdrop with white letters printed on it.

10: A man. He has light skin and short blond hair. He wears a dark suit, a white shirt, and a red tie. His head is turned to the right side of the frame, his mouth is slightly open, and he is looking off-camera with a neutral expression. The lighting comes from the left side. The background is a red-and-white striped wall that is out of focus.
---
Now, analyze the following image and write a caption according to all the guidelines and examples above:
`

export const DEFAULT_OPENAI_COMPATIBLE_MODEL = 'Qwen/Qwen2.5-VL-7B-Instruct';

export const DEFAULT_SEGMENTED_ANALYSIS_CONFIG: SegmentedAnalysisConfig = {
  enabled: false,
  segments: {
    background: {
      enabled: true,
      expanded: false,
      systemPrompt: `# Background Analysis for AI Video Generation

You are an expert at analyzing images to extract background, environment, and atmospheric information for AI video generation.

## Output Requirements

1. **Format**: A single natural English sentence
2. **Length**: Maximum 300 characters
3. **Content**: Describe ONLY the background, environment, lighting, and atmosphere

## Core Principles

### 1. Describe Only Observable Background Facts
- Describe ONLY the background/environment visible in the image
- Do NOT describe the main subject (person, object, animal) - focus on surroundings
- Include: location, setting, background elements, lighting quality, color tone, shadows

### 2. Be Specific and Concrete
- Use EXACT color names (e.g., "navy blue," "emerald green," "crimson red")
- Use PRECISE lighting descriptions (e.g., "soft artificial light from above," "diffuse overcast illumination")
- Describe SPECIFIC background elements (walls, furniture, landscape, objects)

### 3. Avoid Abstract Adjectives
- Do NOT use: "beautiful," "wonderful," "amazing," "gorgeous," "stunning"
- Describe visual characteristics instead: lighting quality, color harmony, texture details

### 4. Eliminate Uncertain Language
- Do NOT use: "somewhat," "rather," "seems like," "appears to be," "possibly"
- Use DEFINITE statements based on direct observation

## Background Elements to Include

**Location/Setting**:
- Indoor: room type, walls, floor, furniture, props
- Outdoor: landscape, buildings, natural elements, weather conditions

**Lighting**:
- Source: natural (sunlight, moonlight) or artificial (lamps, overhead lights)
- Quality: soft, hard, diffuse, direct
- Direction: top, side, front, back, underlighting
- Time of day: sunrise, day, sunset, night, dawn, dusk

**Color Tone**:
- Warm (reds, oranges, yellows, golden tones)
- Cool (blues, greens, cyan, cold tones)
- Saturated or desaturated

**Shadows and Environmental Conditions**:
- Shadow quality (soft, hard, dappled, none)
- Brightness level (bright, dim, medium)
- Environmental elements (fog, mist, clear)

## Examples

**Indoor Example:**
"A blurred garage background with artificial lighting casting soft shadows and cool blue tones."

**Outdoor Example:**
"Vibrant green grass under diffuse overcast lighting with a balanced composition and cool color tone."

**Studio Example:**
"A plain light gray background under soft, even artificial lighting without casting harsh shadows."

## Critical Reminders

- Your output must be ONE complete sentence
- Maximum 300 characters
- English language only
- Describe ONLY background/environment (not the main subject)
- No abstract or uncertain language
- Use specific, concrete terminology

Analyze the image background and generate your description now.`,
      temperature: 0.95,
    },
    costume: {
      enabled: true,
      expanded: false,
      systemPrompt: `# Costume Analysis for AI Video Generation

You are an expert at analyzing images to extract clothing, accessories, and styling information for AI video generation.

## Output Requirements

1. **Format**: A single natural English sentence
2. **Length**: Maximum 300 characters
3. **Content**: Describe ONLY the clothing, accessories, colors, and materials

## Core Principles

### 1. Describe Only Observable Costume Facts
- Describe ONLY the clothing, accessories, and styling visible in the image
- Do NOT describe background, pose, or camera angle - focus entirely on attire
- Include: garments, accessories, colors, materials, textures, details

### 2. Be Specific and Concrete
- Use EXACT color names (e.g., "navy blue," "crimson red," "emerald green," "cream-colored")
- Use PRECISE clothing terminology (e.g., "high-collared sweater," "sleeveless bodysuit," "sheer lace")
- Describe SPECIFIC accessories (e.g., "metallic plate with spiral symbol," "silver sheriff badge")

### 3. Avoid Abstract Adjectives
- Do NOT use: "beautiful," "wonderful," "amazing," "gorgeous," "stylish"
- Describe visual characteristics: fabric texture, fit, color, design elements

### 4. Eliminate Uncertain Language
- Do NOT use: "somewhat," "rather," "seems like," "appears to be," "possibly"
- Use DEFINITE statements based on direct observation

## Costume Elements to Include

**Garments**:
- Tops: shirts, jackets, sweaters, vests, bodysuits, blouses
- Bottoms: pants, skirts, shorts, jeans
- Dresses: one-piece outfits, gowns
- Outerwear: coats, jackets, vests, hoodies

**Accessories**:
- Headwear: hats, headbands, ribbons, clips
- Jewelry: necklaces, earrings, badges, pins
- Others: belts, scarves, gloves, bags

**Colors**:
- Exact color names for each item
- Patterns (checkered, striped, solid, etc.)
- Multi-color descriptions

**Materials/Textures**:
- Fabric type: latex, leather, cotton, wool, lace, sheer, velvet
- Texture: shiny, matte, soft, rough, smooth, fluffy

**Details**:
- Fastenings: buttons, zippers, bows, ties
- Decorations: embroidery, prints, symbols, logos
- Fit: form-fitting, loose, tight, flowing

## Examples

**Character Costume Example:**
"A navy blue headband with a metallic plate featuring a spiral symbol, a gray high-collared sweater under a navy blue vest, and an orange jacket."

**Casual Costume Example:**
"A sleeveless gray top with simple clean lines."

**Fashion Costume Example:**
"A black sheer lace bodysuit with bow accents."

**Stylized Costume Example:**
"A shiny black latex jacket adorned with a silver sheriff badge."

## Critical Reminders

- Your output must be ONE complete sentence
- Maximum 300 characters
- English language only
- Describe ONLY clothing/accessories (not background, pose, or camera)
- No abstract or uncertain language
- Use specific, concrete terminology
- List multiple items in logical order (head to toe, or outer to inner)

Analyze the image costume and generate your description now.`,
      temperature: 0.95,
    },
    pose: {
      enabled: true,
      expanded: false,
      systemPrompt: `# Pose Analysis for AI Video Generation

You are an expert at analyzing images to extract body pose, hand gestures, and facial expressions for AI video generation.

## Output Requirements

1. **Format**: A single natural English sentence
2. **Length**: Maximum 300 characters
3. **Content**: Describe ONLY the body pose, hand gestures, and facial expressions

## Core Principles

### 1. Describe Only Observable Pose Facts
- Describe ONLY the body position, gestures, and expressions **clearly visible in the frame**
- Do NOT describe clothing, background, or camera angle - focus entirely on pose
- Include: body posture, **visible** arm/leg positions, hand gestures, facial expression
- **CRITICAL: Do NOT infer or describe the position of body parts that are cut off or not visible (e.g., legs in medium shots, full arm position in close-ups)**
- NO subjective terms: relaxed, confident, graceful, elegant, calm, tense, happy, sad, angry, cheerful

### 2. NEVER Use Posture Verbs for Hidden Body Parts
**CRITICAL: In medium shots or close-ups where legs/feet are NOT visible, NEVER use these verbs:**
- stands, standing, stood → Use: "positioned upright", "framed", "composed", "upper body visible"
- sits, sitting, sat → Use: "upper body positioned", "torso visible"
- lies, lying, lay → Use: "horizontal position", "body extended"

**CRITICAL: In close-ups where arms/hands are NOT fully visible, NEVER use:**
- "arms hanging by sides" → Use: "shoulders visible", "upper arms visible"
- "arms crossed" → Use ONLY if both forearms and hands are clearly visible
- Any full arm description when cut off by frame → DELETE or describe only visible portion

### 3. Be Specific and Concrete
- Use PRECISE pose terminology (e.g., "fingers crossed," "slightly parted lips," "hands on hips")
- Describe SPECIFIC body positions (leaning, crouching, reaching, crossing arms)
- Include exact hand gestures and finger positions

### 4. Avoid Abstract Adjectives
- Do NOT use: "elegant," "graceful," "powerful," "dynamic," "relaxed," "confident," "calm"
- Describe physical positions and movements objectively
- Use: "upright posture" not "confident stance"
- Use: "muscles loose" not "relaxed pose"
- Use: "mouth corners turned up" not "happy expression"

### 5. Eliminate Uncertain Language
- Do NOT use: "somewhat," "rather," "seems like," "appears to be," "possibly"
- Use DEFINITE statements based on direct observation

## Pose Elements to Include

**Body Posture**:
- Standing: straight, leaning, tilted, weight distribution
- Sitting: chair position, posture, leg position
- Lying: position, orientation
- Crouching/kneeling: body height, position

**Arm Positions**:
- By sides, crossed, on hips, raised, reaching
- Hand gestures: waving, pointing, holding objects, making shapes
- Finger positions: crossed, clenched, open, spread
- **CRITICAL: Only describe arm positions that are visible. Do NOT infer full arm position (e.g., "arms hanging by sides") if forearms or hands are cut off by the frame.**

**Leg Positions**:
- Standing straight, crossed, apart, bent
- Walking, running, jumping poses
- **CRITICAL: Only describe legs/feet if they are visible in the frame. Do NOT infer leg position in medium shots or close-ups where lower body is cut off.**

**Facial Expression**:
- Mouth: open, closed, smiling, parted lips, tongue visible
- Eyes: open, closed, looking direction, expression
- Overall: neutral, focused, alert, relaxed (observable states only)

**Head Position**:
- Tilted, straight, turned, looking up/down

## Examples

**Action Pose Example:**
"Forms hand seals with fingers crossed while sharp metallic shuriken fly through the air."

**Relaxed Pose Example:**
"Lies with belly on the ground, pink tongue sticking out and floppy ears."

**Full Body Pose Example (legs visible):**
"Stands with legs slightly apart and one hand on hip."
→ OK: legs ARE visible

**BAD Examples - Medium Shot (legs NOT visible):**
"Stands upright with hands on hips." → WRONG: "stands" assumes legs are visible
"Stands with one hand on her hip." → WRONG: "stands" assumes legs are visible

**CORRECTED Medium Shot Examples (upper body ONLY):**
"Upper body positioned upright with hands on hips."
"Holds her hair with both hands above head, slightly parted lips visible."
"Torso positioned upright with one hand on hip, eyes looking forward."

**BAD Example - Close-up (arms cut off):**
"Arms hang by her sides with a smile." → WRONG: arms are cut off by frame

**CORRECTED Close-up Example:**
"Smiles with shoulders visible and eyes looking forward."

**Expressive Pose Example:**
"Has slightly parted lips and eyes looking forward with head straight."

## Critical Reminders

- Your output must be ONE complete sentence
- Maximum 300 characters
- English language only
- Describe ONLY pose/expression (not clothing, background, or camera)
- No abstract or uncertain language
- Use specific, concrete terminology
- Focus on observable physical positions
- **CRITICAL: NEVER use "stands/sitting/lying" if legs are NOT visible in frame**
- **CRITICAL: NEVER describe full arm position "hanging by sides" if arms are cut off by frame**

Analyze the image pose and generate your description now.`,
      temperature: 0.95,
    },
    bodyType: {
      enabled: true,
      expanded: false,
      systemPrompt: `# Body Type Analysis for AI Video Generation

You are an expert at analyzing images to extract physical characteristics and body type information for AI video generation.

## Output Requirements

1. **Format**: A single natural English sentence
2. **Length**: Maximum 200 characters
3. **Content**: Describe ONLY the body type and physical characteristics

## Core Principles

### 1. Describe Only Observable Physical Facts
- Describe ONLY the body type and physical characteristics **clearly visible in the frame**
- Do NOT describe clothing, pose, or background - focus entirely on physical attributes
- Include: body build, **visible** proportions, distinctive features
- **Do NOT infer height, limb length, or body proportions that are not visible (e.g., "long legs" in medium shots, "tall" in close-ups)**

### 2. Be Specific and Concrete
- Use PRECISE physical descriptions (e.g., "slender build," "athletic frame," "average build")
- Describe SPECIFIC features (height indicators, body proportions, distinctive traits)

### 3. Avoid Abstract Adjectives
- Do NOT use: "beautiful," "perfect," "attractive," "gorgeous"
- Describe physical characteristics objectively

### 4. Eliminate Uncertain Language
- Do NOT use: "somewhat," "rather," "seems like," "appears to be," "possibly"
- Use DEFINITE statements based on direct observation

## Body Type Elements to Include

**General Build**:
- Slender, athletic, average, muscular, petite, tall, full-figured

**Height Indicators**:
- Young (child/teen): small stature, developing features
- Adult: average height, tall, short (based on proportions)

**Body Proportions**:
- Shoulder width relative to frame
- Hip-to-waist ratio
- Limb length proportions **ONLY if fully visible**
- **CRITICAL: Do NOT describe limb length (e.g., "long legs") if limbs are cut off by frame. Do NOT estimate overall height if full body is not visible.**

**Distinctive Features**:
- Freckles, visible muscles, body shape characteristics
- Hair: length, style, color (if visible)

**For Animals/Characters**:
- Breed characteristics
- Size categories (small, medium, large)
- Fur/coat descriptions

## Examples

**Human Example:**
"A young woman with long blonde hair and subtle freckles."

**Human Example:**
"A woman with dark hair tied back and visible muscular tone."

**Animal Example:**
"A fluffy golden retriever puppy with soft cream-colored fur and floppy ears."

**Character Example:**
"A character with spiky blond hair and medium athletic build."

**Generic Example:**
"A slender young woman with neat bun hairstyle."

## Critical Reminders

- Your output must be ONE complete sentence
- Maximum 200 characters
- English language only
- Describe ONLY body type/physical features (not clothing, pose, or background)
- No abstract or uncertain language
- Use specific, concrete terminology
- Focus on observable physical characteristics

Analyze the image body type and generate your description now.`,
      temperature: 0.3,
    },
  },
  postProcessing: {
    integration: {
      enabled: true,
      expanded: false,
      prompt: `# Video Prompt Integrator

You are an expert at synthesizing multiple image analysis segments into a single, cohesive prompt for AI video generation models.

CRITICAL: You must produce output with ZERO subjective language.

## Output Validation Checklist

Before finalizing your answer, CHECK that your output contains NONE of these words:
- Gracefully, confidently, elegantly, calmly, serenely, proudly, boldly, gently, softly, naturally, comfortably, happily, sadly, angrily, cheerfully, peacefully
- Beautiful, gorgeous, stunning, amazing, wonderful, lovely, elegant, graceful, poised, serene, peaceful, tranquil, calm, charming, enchanting, captivating, confident, proud, bold, dramatic, intense, happy, sad, angry, cheerful, relaxed, tense, nervous, tranquil, lively
- ANY word ending in -ly that describes manner (gracefully, confidently, etc.)

If ANY of these words appear in your output, DELETE THEM entirely:
- "comfortably" → DELETE
- "naturally" → DELETE
- "tranquil/peaceful/serene/calm" → DELETE
- "lively/energetic" → DELETE
- Do NOT add alternative descriptions that may introduce body parts not visible in the original image

RE-READ your output and remove ALL subjective language before finalizing.

## Step 1: Filter Input Segments

Before integrating, REMOVE these types of words from input segments:

**Adverbs to Remove:**
- Gracefully, confidently, elegantly, calmly, serenely, proudly, boldly, gently, softly, tenderly, fiercely, happily, sadly, angrily, quietly, loudly

**Adjectives to Remove:**
- Beautiful, gorgeous, stunning, amazing, wonderful, lovely, elegant, graceful, poised, serene, peaceful, tranquil, calm, charming, enchanting, captivating, alluring, confident, proud, bold, dramatic, intense, happy, sad, angry, cheerful, relaxed, tense, nervous

**Replace With:**
- DELETE entirely - do NOT add alternative descriptions that may introduce body parts not visible in the original image

ONLY AFTER filtering, proceed to integrate the cleaned information.

## Task

You will receive analysis results from FOUR separate specialized segments:
1. **Pose**: Body position, hand gestures, facial expressions
2. **Body Type**: Physical characteristics, body build, proportions, skin tone
3. **Clothing**: Outfit, accessories, footwear
4. **Environment**: Background, lighting, atmosphere

Your task is to integrate ALL information from these segments into a single, natural-flowing description.

## Output Requirements

1. **Format**: 2-5 complete sentences forming a natural description
2. **Length**: Typically 60-150 words
3. **Language**: English only
4. **Style**: Natural narrative flow, not formulaic or list-like

## Integration Guidelines

### 1. Combine All Elements
Include EVERY piece of information from the input segments:
- Pose: body position, gestures, expressions
- Body Type: build, proportions, skin tone, bust size (for women)
- Clothing: outfit, ALL accessories, footwear
- Environment: background, lighting, atmosphere

### 2. Create Natural Flow
- Do NOT simply list elements
- Weave information into coherent sentences
- Use appropriate transitions between elements
- Avoid repetitive phrasing

### 3. Maintain Accuracy
- Do NOT add information not present in the input segments
- Do NOT omit any information from the input segments
- Keep exact color names from input
- Keep specific measurements from input

### 4. Use Only Observable Language (CRITICAL)
- NO subjective adverbs: gracefully, confidently, elegantly, calmly, serenely, proudly, boldly, gently, softly, tenderly, fiercely
- NO abstract adjectives: beautiful, gorgeous, stunning, elegant, graceful, poised, serene, peaceful, tranquil, calm, charming, enchanting, confident, proud, bold, dramatic, intense
- NEVER use these words even if they appear in input segments - translate to observable facts instead

### 5. Recommended Structure (flexible)

**Option A: Subject-First**
[Subject with body type + skin tone] + [Clothing + accessories + footwear] + [Pose/Action] + [Environment + lighting + atmosphere]

**Option B: Context-First**
[Environment/Location] + [Subject with body type] + [Clothing] + [Pose] + [Lighting + atmosphere]

### 6. Integration Examples

**Input Segments:**
- Pose: "Stands with legs slightly apart, left hand on hip, right hand touching hair."
- Body Type: "A slender woman with fair skin, large bust, narrow waist."
- Clothing: "Sheer black lace bodysuit with bow accents, high-heeled black shoes."
- Environment: "Curved wooden partition, soft warm lighting, intimate atmosphere."

**Integrated Output:**
"A slender woman with fair skin stands confidently, her figure accentuated by a sheer black lace bodysuit with bow accents. Her large bust and narrow waist create an elegant silhouette as she poses with legs slightly apart, one hand resting on her hip while the other gently touches her hair. High-heeled black shoes complete her ensemble against a curved wooden partition, where soft warm lighting casts gentle shadows and creates an intimate atmosphere."

## Critical Reminders

- Include ALL information from ALL segments
- Create natural, flowing sentences (not lists)
- Use specific colors and details from input
- Do NOT add speculative details
- 2-5 sentences total

## Language Filter - AVOID These Expressions

### Subjective/Abstract Adverbs (DO NOT USE)
- Gracefully, confidently, elegantly, calmly, peacefully, serenely
- Proudly, boldly, shyly, nervously, anxiously
- Gently, softly, tenderly, lovingly, fiercely
- Majestically, dramatically, dynamically, playfully

### Abstract/Subjective Adjectives (DO NOT USE)
- Beautiful, gorgeous, stunning, amazing, wonderful, lovely
- Elegant, graceful, poised, majestic, regal
- Serene, peaceful, tranquil, calm (unless describing observable stillness)
- Confident, proud, bold (unless describing observable posture)
- Charming, enchanting, captivating, alluring
- Dramatic, intense (unless describing technical contrast)

Now, integrate the provided segment analyses into a single cohesive description.`,
    },
    review: {
      enabled: true,
      expanded: false,
      prompt: `# Prompt Reviewer for Segmented Analysis

You are an expert at evaluating integrated prompts for AI video generation against the original segment analyses.

Your task is to review an integrated prompt by comparing it against the four original segment analyses and provide objective scoring and feedback.

## CRITICAL: JSON Output ONLY

You must output ONLY valid JSON. No explanations, no markdown formatting, no additional text.

Output format:
\`\`\`json
{
  "scores": {
    "pose": {
      "score": 8,
      "coverage_checklist": {
        "body_posture": "PRESENT: standing with legs apart",
        "hand_gestures": "PRESENT: left hand on hip",
        "facial_expressions": "MISSING: no facial expression described"
      },
      "missing_items": ["facial expression details"]
    },
    "body_type": {
      "score": 10,
      "coverage_checklist": {
        "build": "PRESENT: slender woman",
        "skin_tone": "PRESENT: fair skin",
        "proportions": "PRESENT: large bust, narrow waist"
      },
      "missing_items": []
    },
    "clothing": {
      "score": 7,
      "coverage_checklist": {
        "outfit": "PRESENT: sheer black lace bodysuit with bow accents",
        "accessories": "PARTIAL: bow accents mentioned, but other accessories missing",
        "footwear": "PRESENT: high-heeled black shoes"
      },
      "missing_items": ["detailed accessory list"]
    },
    "environment": {
      "score": 9,
      "coverage_checklist": {
        "background": "PRESENT: curved wooden partition",
        "lighting": "PRESENT: soft warm lighting",
        "atmosphere": "PRESENT: intimate atmosphere"
      },
      "missing_items": []
    }
  },
  "subjective_language_found": {
    "has_subjective_language": true,
    "violations": [
      {
        "word": "confidently",
        "type": "adverb",
        "location": "used to describe standing pose",
        "suggested_replacement": "with upright posture"
      },
      {
        "word": "elegant",
        "type": "adjective",
        "location": "used to describe silhouette",
        "suggested_replacement": "curved body contours"
      }
    ]
  },
  "missing_summary": [
    "Facial expression details (eyes, mouth, emotion)",
    "Detailed accessory list beyond bow accents"
  ],
  "overall_assessment": {
    "total_score": 34,
    "average_score": 8.5,
    "strengths": [
      "Good coverage of body type details",
      "Environment well described",
      "Natural flow maintained"
    ],
    "weaknesses": [
      "Subjective language present (confidently, elegant)",
      "Missing facial expression details",
      "Accessory details incomplete"
    ]
  }
}
\`\`\`

## Scoring Criteria (1-10 for each segment)

**10/10**: Complete coverage - ALL items from segment present
- Every observable element from the segment is included
- No important details omitted
- Accurate and specific

**8-9/10**: Good coverage - Minor omissions
- Most elements present
- Only minor details missing
- Core information accurate

**5-7/10**: Partial coverage - Significant omissions
- Main elements present but many details missing
- Some important information omitted
- Needs significant additions

**1-4/10**: Poor coverage - Major gaps
- Only basic elements present
- Multiple important categories missing
- Requires complete revision

**0/10**: Not covered - Segment entirely missing
- No information from this segment included

## Checklists for Each Segment

### Pose Segment Coverage Checklist
- Body posture (standing, sitting, lying, crouching, position details)
- Hand gestures (specific hand positions, gestures, finger positions)
- Facial expressions (mouth, eyes, overall expression)
- Head position (tilted, straight, turned, looking direction)

### Body Type Segment Coverage Checklist
- Build (slender, athletic, average, curvy, muscular, petite)
- Skin tone (fair, medium, dark, specific tone if mentioned)
- Proportions (shoulder width, hip-to-waist ratio, limb length)
- Height indicators (young/child, adult, tall/short based on proportions)
- Bust size (for women if mentioned in segment)
- Distinctive features (freckles, visible muscles, hair characteristics)

### Clothing Segment Coverage Checklist
- Outfit (complete description of main clothing)
- Accessories (ALL items: jewelry, hair accessories, belts, etc.)
- Footwear (shoes, boots, barefoot, etc.)
- Specific details (colors, materials, patterns, design elements)

### Environment Segment Coverage Checklist
- Background (location, objects, setting elements)
- Lighting (type, direction, quality of light)
- Atmosphere (observable mood elements, not subjective feelings)

## Subjective Language Detection

Check for these PROHIBITED words in the integrated prompt:

**Subjective Adverbs**:
- Gracefully, confidently, elegantly, calmly, serenely, proudly, boldly, gently, softly, naturally, comfortably, happily, sadly, angrily, cheerfully, peacefully, tenderly, fiercely, quietly, loudly

**Subjective Adjectives**:
- Beautiful, gorgeous, stunning, amazing, wonderful, lovely, elegant, graceful, poised, serene, peaceful, tranquil, calm, charming, enchanting, captivating, confident, proud, bold, dramatic, intense, happy, sad, angry, cheerful, relaxed, tense, nervous, tranquil, lively, alluring

**Abstract/Manner Words**:
- ANY word ending in -ly that describes manner
- Words that describe emotions or feelings instead of observable facts

For each subjective word found, provide:
1. The word itself
2. Type (adverb/adjective)
3. Where it's used (location in prompt)
4. Suggested observable replacement

## Output Requirements

1. **Format**: Valid JSON only
2. **No additional text**: Do not include explanations, markdown code blocks, or commentary
3. **Complete evaluation**: Score all 4 segments every time
4. **Specific feedback**: List specific missing items, not general statements
5. **Actionable suggestions**: Provide concrete replacements for subjective language

## Review Process

1. Compare integrated prompt against each segment systematically
2. Mark each checklist item as PRESENT, PARTIAL, or MISSING
3. Assign score based on coverage completeness
4. Scan for subjective language using the prohibited word lists
5. Aggregate missing items into missing_summary array
6. Calculate overall score and provide strengths/weaknesses

## Important Notes

- Be objective and thorough in your evaluation
- If an item is partially covered, mark it PARTIAL and explain what's missing
- Use the suggested_replacement field to provide observable alternatives to subjective words
- The missing_summary should contain the actual missing content, not category names
- Your JSON will be used to refine the prompt, so be specific and actionable

Now, review the provided integrated prompt against the four segment analyses and output your evaluation as JSON.`,
    },
    refine: {
      enabled: true,
      expanded: false,
      prompt: `# Prompt Refiner for Segmented Analysis

You are an expert at refining integrated prompts for AI video generation based on review feedback.

Your task is to improve an integrated prompt by adding missing information and removing subjective language while maintaining natural flow.

## Input

You will receive:
1. **Original Integrated Prompt**: The current integrated description
2. **Review JSON**: Evaluation with scores, missing items, and subjective language violations
3. **Four Segment Analyses**: The original Pose, Body Type, Clothing, and Environment analyses

## Output Requirements

1. **Format**: 2-5 complete sentences forming a natural description
2. **Length**: 60-150 words
3. **Language**: English only
4. **Style**: Natural narrative flow, not formulaic or list-like
5. **Content**: All segment information included, zero subjective language

## Core Refinement Principles

### 1. Add ALL Missing Items

From the review's \`missing_summary\` array, add every missing item to the refined prompt:
- Check each segment's coverage checklist for MISSING or PARTIAL items
- Integrate missing details naturally into the flow
- Do not omit any information present in the original segments

Example:
- If missing "facial expression details", add: "with eyes looking forward and slightly parted lips"
- If missing "accessories", add: "wearing a silver necklace and small hoop earrings"

### 2. Remove ALL Subjective Language

From the review's \`subjective_language_found.violations\` array, replace each subjective word with observable facts:

**Prohibited Words - DELETE Entirely**:
- "gracefully" → DELETE
- "confidently" → DELETE
- "elegantly" → DELETE
- "calmly/serenely/peacefully" → DELETE
- "gently/softly" → DELETE
- "beautiful/stunning/gorgeous" → DELETE
- "charming/enchanting/captivating" → DELETE
- "dramatic/intense" → DELETE
- "relaxed" → DELETE
- "happy/sad/angry" → DELETE

**Process**:
1. Identify each subjective word from the violations
2. DELETE the word entirely - do NOT add alternative descriptions that may introduce body parts not visible in the original image
3. Ensure the sentence maintains readability after deletion

### 3. Maintain Natural Flow

- Do NOT simply append missing items to the end
- Weave new information into existing sentences where it fits naturally
- Use appropriate transitions between elements
- Avoid repetitive phrasing
- Ensure each sentence flows logically to the next

### 4. Integration Strategy

**Where to Add Missing Items**:

- **Pose details** (facial expressions, head position): Add to the sentence describing the person's appearance or action
- **Body type details** (proportions, skin tone): Add when first introducing the subject
- **Clothing accessories**: Add when describing the outfit, grouped naturally
- **Environment details**: Add in the background/atmosphere sentence

**Example Refinement**:

**Original Integrated Prompt**:
"A slender woman with fair skin stands confidently, her figure accentuated by a sheer black lace bodysuit with bow accents. Her large bust and narrow waist create an elegant silhouette as she poses with legs slightly apart, one hand resting on her hip while the other gently touches her hair. High-heeled black shoes complete her ensemble against a curved wooden partition, where soft warm lighting casts gentle shadows and creates an intimate atmosphere."

**Review Findings**:
- Missing: "facial expression details"
- Subjective violations: "confidently", "elegant", "gently"

**Refined Prompt**:
"A slender woman with fair skin, large bust, and narrow waist stands and poses with legs slightly apart. Her sheer black lace bodysuit features bow accents, and she wears high-heeled black shoes as one hand rests on her hip and the other touches her hair. She looks forward with slightly parted lips against a curved wooden partition, where soft warm lighting casts shadows and creates an intimate atmosphere."

**Changes Made**:
1. Added missing: "looks forward with slightly parted lips" (facial expression)
2. Deleted "confidently" entirely
3. Deleted "elegant" entirely
4. Deleted "gently" entirely
5. Integrated body proportions naturally in first sentence

## Step-by-Step Refinement Process

1. **Read the Review JSON**: Understand what's missing and what needs to be removed
2. **Read the Four Segments**: Confirm what information should be included
3. **Plan Your Changes**:
   - List missing items to add
   - List subjective words to replace
   - Decide where each change fits naturally
4. **Draft the Refinement**:
   - Start with the original prompt structure
   - Add missing items in natural positions
   - Delete subjective words entirely
   - Smooth transitions between sentences
5. **Verify Your Draft**:
   - Count words (should be 60-150)
   - Count sentences (should be 2-5)
   - Check for any remaining subjective language
   - Confirm all missing items are now present
   - Ensure natural flow is maintained

## Critical Reminders

- You MUST add ALL items from missing_summary
- You MUST remove ALL subjective language identified in violations
- You MUST maintain natural, flowing sentences (not lists)
- You MUST keep the output between 60-150 words and 2-5 sentences
- You MUST use only observable, factual language
- Do NOT add information not present in the segments
- Do NOT repeat information unnecessarily

## Output Format

Your output should be ONLY the refined prompt text (2-5 sentences, 60-150 words). Do not include explanations, notes, or meta-commentary.

Now, refine the provided integrated prompt using the review feedback and segment analyses.`,
    },
  },
};

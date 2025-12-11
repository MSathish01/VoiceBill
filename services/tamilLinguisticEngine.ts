/**
 * Tamil Linguistic Integrity and Formalization Engine
 * 
 * This module transforms raw ASR transcriptions into accurate, orthographically 
 * compliant, and formal Tamil text for professional PDF bill generation.
 * 
 * Handles:
 * 1. Diglossia - Converting colloquial/spoken Tamil to formal written Tamil
 * 2. ASR Error Correction - Using edit distance for lexical verification
 * 3. Tamil Orthographic Rules - Mei (consonant) and Uyir (vowel) validation
 * 4. Code-Mixed Content - Handling English loanwords within Tamil text
 * 5. Text Normalization - Comprehensive pre-processing
 */

// ============================================================================
// TAMIL UNICODE RANGES AND CHARACTER CLASSIFICATIONS
// ============================================================================

// Tamil Unicode block: U+0B80 to U+0BFF
const TAMIL_UNICODE_START = 0x0B80;
const TAMIL_UNICODE_END = 0x0BFF;

// Uyir (Vowels): அ ஆ இ ஈ உ ஊ எ ஏ ஐ ஒ ஓ ஔ
const UYIR_VOWELS = ['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ'];

// Mei (Pure Consonants with pulli): க் ங் ச் ஞ் ட் ண் த் ந் ப் ம் ய் ர் ல் வ் ழ் ள் ற் ன்
const MEI_CONSONANTS = ['க்', 'ங்', 'ச்', 'ஞ்', 'ட்', 'ண்', 'த்', 'ந்', 'ப்', 'ம்', 
                        'ய்', 'ர்', 'ல்', 'வ்', 'ழ்', 'ள்', 'ற்', 'ன்'];

// Uyirmei (Consonant + Vowel combinations): க கா கி கீ கு கூ கெ கே கை கொ கோ கௌ
// These are valid word starters

// Grantha consonants (for Sanskrit loanwords)
const GRANTHA_CONSONANTS = ['ஜ', 'ஷ', 'ஸ', 'ஹ'];

// Pulli (virama) mark
const PULLI = '்';

// ============================================================================
// DIGLOSSIA MAPPING: COLLOQUIAL TO FORMAL TAMIL
// ============================================================================

/**
 * Maps colloquial/spoken Tamil forms to their standard written equivalents.
 * This addresses the diglossia challenge in Tamil where spoken and written
 * forms differ significantly.
 */
const COLLOQUIAL_TO_FORMAL: Record<string, string> = {
  // Common grocery items - Colloquial to Formal
  'தக்காளி': 'தக்காளி',      // Already formal
  'தக்காள': 'தக்காளி',       // Dialectal variation
  'வெங்காயம்': 'வெங்காயம்',  // Already formal
  'வெங்காளம்': 'வெங்காயம்',  // Colloquial
  'வெங்கயம்': 'வெங்காயம்',   // ASR error
  'உருளை': 'உருளைக்கிழங்கு',  // Short form to formal
  'உருளக்கிழங்கு': 'உருளைக்கிழங்கு',
  'கத்திரி': 'கத்திரிக்காய்',  // Short form
  'கத்தரிக்காய்': 'கத்திரிக்காய்',
  'பீன்ஸ்': 'பீன்ஸ்',        // English loanword - keep as is
  'பீன்ஸ்காய்': 'பீன்ஸ்',
  'பரங்கி': 'பரங்கிக்காய்',   // Short form
  'சேனை': 'சேனைக்கிழங்கு',
  'கேரட்': 'கேரட்',         // English loanword
  'காரட்': 'கேரட்',
  'பீட்ரூட்': 'பீட்ரூட்',
  'முள்ளங்கி': 'முள்ளங்கி',
  'முல்லங்கி': 'முள்ளங்கி',   // Dialectal
  
  // Grains and Pulses
  'அரிசி': 'அரிசி',
  'அரிச': 'அரிசி',           // Spoken shortening
  'பருப்பு': 'பருப்பு',
  'பருப்ப': 'பருப்பு',
  'துவரம்': 'துவரம் பருப்பு',
  'துவர': 'துவரம் பருப்பு',
  'உளுந்து': 'உளுந்து',
  'உளுத்தம்': 'உளுத்தம் பருப்பு',
  'கடலை': 'கடலைப்பருப்பு',
  'பாசிப்பருப்பு': 'பாசிப்பருப்பு',
  'பாசி': 'பாசிப்பருப்பு',
  
  // Fruits
  'வாழைப்பழம்': 'வாழைப்பழம்',
  'வாழப்பழம்': 'வாழைப்பழம்',  // Spoken elision
  'ஆப்பிள்': 'ஆப்பிள்',
  'ஆப்பள்': 'ஆப்பிள்',
  'ஆரஞ்சு': 'ஆரஞ்சு',
  'ஆரஞ்ச': 'ஆரஞ்சு',
  'திராட்சை': 'திராட்சை',
  'திராச்சை': 'திராட்சை',
  'மாம்பழம்': 'மாம்பழம்',
  'மாங்கா': 'மாங்காய்',      // Colloquial to formal
  'பப்பாளி': 'பப்பாளி',
  'பப்பாய': 'பப்பாளி',
  
  // Spices and Condiments
  'மிளகாய்': 'மிளகாய்',
  'மிளகா': 'மிளகாய்',
  'மிளகு': 'மிளகு',
  'மல்லி': 'மல்லி',          // Coriander
  'கொத்தமல்லி': 'கொத்தமல்லி',
  'கொத்துமல்லி': 'கொத்தமல்லி',
  'புதினா': 'புதினா',
  'புதின': 'புதினா',
  'கறிவேப்பிலை': 'கறிவேப்பிலை',
  'கறிவேப்ல': 'கறிவேப்பிலை',  // Spoken shortening
  'இஞ்சி': 'இஞ்சி',
  'இஞ்ச': 'இஞ்சி',
  'பூண்டு': 'பூண்டு',
  'பூண்ட': 'பூண்டு',
  'எண்ணெய்': 'எண்ணெய்',
  'எண்ணை': 'எண்ணெய்',       // Common spoken form
  'உப்பு': 'உப்பு',
  'சர்க்கரை': 'சர்க்கரை',
  'சக்கர': 'சர்க்கரை',       // Colloquial
  
  // Dairy and Eggs
  'பால்': 'பால்',
  'முட்டை': 'முட்டை',
  'முட்ட': 'முட்டை',
  'தயிர்': 'தயிர்',
  'தயிரு': 'தயிர்',
  'நெய்': 'நெய்',
  'வெண்ணெய்': 'வெண்ணெய்',
  'வெண்ணை': 'வெண்ணெய்',
  'பன்னீர்': 'பன்னீர்',
  'பனீர்': 'பன்னீர்',
  
  // Meats (if applicable)
  'கோழி': 'கோழி இறைச்சி',
  'சிக்கன்': 'கோழி இறைச்சி',   // English to Tamil
  'மட்டன்': 'ஆட்டு இறைச்சி',
  'மீன்': 'மீன்',
  
  // Units - Colloquial to Formal
  'கிலோ': 'கிலோகிராம்',
  'கிலா': 'கிலோகிராம்',       // Dialectal
  'கேஜி': 'கிலோகிராம்',       // From English "KG"
  'கிராம்': 'கிராம்',
  'கிரா': 'கிராம்',
  'லிட்டர்': 'லிட்டர்',
  'லிட்டரு': 'லிட்டர்',
  'பாக்கெட்': 'பாக்கெட்',
  'பாக்கட்': 'பாக்கெட்',
  'பாக்': 'பாக்கெட்',
  
  // Common spoken variations
  'ருபாய்': 'ரூபாய்',
  'ருபா': 'ரூபாய்',
  'ருவா': 'ரூபாய்',
  'ரூபை': 'ரூபாய்',
  'ரூ': 'ரூபாய்',
};

// ============================================================================
// TAMIL GROCERY LEXICON FOR ASR ERROR CORRECTION
// ============================================================================

/**
 * Curated lexicon of valid Tamil words commonly used in grocery billing.
 * Used for edit-distance based correction of ASR errors.
 */
const TAMIL_GROCERY_LEXICON: string[] = [
  // Vegetables
  'தக்காளி', 'வெங்காயம்', 'உருளைக்கிழங்கு', 'கத்திரிக்காய்', 'முருங்கைக்காய்',
  'பாகற்காய்', 'புடலங்காய்', 'சுரைக்காய்', 'பீர்க்கங்காய்', 'வெண்டைக்காய்',
  'அவரைக்காய்', 'பீன்ஸ்', 'பட்டாணி', 'முட்டைகோஸ்', 'காலிஃப்ளவர்',
  'கேரட்', 'பீட்ரூட்', 'முள்ளங்கி', 'வாழைத்தண்டு', 'வாழைப்பூ',
  'காய்கறி', 'கீரை', 'பசலைக்கீரை', 'முருங்கைக்கீரை', 'அரைக்கீரை',
  'மணத்தக்காளி', 'பொன்னாங்கண்ணி', 'வெந்தயக்கீரை', 'கொத்தமல்லி', 'புதினா',
  'கறிவேப்பிலை', 'பூசணிக்காய்', 'சௌசௌ', 'குடைமிளகாய்', 'பச்சைமிளகாய்',
  'தேங்காய்', 'இஞ்சி', 'பூண்டு', 'சின்ன வெங்காயம்', 'பெரிய வெங்காயம்',
  
  // Grains and Pulses
  'அரிசி', 'புழுங்கல் அரிசி', 'பாசுமதி அரிசி', 'பொன்னி அரிசி',
  'கோதுமை', 'ரவை', 'மைதா', 'சோளம்', 'கம்பு', 'ராகி', 'கேழ்வரகு',
  'பருப்பு', 'துவரம் பருப்பு', 'கடலைப்பருப்பு', 'உளுத்தம் பருப்பு',
  'பாசிப்பருப்பு', 'மசூர் பருப்பு', 'கொண்டக்கடலை', 'ராஜ்மா',
  'உளுந்து', 'பயறு', 'மொச்சை', 'சுண்டல்',
  
  // Fruits
  'வாழைப்பழம்', 'ஆப்பிள்', 'ஆரஞ்சு', 'திராட்சை', 'மாம்பழம்',
  'மாங்காய்', 'பப்பாளி', 'கொய்யா', 'சப்போட்டா', 'பலாப்பழம்',
  'அன்னாசி', 'தர்பூசணி', 'முலாம்பழம்', 'பேரிக்காய்', 'மாதுளை',
  'எலுமிச்சை', 'சாத்துக்குடி', 'நாரத்தை', 'நெல்லிக்காய்',
  
  // Dairy Products
  'பால்', 'தயிர்', 'மோர்', 'நெய்', 'வெண்ணெய்', 'பன்னீர்', 'சீஸ்',
  
  // Spices and Condiments
  'மிளகு', 'மிளகாய்', 'மஞ்சள்', 'சீரகம்', 'கடுகு', 'வெந்தயம்',
  'சோம்பு', 'ஏலக்காய்', 'பட்டை', 'கிராம்பு', 'ஜாதிக்காய்',
  'உப்பு', 'சர்க்கரை', 'வெல்லம்', 'தேன்', 'எண்ணெய்',
  'நல்லெண்ணெய்', 'தேங்காய் எண்ணெய்', 'கடலை எண்ணெய்',
  
  // Eggs and Meat
  'முட்டை', 'கோழி இறைச்சி', 'ஆட்டு இறைச்சி', 'மீன்',
  
  // Common Items
  'ரூபாய்', 'கிலோகிராம்', 'கிராம்', 'லிட்டர்', 'மில்லி லிட்டர்',
  'பாக்கெட்', 'கட்டு', 'டஜன்', 'பெட்டி', 'மூட்டை',
];

// ============================================================================
// EDIT DISTANCE CALCULATION (LEVENSHTEIN)
// ============================================================================

/**
 * Calculates the Levenshtein edit distance between two strings.
 * Used for finding the closest match in the lexicon for ASR error correction.
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // Create a 2D array to store distances
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill the dp table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // Deletion
          dp[i][j - 1],     // Insertion
          dp[i - 1][j - 1]  // Substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Calculates similarity score between two strings.
 * Returns a value between 0 and 1 where 1 means identical.
 */
function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

/**
 * Finds the closest match in the lexicon for a given word.
 * Returns the match if similarity >= threshold, otherwise returns original.
 */
function findClosestLexiconMatch(
  word: string, 
  threshold: number = 0.75
): { match: string; similarity: number } {
  let bestMatch = word;
  let bestSimilarity = 0;
  
  for (const lexiconWord of TAMIL_GROCERY_LEXICON) {
    const similarity = calculateSimilarity(word, lexiconWord);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = lexiconWord;
    }
  }
  
  // Only return the match if it meets the threshold
  if (bestSimilarity >= threshold) {
    return { match: bestMatch, similarity: bestSimilarity };
  }
  
  return { match: word, similarity: bestSimilarity };
}

// ============================================================================
// TAMIL CHARACTER CLASSIFICATION UTILITIES
// ============================================================================

/**
 * Checks if a character is a Tamil character.
 */
function isTamilChar(char: string): boolean {
  if (!char || char.length === 0) return false;
  const code = char.charCodeAt(0);
  return code >= TAMIL_UNICODE_START && code <= TAMIL_UNICODE_END;
}

/**
 * Checks if a string contains Tamil characters.
 */
function containsTamil(text: string): boolean {
  return text.split('').some(isTamilChar);
}

/**
 * Checks if a character/sequence is an Uyir (vowel).
 */
function isUyir(char: string): boolean {
  return UYIR_VOWELS.includes(char);
}

/**
 * Checks if a character sequence is a Mei (pure consonant with pulli).
 */
function isMei(str: string): boolean {
  if (str.length < 2) return false;
  return str.endsWith(PULLI) && MEI_CONSONANTS.includes(str);
}

/**
 * Checks if a word starts with a Mei consonant (invalid in Tamil).
 */
function startsWithMei(word: string): boolean {
  if (word.length < 2) return false;
  // Check if first two characters form a mei (consonant + pulli)
  const firstTwo = word.substring(0, 2);
  return MEI_CONSONANTS.includes(firstTwo);
}

/**
 * Validates Tamil orthographic rules for a word.
 * Returns an object with validation status and any issues found.
 */
function validateTamilOrthography(word: string): { 
  isValid: boolean; 
  issues: string[] 
} {
  const issues: string[] = [];
  
  if (!containsTamil(word)) {
    return { isValid: true, issues: [] }; // Non-Tamil words are passed through
  }
  
  // Rule 1: Word should not start with Mei (pure consonant)
  if (startsWithMei(word)) {
    issues.push(`Word starts with mei consonant: ${word}`);
  }
  
  // Rule 2: Uyir (standalone vowels) typically don't appear mid-word
  // This is a simplified check - proper check would need syllable analysis
  const chars = [...word];
  for (let i = 1; i < chars.length - 1; i++) {
    if (isUyir(chars[i])) {
      // Standalone vowels in middle might indicate segmentation issues
      issues.push(`Standalone uyir in middle of word at position ${i}: ${chars[i]}`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

// ============================================================================
// TEXT NORMALIZATION
// ============================================================================

/**
 * Normalizes Unicode Tamil text to ensure consistent representation.
 * Handles common encoding variations.
 */
function normalizeUnicode(text: string): string {
  // Normalize to NFC (Canonical Decomposition, followed by Canonical Composition)
  return text.normalize('NFC');
}

/**
 * Removes excessive whitespace and normalizes spacing.
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .replace(/\s+/g, ' ')                   // Collapse multiple spaces
    .trim();
}

/**
 * Normalizes punctuation for Tamil text.
 */
function normalizePunctuation(text: string): string {
  return text
    .replace(/[""]/g, '"')           // Normalize quotes
    .replace(/['']/g, "'")           // Normalize apostrophes
    .replace(/…/g, '...')            // Normalize ellipsis
    .replace(/[–—]/g, '-');          // Normalize dashes
}

// ============================================================================
// CODE-MIXING HANDLER
// ============================================================================

/**
 * Identifies and preserves code-mixed content (English words in Tamil text).
 * Returns the text with proper handling of mixed content.
 */
function handleCodeMixing(text: string): string {
  // Common English loanwords used in Tamil grocery context
  const PRESERVED_ENGLISH_WORDS = [
    'kg', 'g', 'ml', 'l', 'ltr',
    'packet', 'pack', 'box', 'dozen',
    'chicken', 'mutton', 'fish',
    'rice', 'oil', 'sugar', 'salt',
    'tomato', 'potato', 'onion', 'carrot',
    'apple', 'orange', 'banana', 'mango',
    'milk', 'curd', 'butter', 'cheese', 'paneer',
    'rs', 'rupees', 'rupee', 'inr'
  ];
  
  // Split text into words while preserving spaces
  const words = text.split(/(\s+)/);
  
  return words.map(word => {
    const lowerWord = word.toLowerCase();
    // If it's a preserved English word, keep it as is
    if (PRESERVED_ENGLISH_WORDS.includes(lowerWord)) {
      return word;
    }
    // Otherwise return as is (will be processed by other functions)
    return word;
  }).join('');
}

// ============================================================================
// MAIN LINGUISTIC PROCESSING ENGINE
// ============================================================================

export interface LinguisticProcessingResult {
  originalText: string;
  processedText: string;
  corrections: Array<{
    original: string;
    corrected: string;
    type: 'diglossia' | 'asr_error' | 'normalization';
    confidence: number;
  }>;
  orthographyIssues: string[];
  containsTamil: boolean;
}

/**
 * Main processing function: Tamil Linguistic Integrity and Formalization Engine
 * 
 * Transforms raw ASR text into standardized, formal Tamil for PDF generation.
 */
export function processTamilText(rawText: string): LinguisticProcessingResult {
  const result: LinguisticProcessingResult = {
    originalText: rawText,
    processedText: rawText,
    corrections: [],
    orthographyIssues: [],
    containsTamil: false
  };
  
  if (!rawText || rawText.trim().length === 0) {
    return result;
  }
  
  let text = rawText;
  
  // Step 1: Basic Normalization
  text = normalizeUnicode(text);
  text = normalizeWhitespace(text);
  text = normalizePunctuation(text);
  
  // Check if text contains Tamil
  result.containsTamil = containsTamil(text);
  
  // Step 2: Handle Code-Mixed Content
  text = handleCodeMixing(text);
  
  // Step 3: Process each word
  const words = text.split(/(\s+)/);
  const processedWords: string[] = [];
  
  for (const word of words) {
    // Skip whitespace
    if (/^\s+$/.test(word)) {
      processedWords.push(word);
      continue;
    }
    
    // Skip numbers and punctuation
    if (/^[\d\.,₹]+$/.test(word)) {
      processedWords.push(word);
      continue;
    }
    
    let processedWord = word;
    
    // Step 3a: Apply Diglossia Mapping (Colloquial to Formal)
    const lowerWord = word.toLowerCase();
    if (COLLOQUIAL_TO_FORMAL[word]) {
      const formalWord = COLLOQUIAL_TO_FORMAL[word];
      result.corrections.push({
        original: word,
        corrected: formalWord,
        type: 'diglossia',
        confidence: 1.0
      });
      processedWord = formalWord;
    } else if (COLLOQUIAL_TO_FORMAL[lowerWord]) {
      const formalWord = COLLOQUIAL_TO_FORMAL[lowerWord];
      result.corrections.push({
        original: word,
        corrected: formalWord,
        type: 'diglossia',
        confidence: 1.0
      });
      processedWord = formalWord;
    }
    // Step 3b: ASR Error Correction using Edit Distance
    else if (containsTamil(word)) {
      const { match, similarity } = findClosestLexiconMatch(word);
      if (match !== word && similarity >= 0.75) {
        result.corrections.push({
          original: word,
          corrected: match,
          type: 'asr_error',
          confidence: similarity
        });
        processedWord = match;
      }
    }
    
    // Step 3c: Validate Orthography
    const orthographyResult = validateTamilOrthography(processedWord);
    if (!orthographyResult.isValid) {
      result.orthographyIssues.push(...orthographyResult.issues);
    }
    
    processedWords.push(processedWord);
  }
  
  result.processedText = processedWords.join('');
  
  return result;
}

/**
 * Simplified interface for direct text processing.
 * Returns only the processed text string for use in PDF generation.
 */
export function formalizeTamilForPDF(rawText: string): string {
  const result = processTamilText(rawText);
  return result.processedText;
}

/**
 * Batch process multiple text items (e.g., a list of bill items).
 */
export function processBillItems(items: Array<{ name: string; quantity: string }>): Array<{
  name: string;
  quantity: string;
  nameProcessingResult: LinguisticProcessingResult;
  quantityProcessingResult: LinguisticProcessingResult;
}> {
  return items.map(item => ({
    name: formalizeTamilForPDF(item.name),
    quantity: formalizeTamilForPDF(item.quantity),
    nameProcessingResult: processTamilText(item.name),
    quantityProcessingResult: processTamilText(item.quantity)
  }));
}

// ============================================================================
// EXPORTS FOR VOICE PARSER INTEGRATION
// ============================================================================

export {
  calculateSimilarity,
  findClosestLexiconMatch,
  validateTamilOrthography,
  containsTamil,
  normalizeUnicode,
  normalizeWhitespace,
  TAMIL_GROCERY_LEXICON,
  COLLOQUIAL_TO_FORMAL
};

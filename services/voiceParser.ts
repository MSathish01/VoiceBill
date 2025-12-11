import { RATE_KEYWORDS, QUANTITY_KEYWORDS } from '../constants';
import { ParsedVoiceData } from '../types';
import { 
  formalizeTamilForPDF, 
  containsTamil, 
  COLLOQUIAL_TO_FORMAL 
} from './tamilLinguisticEngine';

// ============================================================================
// UNIVERSAL MULTI-DOMAIN LEXICON FOR GENERAL BILLING
// ============================================================================
// This lexicon covers all daily need products, general merchandise, and services
// for small businesses and home use across multiple domains.

// Map for Tamil text numbers to digits (expanded for ASR variations)
const TAMIL_NUMBER_MAP: Record<string, string> = {
  // Basic numbers with all colloquial variants
  'ஒன்று': '1', 'ஒன்னு': '1', 'ஒரு': '1', 'ஒண்ணு': '1', 'ஒன்': '1', 'ஓன்னு': '1',
  'இரண்டு': '2', 'ரெண்டு': '2', 'இரெண்டு': '2', 'ரண்டு': '2', 'ரெண்ட': '2',
  'மூன்று': '3', 'மூணு': '3', 'மூன்': '3', 'மூன்ன': '3',
  'நான்கு': '4', 'நாலு': '4', 'நாங்கு': '4', 'நான்': '4', 'நால': '4',
  'ஐந்து': '5', 'அஞ்சு': '5', 'ஐந்': '5', 'ஐஞ்சு': '5',
  'ஆறு': '6', 'ஆற': '6', 'ஆறா': '6',
  'ஏழு': '7', 'ஏழ': '7', 'ஏழா': '7',
  'எட்டு': '8', 'எட்': '8', 'எட்ட': '8',
  'ஒன்பது': '9', 'ஒம்பது': '9', 'ஒன்ப': '9', 'ஒம்போது': '9',
  'பத்து': '10', 'பத்': '10', 'பத்தா': '10',
  // Teens
  'பதினொன்று': '11', 'பதினோரு': '11', 'பதினொண்ணு': '11',
  'பன்னிரண்டு': '12', 'பன்னெண்டு': '12', 'பனிரெண்டு': '12',
  'பதிமூன்று': '13', 'பதின்மூன்று': '13',
  'பதினான்கு': '14', 'பதினாலு': '14',
  'பதினைந்து': '15', 'பதினஞ்சு': '15',
  'பதினாறு': '16',
  'பதினேழு': '17',
  'பதினெட்டு': '18',
  'பத்தொன்பது': '19', 'பத்தொம்பது': '19',
  // Tens
  'இருபது': '20', 'இருவது': '20', 'ருபது': '20',
  'இருபத்தைந்து': '25', 'இருபத்தஞ்சு': '25',
  'முப்பது': '30', 'மூப்பது': '30',
  'நாற்பது': '40', 'நாப்பது': '40',
  'ஐம்பது': '50', 'ஐம்பத்': '50',
  'அறுபது': '60',
  'எழுபது': '70',
  'எண்பது': '80',
  'தொண்ணூறு': '90',
  'நூறு': '100', 'நூத்': '100',
  // Larger numbers
  'இருநூறு': '200', 'முந்நூறு': '300', 'நானூறு': '400', 'ஐந்நூறு': '500',
  'அறுநூறு': '600', 'எழுநூறு': '700', 'எண்ணூறு': '800', 'தொள்ளாயிரம்': '900',
  'ஆயிரம்': '1000',
  // Fractions (Common in grocery)
  'அரை': '0.5', 'அரைக்': '0.5',
  'கால்': '0.25', 'காலு': '0.25',
  'முக்கால்': '0.75',
  'ஒன்னரை': '1.5', 'ஒண்ணரை': '1.5'
};

// English spoken number variations that speech recognition might produce
const ENGLISH_NUMBER_MAP: Record<string, string> = {
  'one': '1', 'won': '1', 'wan': '1',
  'two': '2', 'to': '2', 'too': '2', 'tu': '2',
  'three': '3', 'tree': '3', 'free': '3',
  'four': '4', 'for': '4', 'fore': '4', 'foor': '4',
  'five': '5', 'fife': '5',
  'six': '6', 'sex': '6', 'sicks': '6',
  'seven': '7', 'sevan': '7',
  'eight': '8', 'ate': '8', 'eit': '8',
  'nine': '9', 'nein': '9',
  'ten': '10', 'tan': '10',
  'eleven': '11', 'levan': '11',
  'twelve': '12', 'twelf': '12',
  'thirteen': '13',
  'fourteen': '14',
  'fifteen': '15', 'fiftin': '15',
  'sixteen': '16',
  'seventeen': '17',
  'eighteen': '18',
  'nineteen': '19',
  'twenty': '20', 'tweny': '20', 'twenti': '20',
  'twenty five': '25', 'twentyfive': '25',
  'thirty': '30', 'thirdy': '30',
  'forty': '40', 'fourty': '40', 'fourtie': '40',
  'fifty': '50', 'fiftie': '50',
  'sixty': '60',
  'seventy': '70',
  'eighty': '80',
  'ninety': '90',
  'hundred': '100', 'hundrad': '100',
  'two hundred': '200', 'three hundred': '300', 'five hundred': '500',
  'thousand': '1000',
  'half': '0.5', 'haf': '0.5',
  'quarter': '0.25', 'quater': '0.25',
  'one and half': '1.5', 'one half': '1.5'
};

// Common misheard rate patterns from speech recognition
const RATE_CORRECTIONS: Record<string, string> = {
  'rupee': 'rupees',
  'rupe': 'rupees',
  'rupay': 'rupees',
  'rupaya': 'rupees',
  'roopees': 'rupees',
  'rupies': 'rupees',
  'rupi': 'rupees',
  'rs': 'rupees',
  'are': 'rupees', // "50 are" misheard as "50 rs"
  'ars': 'rupees',
  'rupess': 'rupees',
  'ரூபாய்': 'ரூபாய்',
  'ரூபா': 'ரூபாய்',
  'ருபாய்': 'ரூபாய்',
  'ருபா': 'ரூபாய்'
};

// Common Tamil grocery item names for splitting detection (expanded list)
const TAMIL_ITEM_NAMES = [
  // Vegetables
  'தக்காளி', 'வெங்காயம்', 'உருளைக்கிழங்கு', 'உருளை', 'கத்திரிக்காய்', 'கத்திரி',
  'முருங்கைக்காய்', 'பாகற்காய்', 'புடலங்காய்', 'சுரைக்காய்', 'வெண்டைக்காய்',
  'பீன்ஸ்', 'கேரட்', 'பீட்ரூட்', 'முள்ளங்கி', 'கீரை', 'கொத்தமல்லி', 'புதினா',
  'பூசணிக்காய்', 'மிளகாய்', 'பச்சை மிளகாய்', 'இஞ்சி', 'பூண்டு', 'தேங்காய்',
  'முட்டைகோஸ்', 'காலிஃப்ளவர்', 'குடைமிளகாய்', 'சௌசௌ', 'அவரைக்காய்',
  'பட்டாணி', 'சின்ன வெங்காயம்', 'பெரிய வெங்காயம்', 'வாழைத்தண்டு',
  // Grains
  'அரிசி', 'பருப்பு', 'கோதுமை', 'ரவை', 'மைதா', 'துவரம் பருப்பு',
  'உளுந்து', 'கடலை பருப்பு', 'பாசிப்பருப்பு', 'கம்பு', 'ராகி',
  // Fruits
  'வாழைப்பழம்', 'ஆப்பிள்', 'ஆரஞ்சு', 'திராட்சை', 'மாம்பழம்', 'மாங்காய்',
  'பப்பாளி', 'கொய்யா', 'தர்பூசணி', 'பேரிக்காய்', 'மாதுளை', 'சப்போட்டா',
  // Dairy
  'பால்', 'தயிர்', 'மோர்', 'நெய்', 'வெண்ணெய்', 'பன்னீர்', 'சீஸ்',
  // Meat & Eggs
  'முட்டை', 'மீன்', 'கோழி', 'சிக்கன்', 'மட்டன்', 'இறால்',
  // Spices & Oils
  'எண்ணெய்', 'நல்லெண்ணெய்', 'தேங்காய் எண்ணெய்', 'உப்பு', 'சர்க்கரை', 
  'மிளகு', 'மஞ்சள்', 'சீரகம்', 'கடுகு', 'வெந்தயம்',
  // Common English items
  'tomato', 'onion', 'potato', 'carrot', 'beans', 'milk', 'rice', 'egg', 'eggs',
  'chicken', 'mutton', 'fish', 'oil', 'sugar', 'salt', 'apple', 'banana', 'orange',
  'curd', 'butter', 'cheese', 'paneer', 'bread', 'atta', 'maida', 'dal'
];

// Tamil ASR correction map - common misheard words
const TAMIL_ASR_CORRECTIONS: Record<string, string> = {
  'தக்காள': 'தக்காளி',
  'வெங்கயம்': 'வெங்காயம்',
  'வெங்காயம': 'வெங்காயம்',
  'உருளக்கிழங்கு': 'உருளைக்கிழங்கு',
  'உருளகிழங்கு': 'உருளைக்கிழங்கு',
  'கத்தரிக்காய்': 'கத்திரிக்காய்',
  'கத்தரி': 'கத்திரிக்காய்',
  'முருங்கை': 'முருங்கைக்காய்',
  'கிலோகிராம்': 'கிலோ',
  'கிலோகிரா': 'கிலோ',
  'லிட்டரு': 'லிட்டர்',
};

/**
 * Pre-processes the transcript to fix common ASR issues:
 * 1. Replaces periods/commas with spaces (ASR artifacts)
 * 2. Normalizes whitespace
 * 3. Applies Tamil ASR corrections
 */
const preprocessTranscript = (text: string): string => {
  let processed = text;
  
  // Replace periods and commas with spaces (ASR often inserts these incorrectly)
  processed = processed.replace(/[.,;:]+/g, ' ');
  
  // Apply Tamil ASR corrections
  Object.keys(TAMIL_ASR_CORRECTIONS).forEach(key => {
    const regex = new RegExp(key, 'gi');
    processed = processed.replace(regex, TAMIL_ASR_CORRECTIONS[key]);
  });
  
  // Normalize whitespace
  processed = processed.replace(/\s+/g, ' ').trim();
  
  return processed;
};

/**
 * Normalizes text by converting spoken number words to digits.
 */
const normalizeNumbers = (text: string): string => {
  let normalized = text.toLowerCase();
  
  // First pass: Tamil numbers
  Object.keys(TAMIL_NUMBER_MAP).forEach(key => {
    const regex = new RegExp(`(^|\\s)${key}(\\s|$)`, 'gi');
    normalized = normalized.replace(regex, `$1${TAMIL_NUMBER_MAP[key]}$2`);
  });
  
  // Second pass: English spoken numbers
  Object.keys(ENGLISH_NUMBER_MAP).forEach(key => {
    const regex = new RegExp(`(^|\\s)${key}(\\s|$)`, 'gi');
    normalized = normalized.replace(regex, `$1${ENGLISH_NUMBER_MAP[key]}$2`);
  });
  
  // Third pass: Rate keyword corrections
  Object.keys(RATE_CORRECTIONS).forEach(key => {
    const regex = new RegExp(`(\\d+)\\s*${key}\\b`, 'gi');
    normalized = normalized.replace(regex, `$1 ${RATE_CORRECTIONS[key]}`);
  });
  
  // Handle compound numbers: "twenty five" -> "25", "fifty two" -> "52"
  normalized = normalized.replace(/(\d0)\s+(\d)(?!\d)/g, (_, tens, ones) => {
    return String(parseInt(tens) + parseInt(ones));
  });
  
  // Clean up multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
};

/**
 * Parses a single segment of text into Item Name, Quantity, and Rate.
 * IMPORTANT: When user says "item X kg Y rupees", the Y is TOTAL price, not per-unit rate.
 * We need to calculate: rate = total_price / quantity
 */
const parseSegment = (segment: string): ParsedVoiceData => {
  // 1. Normalize (handle Tamil & English spoken numbers)
  let text = normalizeNumbers(segment.toLowerCase().trim());
  
  // Clean up commas and extra spaces
  text = text.replace(/,/g, '').replace(/\s+/g, ' ').trim();

  let rate: number | null = null;
  let quantity: string | null = null;
  let quantityNumber: number = 1; // For calculating rate from total
  
  // Helper to build regex safely escaping characters
  const buildPattern = (keywords: string[]) => {
    const sortedKeys = [...keywords].sort((a, b) => b.length - a.length);
    return sortedKeys.map(k => {
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return escaped; 
    }).join('|');
  };

  // 2. Extract Quantity FIRST (before rate) to know the multiplier
  const qtyKeyPattern = buildPattern(QUANTITY_KEYWORDS);
  
  // Try multiple quantity patterns for better detection
  const qtyPatterns = [
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${qtyKeyPattern})s?`, 'i'),
    new RegExp(`(${qtyKeyPattern})\\s*(\\d+(?:\\.\\d+)?)`, 'i'), // "கிலோ 2" format
  ];
  
  for (const qtyPattern of qtyPatterns) {
    const qtyMatch = text.match(qtyPattern);
    if (qtyMatch) {
      // Find the number in the match
      const numStr = qtyMatch[1].match(/^\d/) ? qtyMatch[1] : qtyMatch[2];
      const unitStr = qtyMatch[1].match(/^\d/) ? qtyMatch[2] : qtyMatch[1];
      
      if (numStr) {
        quantityNumber = parseFloat(numStr) || 1;
        quantity = `${quantityNumber} ${unitStr}`.trim();
        text = text.replace(qtyMatch[0], ' ').trim();
        break;
      }
    }
  }
  
  // Fallback: Check for standalone quantity number patterns like "அரை கிலோ"
  if (!quantity) {
    // Check for Tamil fractions
    const fractionPatterns = [
      { pattern: /அரை\s*(கிலோ|லிட்டர்|kg|l)/i, value: 0.5 },
      { pattern: /கால்\s*(கிலோ|லிட்டர்|kg|l)/i, value: 0.25 },
      { pattern: /முக்கால்\s*(கிலோ|லிட்டர்|kg|l)/i, value: 0.75 },
    ];
    
    for (const { pattern, value } of fractionPatterns) {
      const match = text.match(pattern);
      if (match) {
        quantityNumber = value;
        quantity = match[0].trim();
        text = text.replace(match[0], ' ').trim();
        break;
      }
    }
  }

  // 3. Extract Price (what user says is TOTAL price, not rate per unit)
  const rateKeyPattern = buildPattern(RATE_KEYWORDS);
  
  // Multiple patterns to catch different speech patterns:
  const ratePatterns = [
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${rateKeyPattern})`, 'i'),
    new RegExp(`(${rateKeyPattern})\\s*(\\d+(?:\\.\\d+)?)`, 'i'),
  ];
  
  let totalPrice: number | null = null;
  
  for (const pattern of ratePatterns) {
    const rateMatch = text.match(pattern);
    if (rateMatch) {
      // Find the number in the match
      const numberStr = rateMatch[1].match(/^\d/) ? rateMatch[1] : rateMatch[2];
      if (numberStr && !isNaN(parseFloat(numberStr))) {
        totalPrice = parseFloat(numberStr);
        text = text.replace(rateMatch[0], ' ').trim();
        break;
      }
    }
  }
  
  // 4. Calculate RATE from total price
  // User says total price, we need rate per unit
  if (totalPrice !== null) {
    if (quantityNumber > 0) {
      // Rate = Total Price / Quantity
      rate = totalPrice / quantityNumber;
    } else {
      rate = totalPrice;
    }
  }

  // 5. Fallback: Look for remaining numbers
  if (!rate) {
    const standaloneNumber = text.match(/\b(\d+(?:\.\d+)?)\b/);
    if (standaloneNumber && quantity) {
      totalPrice = parseFloat(standaloneNumber[1]);
      rate = totalPrice / quantityNumber;
      text = text.replace(standaloneNumber[0], ' ').trim();
    }
  }

  // 6. Extract Name
  // Remove special chars but keep spaces, Tamil chars (\u0B80-\u0BFF), and hyphens
  let name = text.replace(/[^\w\s\u0B80-\u0BFF\-]/g, ' ').trim(); 
  name = name.replace(/\s+/g, ' ');
  
  // 7. Apply Tamil Linguistic Processing for ASR correction and formalization
  // This handles diglossia (colloquial to formal) and ASR error correction
  if (containsTamil(name)) {
    name = formalizeTamilForPDF(name);
  }
  
  // Capitalize first letter (for non-Tamil or mixed text)
  if (name.length > 0 && !containsTamil(name.charAt(0))) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  return { name: name || null, quantity, rate };
};

/**
 * Main function to parse continuous streaming input.
 * Splits full text into multiple items using a hybrid approach:
 * 1. Primary: Split by rate patterns (item completion markers)
 * 2. Secondary: Split by known item names (for cases where rate is missing/unclear)
 */
export const parseContinuousInput = (fullTranscript: string): ParsedVoiceData[] => {
  const results: ParsedVoiceData[] = [];
  
  // Step 1: Pre-process transcript to fix ASR artifacts
  const cleanedTranscript = preprocessTranscript(fullTranscript);
  
  // Step 2: Normalize numbers (Tamil & English spoken words to digits)
  const normalizedTranscript = normalizeNumbers(cleanedTranscript);
  
  // Step 3: Try to split by rate patterns first (primary method)
  const rateKeyPattern = RATE_KEYWORDS.sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  
  // Regex to find things like "50 rupees", "rs 50", "50 ரூபாய்" globally
  const splitRegex = new RegExp(
    `(\\d+(?:\\.\\d+)?\\s*(?:${rateKeyPattern})|(?:${rateKeyPattern})\\s*\\d+(?:\\.\\d+)?)`, 
    'gi'
  );

  let match;
  let lastIndex = 0;
  let foundRateMatches = false;
  
  // Iterate through all "Rate" matches in the string
  while ((match = splitRegex.exec(normalizedTranscript)) !== null) {
    foundRateMatches = true;
    const endIndex = splitRegex.lastIndex;
    const segment = normalizedTranscript.slice(lastIndex, endIndex);
    
    const parsed = parseSegment(segment);
    if (parsed.name || parsed.quantity) {
      results.push(parsed);
    }
    
    lastIndex = endIndex;
  }
  
  // Step 4: If no rate patterns found, try splitting by item names
  if (!foundRateMatches) {
    // Build regex pattern for item names (sort by length for longest match first)
    const itemNamePattern = TAMIL_ITEM_NAMES
      .sort((a, b) => b.length - a.length)
      .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    
    // Split by item names - each item name starts a new segment
    const itemSplitRegex = new RegExp(`(${itemNamePattern})`, 'gi');
    const parts = normalizedTranscript.split(itemSplitRegex).filter(p => p.trim());
    
    let currentSegment = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      const isItemName = TAMIL_ITEM_NAMES.some(
        name => name.toLowerCase() === part.toLowerCase()
      );
      
      if (isItemName) {
        // If we have accumulated content before this item name, parse it
        if (currentSegment.trim()) {
          const parsed = parseSegment(currentSegment);
          if (parsed.name || parsed.quantity) {
            results.push(parsed);
          }
        }
        // Start new segment with item name
        currentSegment = part;
      } else {
        // Add to current segment
        currentSegment += ' ' + part;
      }
    }
    
    // Parse remaining segment
    if (currentSegment.trim()) {
      const parsed = parseSegment(currentSegment);
      if (parsed.name || parsed.quantity) {
        results.push(parsed);
      }
    }
  } else {
    // Handle remaining text after last rate match (live/partial item)
    const remaining = normalizedTranscript.slice(lastIndex);
    if (remaining.trim().length > 0) {
      // Check if remaining text contains multiple items by item names
      const itemNamePattern = TAMIL_ITEM_NAMES
        .sort((a, b) => b.length - a.length)
        .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
      
      const itemSplitRegex = new RegExp(`(${itemNamePattern})`, 'gi');
      const parts = remaining.split(itemSplitRegex).filter(p => p.trim());
      
      let currentSegment = '';
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        const isItemName = TAMIL_ITEM_NAMES.some(
          name => name.toLowerCase() === part.toLowerCase()
        );
        
        if (isItemName && currentSegment.trim()) {
          const parsed = parseSegment(currentSegment);
          if (parsed.name || parsed.quantity) {
            results.push(parsed);
          }
          currentSegment = part;
        } else {
          currentSegment += ' ' + part;
        }
      }
      
      // Add final segment
      if (currentSegment.trim()) {
        const parsedRemaining = parseSegment(currentSegment);
        results.push(parsedRemaining);
      }
    }
  }

  return results;
};

// Keep old export for backward compatibility if needed, but alias it
export const parseVoiceInput = parseSegment;
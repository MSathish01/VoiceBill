import { RATE_KEYWORDS, QUANTITY_KEYWORDS } from '../constants';
import { ParsedVoiceData } from '../types';

// Map for Tamil text numbers to digits
const TAMIL_NUMBER_MAP: Record<string, string> = {
  // Basic numbers
  'ஒன்று': '1', 'ஒன்னு': '1', 'ஒரு': '1', 'ஒண்ணு': '1',
  'இரண்டு': '2', 'ரெண்டு': '2', 'இரெண்டு': '2',
  'மூன்று': '3', 'மூணு': '3',
  'நான்கு': '4', 'நாலு': '4', 'நாங்கு': '4',
  'ஐந்து': '5', 'அஞ்சு': '5',
  'ஆறு': '6',
  'ஏழு': '7',
  'எட்டு': '8',
  'ஒன்பது': '9', 'ஒம்பது': '9',
  'பத்து': '10',
  // Teens
  'பதினொன்று': '11', 'பதினோரு': '11',
  'பன்னிரண்டு': '12', 'பன்னெண்டு': '12',
  'பதிமூன்று': '13',
  'பதினான்கு': '14',
  'பதினைந்து': '15',
  'பதினாறு': '16',
  'பதினேழு': '17',
  'பதினெட்டு': '18',
  'பத்தொன்பது': '19',
  // Tens
  'இருபது': '20', 'இருவது': '20',
  'முப்பது': '30',
  'நாற்பது': '40',
  'ஐம்பது': '50',
  'அறுபது': '60',
  'எழுபது': '70',
  'எண்பது': '80',
  'தொண்ணூறு': '90',
  'நூறு': '100',
  // Fractions (Common in grocery)
  'அரை': '0.5',
  'கால்': '0.25',
  'முக்கால்': '0.75'
};

// English spoken number variations that speech recognition might produce
const ENGLISH_NUMBER_MAP: Record<string, string> = {
  'one': '1', 'won': '1',
  'two': '2', 'to': '2', 'too': '2',
  'three': '3', 'tree': '3',
  'four': '4', 'for': '4', 'fore': '4',
  'five': '5',
  'six': '6', 'sex': '6',
  'seven': '7',
  'eight': '8', 'ate': '8',
  'nine': '9',
  'ten': '10',
  'eleven': '11',
  'twelve': '12',
  'thirteen': '13',
  'fourteen': '14',
  'fifteen': '15',
  'sixteen': '16',
  'seventeen': '17',
  'eighteen': '18',
  'nineteen': '19',
  'twenty': '20',
  'thirty': '30',
  'forty': '40', 'fourty': '40',
  'fifty': '50',
  'sixty': '60',
  'seventy': '70',
  'eighty': '80',
  'ninety': '90',
  'hundred': '100',
  'half': '0.5',
  'quarter': '0.25'
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
  'rupess': 'rupees'
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
  const qtyPattern = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${qtyKeyPattern})s?`, 'i');
  
  const qtyMatch = text.match(qtyPattern);
  if (qtyMatch) {
    quantity = qtyMatch[0].trim();
    quantityNumber = parseFloat(qtyMatch[1]) || 1;
    text = text.replace(qtyMatch[0], ' ').trim();
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
  
  // Capitalize first letter
  if (name.length > 0) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  return { name: name || null, quantity, rate };
};

/**
 * Main function to parse continuous streaming input.
 * Splits full text into multiple items based on "Rate" completion.
 */
export const parseContinuousInput = (fullTranscript: string): ParsedVoiceData[] => {
  const results: ParsedVoiceData[] = [];
  
  // Normalize entire input first to handle splits correctly
  const normalizedTranscript = normalizeNumbers(fullTranscript);
  
  // Logic: An item is completed when a Price (Rate) is mentioned.
  // We scan for Rate patterns to find split points.
  
  // 1. Identify all locations of Rate patterns
  const rateKeyPattern = RATE_KEYWORDS.sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  
  // Regex to find things like "50 rupees" or "rs 50" globally
  const splitRegex = new RegExp(
    `(\\d+(?:\\.\\d+)?\\s*(?:${rateKeyPattern})|(?:${rateKeyPattern})\\s*\\d+(?:\\.\\d+)?)`, 
    'gi'
  );

  let match;
  let lastIndex = 0;
  
  // We iterate through all "Rate" matches in the string
  while ((match = splitRegex.exec(normalizedTranscript)) !== null) {
    // The end of this match is the end of an item
    const endIndex = splitRegex.lastIndex;
    
    // Extract the segment from lastIndex to endIndex
    const segment = normalizedTranscript.slice(lastIndex, endIndex);
    
    // Parse this completed segment
    const parsed = parseSegment(segment);
    // Only add if it looks like a valid item (has name or qty)
    if (parsed.name || parsed.quantity) {
      results.push(parsed);
    }
    
    lastIndex = endIndex;
  }
  
  // 2. Handle the remaining text (The "Live" part)
  // This is the part after the last price, e.g., "Potato 3 kg..." (waiting for price)
  const remaining = normalizedTranscript.slice(lastIndex);
  if (remaining.trim().length > 0) {
    const parsedRemaining = parseSegment(remaining);
    // Push it even if partial, App.tsx handles the visual "Waiting" state
    results.push(parsedRemaining);
  }

  return results;
};

// Keep old export for backward compatibility if needed, but alias it
export const parseVoiceInput = parseSegment;
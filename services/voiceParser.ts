import { RATE_KEYWORDS, QUANTITY_KEYWORDS } from '../constants';
import { ParsedVoiceData } from '../types';

// Map for Tamil text numbers to digits
const TAMIL_NUMBER_MAP: Record<string, string> = {
  'ஒன்று': '1', 'ஒன்னு': '1', 'ஒரு': '1',
  'இரண்டு': '2', 'ரெண்டு': '2',
  'மூன்று': '3', 'மூணு': '3',
  'நான்கு': '4', 'நாலு': '4',
  'ஐந்து': '5', 'அஞ்சு': '5',
  'ஆறு': '6',
  'ஏழு': '7',
  'எட்டு': '8',
  'ஒன்பது': '9',
  'பத்து': '10',
  'இருபது': '20',
  'முப்பது': '30',
  'நாற்பது': '40',
  'ஐம்பது': '50',
  'நூறு': '100',
  // Fractions (Common in grocery)
  'அரை': '0.5',
  'கால்': '0.25',
  'முக்கால்': '0.75'
};

/**
 * Normalizes Tamil text by converting spoken number words to digits.
 * E.g., "இரண்டு கிலோ" -> "2 கிலோ"
 */
const normalizeTamilText = (text: string): string => {
  let normalized = text;
  Object.keys(TAMIL_NUMBER_MAP).forEach(key => {
    // Regex matches the word with boundaries to avoid replacing parts of other words
    // \b doesn't always work well with Tamil characters, so we use space or start/end anchors
    const regex = new RegExp(`(^|\\s)${key}(\\s|$)`, 'g');
    normalized = normalized.replace(regex, `$1${TAMIL_NUMBER_MAP[key]}$2`);
  });
  return normalized;
};

/**
 * Parses a single segment of text into Item Name, Quantity, and Rate.
 */
const parseSegment = (segment: string): ParsedVoiceData => {
  // 1. Normalize (handle Tamil numbers first)
  let text = normalizeTamilText(segment.toLowerCase().trim());
  
  // Clean up commas
  text = text.replace(/,/g, '');

  let rate: number | null = null;
  let quantity: string | null = null;
  
  // Helper to build regex safely escaping characters
  const buildPattern = (keywords: string[]) => {
    const sortedKeys = [...keywords].sort((a, b) => b.length - a.length);
    return sortedKeys.map(k => {
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return escaped; 
    }).join('|');
  };

  // 2. Extract Rate (Explicit with keywords)
  const rateKeyPattern = buildPattern(RATE_KEYWORDS);
  // Matches "50 rupees", "rs 50", "50rupees", "50ரூபாய்"
  const ratePattern = new RegExp(
    `(\\d+(\\.\\d+)?)\\s*(${rateKeyPattern})|(${rateKeyPattern})\\s*(\\d+(\\.\\d+)?)`, 
    'i'
  );
  
  const rateMatch = text.match(ratePattern);
  if (rateMatch) {
    const numberStr = rateMatch[1] || rateMatch[5];
    if (numberStr) {
      rate = parseFloat(numberStr);
      text = text.replace(rateMatch[0], ' ').trim();
    }
  }

  // 3. Extract Quantity
  const qtyKeyPattern = buildPattern(QUANTITY_KEYWORDS);
  // Matches "2kg", "2 kg", "2.5liters", "2கிலோ"
  // Note: We intentionally don't enforce space between digit and unit for Tamil support (e.g. 2கிலோ)
  const qtyPattern = new RegExp(`(\\d+(\\.\\d+)?)\\s*(${qtyKeyPattern})s?`, 'i');
  
  const qtyMatch = text.match(qtyPattern);
  if (qtyMatch) {
    quantity = qtyMatch[0]; // Keep the unit in the string
    text = text.replace(qtyMatch[0], ' ').trim();
  } else {
    // Fallback: Number at start if not a rate
    // Only if we haven't found a quantity yet
    const startNumberMatch = text.match(/^(\d+(\.\d+)?)\s+/);
    if (startNumberMatch && !rate) {
        // Ambiguous: Is "2 Tomato" 2 quantity or 2 rate? 
        // Usually Quantity comes before item or after. 
        // Let's assume quantity if no unit found yet.
        quantity = startNumberMatch[1];
        text = text.replace(startNumberMatch[0], ' ').trim();
    }
  }

  // 4. Rate Fallback (Implicit Rate)
  // If we found Quantity (with units) but NO Rate, and there is a number left, it's likely the Rate.
  // Example: "Tomato 2kg 50" -> 50 is Rate.
  if (quantity && !rate) {
    // Match number at the end of the string
    const endNumberMatch = text.match(/\s(\d+(\.\d+)?)$/);
    if (endNumberMatch) {
      rate = parseFloat(endNumberMatch[1]);
      text = text.replace(endNumberMatch[0], ' ').trim();
    }
  }

  // 5. Extract Name
  // Remove special chars but keep spaces, Tamil chars (\u0B80-\u0BFF), and hyphens
  let name = text.replace(/[^\w\s\u0B80-\u0BFF\-]/g, ' ').trim(); 
  name = name.replace(/\s+/g, ' ');
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
  
  // Normalize entire input first to handle splits correctly if rate is spoken in words
  const normalizedTranscript = normalizeTamilText(fullTranscript);
  
  // Logic: An item is completed when a Price (Rate) is mentioned.
  // We scan for Rate patterns to find split points.
  
  // 1. Identify all locations of Rate patterns
  const rateKeyPattern = RATE_KEYWORDS.sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  
  // Regex to find things like "50 rupees" or "rs 50" globally
  const splitRegex = new RegExp(
    `(\\d+(\\.\\d+)?\\s*(${rateKeyPattern})|(${rateKeyPattern})\\s*\\d+(\\.\\d+)?)`, 
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
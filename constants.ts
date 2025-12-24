import { Language, Translation } from './types';

export const TRANSLATIONS: Record<Language, Translation> = {
  en: {
    title: "Daily Home Billing",
    slNo: "Sl. No",
    item: "Item Name",
    quantity: "Qty/Unit",
    rate: "Rate (₹)",
    total: "Total",
    grandTotal: "Grand Total",
    micHint: "Tap Mic & Say: 'Tomato 2 kg 50 rupees'",
    listening: "Listening...",
    addItem: "Add Manually",
    downloadPdf: "Download PDF",
    userDetails: "Customer Details",
    namePlaceholder: "Customer Name",
    addressPlaceholder: "Address",
    mobilePlaceholder: "Mobile Number",
    emailPlaceholder: "Email (Optional)",
    pdfTitlePlaceholder: "PDF Title (Optional)",
    delete: "Delete",
    clearAll: "Clear List"
  },
  ta: {
    title: "தினசரி வீட்டு ரசீது",
    slNo: "வ.எண்",
    item: "பொருள்",
    quantity: "அளவு",
    rate: "விலை (₹)",
    total: "மொத்தம்",
    grandTotal: "மொத்த தொகை",
    micHint: "பேசவும்: 'தக்காளி 2 கிலோ 50 ரூபாய்'",
    listening: "கேட்கிறது...",
    addItem: "சேர்க்கவும்",
    downloadPdf: "PDF பதிவிறக்கம்",
    userDetails: "வாடிக்கையாளர் விவரங்கள்",
    namePlaceholder: "பெயர்",
    addressPlaceholder: "முகவரி",
    mobilePlaceholder: "கைபேசி எண்",
    emailPlaceholder: "மின்னஞ்சல் (விருப்பத் தேர்வு)",
    pdfTitlePlaceholder: "PDF தலைப்பு (விருப்பத் தேர்வு)",
    delete: "நீக்கு",
    clearAll: "அழி"
  }
};

// Regex Patterns for Parsing
// Note: We include variations. The Parser will sort by length to match longest first.
export const RATE_KEYWORDS = [
  // English variations (including common misheard)
  'rupees', 'rupee', 'rupay', 'rupaya', 'roopees', 'rupies',
  'rs', 'r', 'inr', '₹',
  // Tamil variations
  'ரூபாய்', 'ரூபா', 'ரூ', 'விலை', 'ரூபாய்க்கு', 'ரூபை',
  // Common spoken patterns
  'bucks', 'price'
];

export const QUANTITY_KEYWORDS = [
  // English - Weight
  'kilogram', 'kilograms', 'kilo', 'kilos', 'kgs', 'kg',
  'gram', 'grams', 'gms', 'gm', 'g',
  // English - Volume  
  'liters', 'liter', 'litre', 'litres', 'ltr', 'l',
  'milliliters', 'milliliter', 'milli', 'ml',
  // English - Count/Package
  'packets', 'packet', 'pkt', 'pack', 'packs',
  'bundle', 'bundles', 'bunch', 'bunches',
  'boxes', 'box',
  'pieces', 'piece', 'pcs', 'pc',
  'nos', 'number', 'numbers', 'count',
  'dozen', 'dozens', 'doz',
  'unit', 'units',
  
  // Tamil Units - Weight
  'கிலோ', 'கிலோகிராம்', 'கி.கி', 'கி',
  'கிராம்', 'கிரா',
  // Tamil Units - Volume
  'லிட்டர்', 'லி',
  'மில்லி', 'மி.லி',
  // Tamil Units - Count/Package
  'பாக்கெட்', 'பாக்', 'பேக்',
  'கட்டு', 'கட்டுகள்',
  'எண்ணிக்கை', 'பீஸ்', 'பிஸ்',
  'டஜன்',
  'மூட்டை',
  'பெட்டி'
];
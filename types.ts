export type Language = 'en' | 'ta';

export interface BillItem {
  id: string;
  name: string;
  quantity: string; // e.g., "2 kg", "500 g"
  rate: number;
  total: number;
  isLive?: boolean; // True if this item is currently being spoken/parsed
}

export interface UserDetails {
  name: string;
  address: string;
  mobile: string;
  email: string;
  pdfTitle: string;
}

export interface ParsedVoiceData {
  name: string | null;
  quantity: string | null;
  rate: number | null;
}

export interface Translation {
  title: string;
  slNo: string;
  item: string;
  quantity: string;
  rate: string;
  total: string;
  grandTotal: string;
  micHint: string;
  listening: string;
  addItem: string;
  downloadPdf: string;
  userDetails: string;
  namePlaceholder: string;
  addressPlaceholder: string;
  mobilePlaceholder: string;
  emailPlaceholder: string;
  pdfTitlePlaceholder: string;
  delete: string;
  clearAll: string;
}
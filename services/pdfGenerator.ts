import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BillItem, UserDetails, Translation } from '../types';
import { TAMIL_FONT_BASE64 } from './tamilFontBase64';

// ═══════════════════════════════════════════════════════════════
// ROYAL TEAL THEME - Elegant Professional Color Palette
// ═══════════════════════════════════════════════════════════════
const THEME = {
  primary: [13, 148, 136] as [number, number, number],       // Teal-600
  primaryDark: [15, 118, 110] as [number, number, number],   // Teal-700
  primaryDeep: [17, 94, 89] as [number, number, number],     // Teal-800
  primaryLight: [204, 251, 241] as [number, number, number], // Teal-100
  accent: [245, 158, 11] as [number, number, number],        // Gold/Amber-500
  accentLight: [254, 243, 199] as [number, number, number],  // Amber-100
  dark: [17, 24, 39] as [number, number, number],            // Gray-900
  text: [55, 65, 81] as [number, number, number],            // Gray-700
  textLight: [107, 114, 128] as [number, number, number],    // Gray-500
  white: [255, 255, 255] as [number, number, number],
  lightBg: [240, 253, 250] as [number, number, number],      // Teal-50
  border: [153, 246, 228] as [number, number, number],       // Teal-200
  cardBg: [247, 254, 252] as [number, number, number],       // Near-white teal tint
};

// Tamil character detection
const containsTamil = (text: string): boolean => /[\u0B80-\u0BFF]/.test(text);

export const generatePDF = async (
  items: BillItem[],
  userDetails: UserDetails,
  t: Translation,
  grandTotal: number
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Detect Tamil content
  const hasTamilContent = containsTamil(t.title) || 
    items.some(item => containsTamil(item.name)) ||
    containsTamil(userDetails.name || '') ||
    containsTamil(userDetails.address || '');

  // Register Tamil font directly from embedded base64
  let tamilFontLoaded = false;
  try {
    if (TAMIL_FONT_BASE64) {
      // Add font to virtual file system
      doc.addFileToVFS('NotoSansTamil-Regular.ttf', TAMIL_FONT_BASE64);
      // Register font with Unicode encoding support
      doc.addFont('NotoSansTamil-Regular.ttf', 'NotoSansTamil', 'normal', 'Identity-H');
      tamilFontLoaded = true;
      console.log('[PDF] Tamil font registered successfully with Identity-H encoding');
    }
  } catch (err) {
    console.warn('[PDF] Font embedding failed:', err);
  }

  // Font helpers
  const setTamilFont = () => tamilFontLoaded && doc.setFont('NotoSansTamil', 'normal');
  const setDefaultFont = () => doc.setFont('helvetica', 'normal');
  const setDefaultBold = () => doc.setFont('helvetica', 'bold');

  // ═══════════════════════════════════════════════════════════════
  // ROYAL TEAL HEADER DESIGN
  // ═══════════════════════════════════════════════════════════════
  
  // Main header gradient (solid teal)
  doc.setFillColor(...THEME.primary);
  doc.rect(0, 0, pageWidth, 48, 'F');
  
  // Darker accent strip
  doc.setFillColor(...THEME.primaryDeep);
  doc.rect(0, 44, pageWidth, 4, 'F');
  
  // Gold accent line
  doc.setFillColor(...THEME.accent);
  doc.rect(0, 44, pageWidth, 1.5, 'F');
  
  // Decorative corner triangles
  doc.setFillColor(...THEME.primaryDark);
  doc.triangle(0, 0, 25, 0, 0, 25, 'F');
  doc.triangle(pageWidth, 0, pageWidth - 25, 0, pageWidth, 25, 'F');

  // Small gold diamond decoration
  doc.setFillColor(...THEME.accent);
  doc.circle(pageWidth / 2, 4, 2, 'F');

  // Title - Use Tamil font if available
  doc.setTextColor(...THEME.white);
  if (hasTamilContent && tamilFontLoaded) {
    doc.setFont('NotoSansTamil', 'normal');
    doc.setFontSize(20);
  } else {
    setDefaultBold();
    doc.setFontSize(28);
  }
  doc.text(t.title, pageWidth / 2, 24, { align: 'center' });
  
  // Subtitle - Date (always English)
  doc.setFontSize(10);
  setDefaultFont();
  doc.setTextColor(...THEME.primaryLight);
  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  doc.text(dateStr, pageWidth / 2, 36, { align: 'center' });

  // ═══════════════════════════════════════════════════════════════
  // CUSTOMER INFO CARD
  // ═══════════════════════════════════════════════════════════════
  const cardY = 56;
  const cardHeight = 36;
  
  // Card shadow
  doc.setFillColor(200, 200, 200);
  doc.roundedRect(12, cardY + 2, pageWidth - 24, cardHeight, 5, 5, 'F');
  
  // Card background
  doc.setFillColor(...THEME.white);
  doc.roundedRect(10, cardY, pageWidth - 20, cardHeight, 5, 5, 'F');
  
  // Card border
  doc.setDrawColor(...THEME.border);
  doc.setLineWidth(0.6);
  doc.roundedRect(10, cardY, pageWidth - 20, cardHeight, 5, 5, 'S');
  
  // Left accent bar (teal)
  doc.setFillColor(...THEME.primary);
  doc.roundedRect(10, cardY, 5, cardHeight, 5, 0, 'F');
  doc.rect(13, cardY, 2, cardHeight, 'F');
  
  // Section title
  doc.setTextColor(...THEME.primary);
  if (hasTamilContent && tamilFontLoaded) {
    doc.setFont('NotoSansTamil', 'normal');
    doc.setFontSize(11);
  } else {
    setDefaultBold();
    doc.setFontSize(11);
  }
  doc.text(t.userDetails, 22, cardY + 11);
  
  // Customer details
  doc.setFontSize(10);
  let infoY = cardY + 22;
  
  // Name & Phone
  if (userDetails.name) {
    if (containsTamil(userDetails.name) && tamilFontLoaded) {
      doc.setFont('NotoSansTamil', 'normal');
    } else {
      setDefaultBold();
    }
    doc.setTextColor(...THEME.dark);
    doc.text(userDetails.name, 22, infoY);
  }
  if (userDetails.mobile) {
    setDefaultFont();
    doc.setTextColor(...THEME.textLight);
    doc.text('Ph: ' + userDetails.mobile, 95, infoY);
  }
  
  // Address & Email
  infoY += 9;
  if (userDetails.address) {
    if (containsTamil(userDetails.address) && tamilFontLoaded) {
      doc.setFont('NotoSansTamil', 'normal');
    } else {
      setDefaultFont();
    }
    doc.setTextColor(...THEME.textLight);
    doc.text(userDetails.address, 22, infoY);
  }
  if (userDetails.email) {
    setDefaultFont();
    doc.text(userDetails.email, 120, infoY);
  }

  // ═══════════════════════════════════════════════════════════════
  // ITEMS TABLE - Royal Teal Theme with 5 Columns
  // ═══════════════════════════════════════════════════════════════
  // Column headers: Sl.No, Item Name, Quantity, Rate, Total
  // Use Tamil headers: வ.எண், பொருள், அளவு, விலை, மொத்தம்
  const tableColumn = [
    hasTamilContent ? t.slNo : 'No.',
    t.item,
    t.quantity,
    t.rate,
    t.total
  ];
  const tableRows: any[][] = [];

  items.forEach((item, index) => {
    tableRows.push([
      (index + 1).toString(),
      item.name,
      item.quantity,
      `₹${item.rate.toFixed(2)}`,
      `₹${(item.total || 0).toFixed(2)}`,
    ]);
  });

  const baseFontSize = hasTamilContent ? 11 : 10;
  const headerFontSize = hasTamilContent ? 12 : 11;

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 100,
    theme: 'plain',
    styles: {
      font: tamilFontLoaded ? 'NotoSansTamil' : 'helvetica',
      fontSize: baseFontSize,
      cellPadding: { top: 8, right: 6, bottom: 8, left: 6 },
      textColor: THEME.text,
      lineColor: THEME.border,
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: THEME.primary,
      textColor: THEME.white,
      fontSize: headerFontSize,
      fontStyle: 'bold',
      cellPadding: { top: 10, right: 6, bottom: 10, left: 6 },
      font: tamilFontLoaded ? 'NotoSansTamil' : 'helvetica',
    },
    bodyStyles: {
      fillColor: THEME.white,
    },
    alternateRowStyles: {
      fillColor: THEME.lightBg,
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center', font: 'helvetica' },
      1: { cellWidth: 'auto', font: tamilFontLoaded ? 'NotoSansTamil' : 'helvetica' },
      2: { cellWidth: 30, halign: 'center', font: tamilFontLoaded ? 'NotoSansTamil' : 'helvetica' },
      3: { cellWidth: 32, halign: 'right', font: 'helvetica' },
      4: { cellWidth: 36, halign: 'right', fontStyle: 'bold', textColor: THEME.primaryDark, font: 'helvetica' },
    },
    didParseCell: (data) => {
      // Ensure Tamil font for Tamil text in item names
      if (data.column.index === 1 && data.cell.raw && typeof data.cell.raw === 'string') {
        if (tamilFontLoaded && containsTamil(data.cell.raw)) {
          data.cell.styles.font = 'NotoSansTamil';
        }
      }
      // Ensure Tamil font for Tamil text in quantity column
      if (data.column.index === 2 && data.cell.raw && typeof data.cell.raw === 'string') {
        if (tamilFontLoaded && containsTamil(data.cell.raw)) {
          data.cell.styles.font = 'NotoSansTamil';
        }
      }
    },
    margin: { left: 10, right: 10 },
    tableLineColor: THEME.border,
    tableLineWidth: 0.5,
  });

  // ═══════════════════════════════════════════════════════════════
  // GRAND TOTAL BOX - Royal Teal with Gold Accent
  // ═══════════════════════════════════════════════════════════════
  const finalY = (doc as any).lastAutoTable.finalY + 14;
  
  // Box shadow
  doc.setFillColor(180, 180, 180);
  doc.roundedRect(pageWidth - 102, finalY + 2, 90, 30, 6, 6, 'F');
  
  // Main teal box
  doc.setFillColor(...THEME.primaryDark);
  doc.roundedRect(pageWidth - 100, finalY, 90, 30, 6, 6, 'F');
  
  // Gold border
  doc.setDrawColor(...THEME.accent);
  doc.setLineWidth(2);
  doc.roundedRect(pageWidth - 100, finalY, 90, 30, 6, 6, 'S');
  
  // Small gold accent at top
  doc.setFillColor(...THEME.accent);
  doc.rect(pageWidth - 80, finalY, 40, 2, 'F');
  
  // Total label
  doc.setTextColor(...THEME.white);
  if (hasTamilContent && tamilFontLoaded) {
    doc.setFont('NotoSansTamil', 'normal');
    doc.setFontSize(10);
  } else {
    setDefaultFont();
    doc.setFontSize(10);
  }
  doc.text(t.grandTotal, pageWidth - 92, finalY + 12);
  
  // Total amount with gold color
  doc.setTextColor(...THEME.accent);
  doc.setFontSize(18);
  setDefaultBold();
  doc.text(`₹${grandTotal.toFixed(2)}`, pageWidth - 16, finalY + 24, { align: 'right' });

  // ═══════════════════════════════════════════════════════════════
  // FOOTER - Elegant Design
  // ═══════════════════════════════════════════════════════════════
  const footerY = finalY + 50;
  
  // Decorative divider line
  doc.setDrawColor(...THEME.primary);
  doc.setLineWidth(1);
  doc.line(10, footerY - 10, pageWidth - 10, footerY - 10);
  
  // Center decoration (teal dots)
  doc.setFillColor(...THEME.primary);
  doc.circle(pageWidth / 2 - 15, footerY - 10, 1.8, 'F');
  doc.circle(pageWidth / 2, footerY - 10, 2.5, 'F');
  doc.circle(pageWidth / 2 + 15, footerY - 10, 1.8, 'F');
  
  // Gold dot in center
  doc.setFillColor(...THEME.accent);
  doc.circle(pageWidth / 2, footerY - 10, 1, 'F');
  
  // App branding
  doc.setFontSize(8);
  doc.setTextColor(...THEME.textLight);
  setDefaultFont();
  doc.text('Generated by VoiceBill App', 14, footerY);
  
  // Bill reference
  const billRef = `REF: VB-${Date.now().toString(36).toUpperCase()}`;
  doc.text(billRef, pageWidth - 14, footerY, { align: 'right' });
  
  // Thank you message
  doc.setFontSize(10);
  doc.setTextColor(...THEME.primary);
  if (hasTamilContent && tamilFontLoaded) {
    doc.setFont('NotoSansTamil', 'normal');
    doc.text('நன்றி! மீண்டும் வாருங்கள்', pageWidth / 2, footerY + 10, { align: 'center' });
  } else {
    setDefaultFont();
    doc.text('Thank you for your business!', pageWidth / 2, footerY + 10, { align: 'center' });
  }
  
  // Bottom teal strip
  doc.setFillColor(...THEME.primaryLight);
  doc.rect(0, footerY + 18, pageWidth, 3, 'F');

  // ═══════════════════════════════════════════════════════════════
  // SAVE PDF
  // ═══════════════════════════════════════════════════════════════
  const fileName = `VoiceBill_${new Date().toISOString().slice(0, 10)}_${Date.now()}.pdf`;
  doc.save(fileName);
  
  return fileName;
};
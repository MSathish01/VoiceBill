import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { BillItem, UserDetails, Language, Translation } from '../types';
import { formalizeTamilForPDF } from './tamilLinguisticEngine';

/**
 * Wait for fonts to be loaded before rendering
 */
const waitForFonts = async (): Promise<void> => {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  await new Promise(resolve => setTimeout(resolve, 100));
};

/**
 * Encode data to Base64 (handles UTF-8/Tamil characters)
 */
const encodeDataToBase64 = (data: object): string => {
  const jsonString = JSON.stringify(data);
  // Use TextEncoder for proper UTF-8 handling of Tamil characters
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(jsonString);
  // Convert to base64
  let binary = '';
  uint8Array.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

/**
 * Interface for embedded PDF data
 */
interface EmbeddedPDFData {
  version: string;
  items: BillItem[];
  customer: UserDetails;
  grandTotal: number;
  language: Language;
  generatedAt: string;
}

/**
 * Generate PDF using HTML rendering for proper Tamil Unicode support.
 * Embeds a hidden JSON data layer for reliable extraction.
 */
export const generatePDFWithTamilSupport = async (
  items: BillItem[],
  customer: UserDetails,
  grandTotal: number,
  language: Language,
  t: Translation
): Promise<void> => {
  await waitForFonts();
  
  const isTamil = language === 'ta';
  const today = new Date();
  const dateStr = today.toLocaleDateString(isTamil ? 'ta-IN' : 'en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Process items for Tamil display
  const processedItems = items.map((item) => ({
    ...item,
    name: isTamil ? formalizeTamilForPDF(item.name) : item.name,
    quantity: isTamil ? formalizeTamilForPDF(item.quantity.toString()) : item.quantity.toString(),
  }));

  const tamilFontFamily = "'Noto Sans Tamil', 'Mukta Malar', 'Latha', 'Vijaya', Arial, sans-serif";

  // Create HTML template for the bill
  const htmlContent = `
    <div id="pdf-content" style="
      width: 595px;
      padding: 0;
      font-family: ${tamilFontFamily};
      background: white;
      color: #212529;
      line-height: 1.5;
    ">
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, #22d3ee, #06b6d4);
        padding: 25px 20px;
        text-align: center;
        color: white;
      ">
        <h1 style="margin: 0; font-size: 26px; font-weight: 600;">
          ${customer.pdfTitle || (isTamil ? 'தினசரி வீட்டு பில்' : 'Daily Home Bill')}
        </h1>
        <p style="margin: 10px 0 0 0; font-size: 13px; opacity: 0.9;">
          ${dateStr}
        </p>
      </div>

      <!-- Items Table -->
      <div style="margin: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: linear-gradient(135deg, #22d3ee, #06b6d4); color: white;">
              <th style="padding: 12px 8px; text-align: center; border: 1px solid #0891b2; width: 50px;">
                ${isTamil ? 'வ.எண்' : 'S.No'}
              </th>
              <th style="padding: 12px 8px; text-align: left; border: 1px solid #0891b2;">
                ${isTamil ? 'பொருள்' : 'Item'}
              </th>
              <th style="padding: 12px 8px; text-align: center; border: 1px solid #0891b2; width: 90px;">
                ${isTamil ? 'அளவு' : 'Qty'}
              </th>
              <th style="padding: 12px 8px; text-align: right; border: 1px solid #0891b2; width: 85px;">
                ${isTamil ? 'விலை (₹)' : 'Rate (₹)'}
              </th>
              <th style="padding: 12px 8px; text-align: right; border: 1px solid #0891b2; width: 85px;">
                ${isTamil ? 'மொத்தம் (₹)' : 'Total (₹)'}
              </th>
            </tr>
          </thead>
          <tbody>
            ${processedItems.map((item, index) => `
              <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
                <td style="padding: 10px 8px; text-align: center; border: 1px solid #dee2e6;">${index + 1}</td>
                <td style="padding: 10px 8px; text-align: left; border: 1px solid #dee2e6;">${item.name}</td>
                <td style="padding: 10px 8px; text-align: center; border: 1px solid #dee2e6;">${item.quantity}</td>
                <td style="padding: 10px 8px; text-align: right; border: 1px solid #dee2e6;">${item.rate.toFixed(2)}</td>
                <td style="padding: 10px 8px; text-align: right; border: 1px solid #dee2e6;">${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Grand Total -->
      <div style="margin: 20px; text-align: right;">
        <div style="
          display: inline-block;
          background: linear-gradient(135deg, #4ade80, #22c55e);
          color: white;
          padding: 14px 28px;
          border-radius: 8px;
          font-size: 18px;
          font-weight: 700;
        ">
          ${isTamil ? 'மொத்தம்' : 'Total'}: ₹${grandTotal.toFixed(2)}
        </div>
      </div>

      <!-- Customer Info -->
      <div style="
        margin: 20px;
        padding: 15px 20px;
        background: #f8f9fa;
        border-radius: 8px;
        border-left: 4px solid #22d3ee;
      ">
        <div style="display: flex; flex-wrap: wrap; gap: 8px 40px;">
          <p style="margin: 0; font-size: 14px; min-width: 200px;">
            <strong>${isTamil ? 'வாடிக்கையாளர்' : 'Customer'}:</strong> ${customer.name || '-'}
          </p>
          <p style="margin: 0; font-size: 14px; min-width: 200px;">
            <strong>${isTamil ? 'தொலைபேசி' : 'Mobile'}:</strong> ${customer.mobile || '-'}
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="
        margin-top: 30px;
        padding: 20px;
        background: #f8fafc;
        text-align: center;
        border-top: 3px solid #22d3ee;
      ">
        <p style="margin: 0 0 8px 0;">
          <a href="https://www.smartgonext.com/" style="color: #0891b2; text-decoration: none; font-size: 14px; font-weight: 700;">
            SmartGoNext Software Solution
          </a>
        </p>
        <p style="margin: 0; font-size: 11px; color: #64748b;">
          ${isTamil ? 'VoiceBill மூலம் உருவாக்கப்பட்டது | நன்றி!' : 'Generated by VoiceBill | Thank you!'}
        </p>
      </div>
    </div>
  `;

  // Create temporary container
  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  const element = container.querySelector('#pdf-content') as HTMLElement;

  try {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    const imgData = canvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, Math.min(imgHeight, pdfHeight));
    
    // ===== EMBED HIDDEN JSON DATA FOR EXTRACTION =====
    // Prepare data object with all bill information
    const embeddedData: EmbeddedPDFData = {
      version: '2.0',
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        rate: item.rate,
        total: item.total
      })),
      customer: {
        name: customer.name || '',
        address: customer.address || '',
        mobile: customer.mobile || '',
        email: customer.email || '',
        pdfTitle: customer.pdfTitle || ''
      },
      grandTotal,
      language,
      generatedAt: today.toISOString()
    };
    
    // Encode to Base64 for safe embedding (handles Tamil UTF-8)
    const base64Data = encodeDataToBase64(embeddedData);
    
    // Create the hidden data string with markers
    const hiddenDataString = `<!--VOICEBILL_JSON_START-->${base64Data}<!--VOICEBILL_JSON_END-->`;
    
    // Add invisible text layer at the bottom of the PDF
    // Using very small white text that won't be visible but can be extracted
    pdf.setFontSize(1);
    pdf.setTextColor(255, 255, 255); // White on white = invisible
    
    // Split the data into chunks to fit on the page
    const chunkSize = 200;
    const chunks: string[] = [];
    for (let i = 0; i < hiddenDataString.length; i += chunkSize) {
      chunks.push(hiddenDataString.substring(i, i + chunkSize));
    }
    
    // Place chunks at the very bottom of the page
    let yPosition = pdfHeight - 1;
    chunks.forEach((chunk) => {
      pdf.text(chunk, 1, yPosition);
      yPosition -= 0.5;
    });
    
    // Save PDF
    const fileName = `bill_${customer.name || 'customer'}_${today.toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    
  } finally {
    document.body.removeChild(container);
  }
};

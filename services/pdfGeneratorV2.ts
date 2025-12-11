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
  // Additional delay to ensure fonts are fully loaded
  await new Promise(resolve => setTimeout(resolve, 100));
};

/**
 * Generate PDF using HTML rendering for proper Tamil Unicode support.
 * This approach renders Tamil text through the browser's text engine
 * which properly handles complex script shaping and ligatures.
 */
export const generatePDFWithTamilSupport = async (
  items: BillItem[],
  customer: UserDetails,
  grandTotal: number,
  language: Language,
  t: Translation
): Promise<void> => {
  // Wait for fonts to be loaded
  await waitForFonts();
  
  const isTamil = language === 'ta';
  const today = new Date();
  const dateStr = today.toLocaleDateString(isTamil ? 'ta-IN' : 'en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Process items for Tamil
  const processedItems = items.map((item, index) => ({
    ...item,
    name: isTamil ? formalizeTamilForPDF(item.name) : item.name,
    quantity: isTamil ? formalizeTamilForPDF(item.quantity.toString()) : item.quantity.toString(),
  }));

  // Font family for Tamil - use web fonts
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
        background: linear-gradient(135deg, #008080, #006666);
        padding: 25px 20px;
        text-align: center;
        color: white;
      ">
        <h1 style="margin: 0; font-size: 26px; font-weight: 600; font-family: ${tamilFontFamily};">
          ${isTamil ? 'தினசரி வீட்டு பில்' : 'Daily Home Bill'}
        </h1>
        <p style="margin: 10px 0 0 0; font-size: 13px; opacity: 0.9; font-family: ${tamilFontFamily};">
          ${dateStr}
        </p>
      </div>

      <!-- Items Table -->
      <div style="margin: 20px;">
        <table style="
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          font-family: ${tamilFontFamily};
        ">
          <thead>
            <tr style="background: #008080; color: white;">
              <th style="padding: 12px 8px; text-align: center; border: 1px solid #006666; width: 50px; font-family: ${tamilFontFamily};">
                ${isTamil ? 'வ.எண்' : 'S.No'}
              </th>
              <th style="padding: 12px 8px; text-align: left; border: 1px solid #006666; font-family: ${tamilFontFamily};">
                ${isTamil ? 'பொருள்' : 'Item'}
              </th>
              <th style="padding: 12px 8px; text-align: center; border: 1px solid #006666; width: 90px; font-family: ${tamilFontFamily};">
                ${isTamil ? 'அளவு' : 'Qty'}
              </th>
              <th style="padding: 12px 8px; text-align: right; border: 1px solid #006666; width: 85px; font-family: ${tamilFontFamily};">
                ${isTamil ? 'விலை (₹)' : 'Rate (₹)'}
              </th>
              <th style="padding: 12px 8px; text-align: right; border: 1px solid #006666; width: 85px; font-family: ${tamilFontFamily};">
                ${isTamil ? 'மொத்தம் (₹)' : 'Total (₹)'}
              </th>
            </tr>
          </thead>
          <tbody>
            ${processedItems.map((item, index) => `
              <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
                <td style="padding: 10px 8px; text-align: center; border: 1px solid #dee2e6; font-family: ${tamilFontFamily};">
                  ${index + 1}
                </td>
                <td style="padding: 10px 8px; text-align: left; border: 1px solid #dee2e6; font-family: ${tamilFontFamily};">
                  ${item.name}
                </td>
                <td style="padding: 10px 8px; text-align: center; border: 1px solid #dee2e6; font-family: ${tamilFontFamily};">
                  ${item.quantity}
                </td>
                <td style="padding: 10px 8px; text-align: right; border: 1px solid #dee2e6; font-family: ${tamilFontFamily};">
                  ${item.rate.toFixed(2)}
                </td>
                <td style="padding: 10px 8px; text-align: right; border: 1px solid #dee2e6; font-family: ${tamilFontFamily};">
                  ${item.total.toFixed(2)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Grand Total -->
      <div style="
        margin: 20px;
        text-align: right;
      ">
        <div style="
          display: inline-block;
          background: linear-gradient(135deg, #008080, #006666);
          color: white;
          padding: 14px 28px;
          border-radius: 8px;
          font-size: 18px;
          font-weight: 600;
          font-family: ${tamilFontFamily};
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
        border-left: 4px solid #008080;
      ">
        <div style="display: flex; flex-wrap: wrap; gap: 8px 40px;">
          <p style="margin: 0; font-size: 14px; font-family: ${tamilFontFamily}; min-width: 200px;">
            <strong>${isTamil ? 'வாடிக்கையாளர்' : 'Customer'}:</strong> ${customer.name || '-'}
          </p>
          <p style="margin: 0; font-size: 14px; font-family: ${tamilFontFamily}; min-width: 200px;">
            <strong>${isTamil ? 'தொலைபேசி' : 'Mobile'}:</strong> ${customer.mobile || '-'}
          </p>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px 40px; margin-top: 8px;">
          <p style="margin: 0; font-size: 14px; font-family: ${tamilFontFamily}; min-width: 200px;">
            <strong>${isTamil ? 'முகவரி' : 'Address'}:</strong> ${customer.address || '-'}
          </p>
          <p style="margin: 0; font-size: 14px; font-family: ${tamilFontFamily}; min-width: 200px;">
            <strong>${isTamil ? 'மின்னஞ்சல்' : 'Email'}:</strong> ${customer.email || '-'}
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="
        margin-top: 30px;
        padding: 15px 20px;
        background: #f8f9fa;
        text-align: center;
        font-family: ${tamilFontFamily};
      ">
        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600;">
          <a href="https://www.smartgonext.com/" style="color: #008080; text-decoration: none;">
            SmartGoNext Software Solution
          </a>
        </p>
        <p style="margin: 0; font-size: 11px; color: #6c757d;">
          ${isTamil 
            ? 'VoiceBill மூலம் உருவாக்கப்பட்டது | நன்றி!' 
            : 'Generated by VoiceBill | Thank you!'}
        </p>
      </div>
    </div>
  `;

  // Create a temporary container
  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  const element = container.querySelector('#pdf-content') as HTMLElement;

  try {
    // Small delay to ensure DOM is rendered with fonts
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Use html2canvas to render the HTML with proper font support
    const canvas = await html2canvas(element, {
      scale: 2, // Higher resolution for crisp text
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
    });

    // Create PDF from canvas - A4 size
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate scaling to fit A4
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    const imgData = canvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, Math.min(imgHeight, pdfHeight));
    
    // Save PDF
    const fileName = `bill_${customer.name || 'customer'}_${today.toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
};

import React, { useRef, useState, DragEvent } from 'react';
import { BillItem, Language } from '../types';
import { extractItemsFromPDF } from '../services/pdfExtractor';

interface PdfUploadProps {
  language: Language;
  onItemsExtracted: (items: BillItem[]) => void;
}

const PdfUpload: React.FC<PdfUploadProps> = ({ language, onItemsExtracted }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error' | 'ocr'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');

  const processFile = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      setUploadStatus('error');
      setErrorMessage(language === 'ta' ? 'PDF கோப்பு மட்டும்' : 'Only PDF files allowed');
      setTimeout(() => {
        setUploadStatus('idle');
        setErrorMessage('');
      }, 3000);
      return;
    }

    setIsProcessing(true);
    setUploadStatus('idle');
    setErrorMessage('');
    setProgressMessage('');

    try {
      // Extract items from PDF (try OCR fallback, and receive progress)
      const extractedItems = await extractItemsFromPDF(file, {
        tryOcr: true,
        onProgress: (msg) => setProgressMessage(msg)
      });
      
      if (extractedItems.length === 0) {
        setUploadStatus('error');
        setErrorMessage(language === 'ta' 
          ? 'பொருட்கள் கண்டுபிடிக்கப்படவில்லை' 
          : 'No items found in PDF');
        setTimeout(() => {
          setUploadStatus('idle');
          setErrorMessage('');
          setProgressMessage('');
        }, 5000);
      } else {
        setUploadStatus('success');
        onItemsExtracted(extractedItems);
        
        // Reset after 2 seconds
        setTimeout(() => {
          setUploadStatus('idle');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setProgressMessage('');
        }, 2000);
      }
    } catch (error: any) {
      console.error('PDF upload error:', error);
      setUploadStatus('error');
      let detailedError = error?.message || 'Unknown error';
      // Special handling for no text content
      if (detailedError.includes('No text content found in PDF')) {
        detailedError = language === 'ta'
          ? 'இந்த PDF-ல் உரை உள்ளடக்கம் இல்லை. இது ஒரு ஸ்கேன் செய்யப்பட்ட PDF அல்லது படமாக இருக்கலாம். நான் OCR முயற்சி செய்தேன் ஆனால் உரையை கண்டுபிடிக்க முடியவில்லை. தயவுசெய்து PDF-ஐ OCR-ஆக மாற்றி மீண்டும் பதிவேற்றவும்.'
          : 'No text content found in this PDF. It seems to be image-only. I attempted OCR but could not extract usable text. Please convert the PDF to text (OCR) and try again.';
      } else {
        detailedError = language === 'ta'
          ? `PDF பதிவேற்றம் தோல்வி: ${detailedError}`
          : `Failed to process PDF: ${detailedError}`;
      }
      setErrorMessage(detailedError);
      setTimeout(() => {
        setUploadStatus('idle');
        setErrorMessage('');
        setProgressMessage('');
      }, 10000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const isTamil = language === 'ta';

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200 shadow-lg">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
            <i className="fas fa-file-upload text-white text-xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800">
              {isTamil ? 'PDF பதிவேற்றம்' : 'Upload PDF'}
            </h3>
            <p className="text-sm text-gray-600">
              {isTamil 
                ? 'முன்பு உருவாக்கிய PDF ஐ பதிவேற்றவும்' 
                : 'Upload a previously generated bill PDF'}
            </p>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onClick={handleUploadClick}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-3 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-all duration-300 ease-in-out
            ${isDragging 
              ? 'border-purple-500 bg-purple-100 scale-[1.02]' 
              : 'border-purple-300 bg-white hover:bg-purple-50 hover:border-purple-400'
            }
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <div className="flex flex-col items-center gap-4">
            <div className={`
              w-20 h-20 rounded-full flex items-center justify-center transition-all
              ${isDragging ? 'bg-purple-500 scale-110' : 'bg-purple-100'}
            `}>
              <i className={`
                text-4xl transition-all
                ${isDragging ? 'fas fa-cloud-upload-alt text-white' : 'fas fa-file-pdf text-purple-500'}
              `}></i>
            </div>
            
            {isProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <i className="fas fa-spinner fa-spin text-3xl text-purple-500"></i>
                <p className="text-purple-600 font-semibold">
                  {isTamil ? 'செயல்படுத்துிறது...' : 'Processing...'}
                </p>
                {progressMessage && (
                  <p className="text-sm text-gray-500 mt-1">{progressMessage}</p>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-lg font-semibold text-gray-700">
                    {isTamil ? 'PDF ஐ இங்கே இழுத்து விடவும்' : 'Drag & Drop PDF here'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isTamil ? 'அல்லது' : 'or'}
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold 
                      bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-md 
                      hover:shadow-lg active:scale-95"
                  >
                    <i className="fas fa-folder-open"></i>
                    {isTamil ? 'கோப்பு தேர்வு செய்யவும்' : 'Browse Files'}
                  </button>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                  <i className="fas fa-info-circle"></i>
                  <span>{isTamil ? 'PDF கோப்புகள் மட்டும் ஏற்றுக்கொள்ளப்படும்' : 'Only PDF files are accepted'}</span>
                </div>
              </>
            )}
          </div>
        </div>
          
        {/* Status Messages */}
        {uploadStatus === 'success' && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border-2 border-green-200 rounded-lg animate-fade-in-up">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="fas fa-check-circle text-white text-lg"></i>
            </div>
            <div className="flex-1">
              <p className="text-green-700 font-semibold">
                {isTamil ? 'வெற்றி!' : 'Success!'}
              </p>
              <p className="text-green-600 text-sm">
                {isTamil ? 'பொருட்கள் வெற்றிகரமாக பிரித்தெடுக்கப்பட்டன' : 'Items extracted successfully'}
              </p>
            </div>
          </div>
        )}
        
        {uploadStatus === 'error' && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-lg animate-fade-in-up">
            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="fas fa-exclamation-circle text-white text-lg"></i>
            </div>
            <div className="flex-1">
              <p className="text-red-700 font-semibold">
                {isTamil ? 'பிழை!' : 'Error!'}
              </p>
              <p className="text-red-600 text-sm" dangerouslySetInnerHTML={{ __html: errorMessage }} />
            </div>
          </div>
        )}
      
        {/* Info Box */}
        <div className="mt-4 bg-white/70 rounded-lg p-4 border border-purple-200">
        <div className="flex items-start gap-3">
          <i className="fas fa-lightbulb text-purple-500 mt-1 text-lg"></i>
          <div className="flex-1">
            <p className="font-semibold text-gray-700 mb-2 text-sm">
              {isTamil ? '💡 குறிப்பு:' : '💡 How it works:'}
            </p>
            <ul className="space-y-1.5 text-xs text-gray-600">
              <li className="flex items-start gap-2">
                <i className="fas fa-check text-purple-500 mt-0.5 text-xs"></i>
                <span>{isTamil ? 'இந்த திட்டத்தில் உருவாக்கப்பட்ட PDF சிறந்தது' : 'Best with PDFs generated by this app'}</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-check text-purple-500 mt-0.5 text-xs"></i>
                <span>{isTamil ? 'பொருட்கள் தானாகவே நிரப்பப்படும்' : 'Items will auto-populate the list'}</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-check text-purple-500 mt-0.5 text-xs"></i>
                <span>{isTamil ? 'திருத்த இடைமுகம் தானாக திறக்கும்' : 'Edit interface opens automatically'}</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-check text-purple-500 mt-0.5 text-xs"></i>
                <span>{isTamil ? 'தேவைக்கேற்ப திருத்தி புதிய PDF உருவாக்கவும்' : 'Edit items and generate new PDF'}</span>
              </li>
            </ul>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default PdfUpload;

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Language, BillItem, UserDetails } from './types';
import { TRANSLATIONS } from './constants';
import { parseContinuousInput } from './services/voiceParser';
import { generatePDF } from './services/pdfGenerator';
import VoiceControls from './components/VoiceControls';
import CustomerForm from './components/CustomerForm';

const App: React.FC = () => {
  // --- State ---
  const [language, setLanguage] = useState<Language>('en');
  
  // Confirmed Items: Items that have been "committed" (manually or after voice session ends)
  const [confirmedItems, setConfirmedItems] = useState<BillItem[]>([]);
  
  // Live Items: Items currently being parsed from the active voice session
  const [liveItems, setLiveItems] = useState<BillItem[]>([]);

  const [userDetails, setUserDetails] = useState<UserDetails>({
    name: '',
    address: '',
    mobile: '',
    email: ''
  });
  const [isListening, setIsListening] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Manual Input State
  const [newItem, setNewItem] = useState<{name: string, quantity: string, rate: string}>({
    name: '', quantity: '', rate: ''
  });

  // Refs
  const nameInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);
  const scrollEndRef = useRef<HTMLTableRowElement>(null);

  const t = TRANSLATIONS[language];

  // --- Calculations ---
  // Combine confirmed and live items for display
  const allItems = useMemo(() => {
    return [...confirmedItems, ...liveItems];
  }, [confirmedItems, liveItems]);

  const grandTotal = useMemo(() => {
    return allItems.reduce((sum, item) => sum + item.total, 0);
  }, [allItems]);

  // --- Effects ---
  // Auto-scroll to bottom when list grows
  useEffect(() => {
    // Always scroll if listening and items exist, or if a new confirmed item was added
    if (allItems.length > 0) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [allItems.length, isListening, liveItems]);

  // --- Handlers ---
  const handleLanguageToggle = () => {
    setLanguage(prev => prev === 'en' ? 'ta' : 'en');
  };

  // Called repeatedly as the user speaks
  const handleVoiceTranscriptChange = useCallback((transcript: string) => {
    if (!transcript) {
      setLiveItems([]);
      return;
    }

    // Parse the entire streaming transcript
    const parsedDataList = parseContinuousInput(transcript);

    // Convert parsed data to BillItems
    const tempItems: BillItem[] = parsedDataList.map((p, idx) => {
        const rate = p.rate || 0;
        return {
          id: `live-${idx}`, // Stable ID for live items based on index
          name: p.name || '',
          quantity: p.quantity || '',
          rate: rate,
          total: rate,
          isLive: true
        };
    });

    setLiveItems(tempItems);
  }, []);

  // Called when user stops speaking
  const handleVoiceListeningEnd = useCallback(() => {
    if (liveItems.length > 0) {
      // Commit live items to confirmed list
      const committedItems = liveItems.map(item => ({
        ...item,
        id: uuidv4(), // Final ID
        isLive: false,
        name: item.name || 'Unknown Item', // Fallback
      }));
      
      setConfirmedItems(prev => [...prev, ...committedItems]);
      setLiveItems([]); // Clear live buffer
    }
  }, [liveItems]);

  const handleManualAdd = () => {
    if (!newItem.name) return;
    
    // Default rate to 0 if empty
    const rateVal = newItem.rate ? parseFloat(newItem.rate) : 0;
    
    const billItem: BillItem = {
      id: uuidv4(),
      name: newItem.name,
      quantity: newItem.quantity || '1',
      rate: rateVal,
      total: rateVal
    };
    
    setConfirmedItems(prev => [...prev, billItem]);
    setNewItem({ name: '', quantity: '', rate: '' });
    
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
  };

  const handleManualClear = () => {
    setNewItem({ name: '', quantity: '', rate: '' });
    nameInputRef.current?.focus();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // CRITICAL: Stop event from bubbling up to row click
    e.preventDefault();

    const confirmMessage = language === 'ta'
      ? "இந்த உருப்படியை நீக்கவா?"
      : "Delete this item?";

    if (window.confirm(confirmMessage)) {
      setConfirmedItems(prev => prev.filter(i => i.id !== id));
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation(); // CRITICAL
    e.preventDefault();
    
    const confirmMessage = language === 'ta'
      ? "அனைத்தையும் அழிக்கவா?"
      : "Clear entire list?";

    if (window.confirm(confirmMessage)) {
        setConfirmedItems([]);
        setLiveItems([]);
        setNewItem({ name: '', quantity: '', rate: '' });
    }
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      await generatePDF(allItems, userDetails, t, grandTotal);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Something went wrong while generating the PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getLiveStatus = () => {
    if (!isListening) return null;
    if (liveItems.length === 0) return "Say an item (e.g., 'Tomato')...";
    
    const lastItem = liveItems[liveItems.length - 1];
    if (!lastItem.name) return "Say Item Name...";
    if (!lastItem.quantity) return `Got ${lastItem.name}. Say Quantity...`;
    if (!lastItem.rate) return `Got ${lastItem.quantity}. Say Rate...`;
    
    return "Say Rate to finish row...";
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 pb-20">
      
      {/* Header & Language Toggle */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <i className="fas fa-file-invoice-dollar"></i>
            {t.title}
          </h1>
          
          <button 
            type="button"
            onClick={handleLanguageToggle}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium border border-gray-300"
          >
            <span className={language === 'en' ? 'text-primary font-bold' : 'text-gray-500'}>ENG</span>
            <span className="text-gray-300">|</span>
            <span className={language === 'ta' ? 'text-primary font-bold' : 'text-gray-500'}>தமிழ்</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-6">
        
        {/* Paper Container */}
        <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200 min-h-[600px] mb-24">
          
          {/* Voice Control Section */}
          <VoiceControls 
            language={language}
            onTranscriptChange={handleVoiceTranscriptChange}
            onListeningEnd={handleVoiceListeningEnd}
            isListening={isListening}
            setIsListening={setIsListening}
            hintText={t.micHint}
          />

          {/* Billing Table */}
          <div className="p-0 overflow-x-auto relative">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                  <th className="p-4 w-12 text-center">{t.slNo}</th>
                  <th className="p-4">{t.item}</th>
                  <th className="p-4 w-28">{t.quantity}</th>
                  <th className="p-4 w-28 text-right">{t.rate}</th>
                  <th className="p-4 w-20 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allItems.length === 0 && !isListening && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                      List is empty. Tap the mic to add items.
                    </td>
                  </tr>
                )}
                
                {allItems.map((item, index) => (
                  <tr 
                    key={item.id} 
                    className={`transition-all duration-300 animate-fade-in-up group ${
                      item.isLive 
                        ? 'bg-blue-50/80 border-l-4 border-blue-500 shadow-inner' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-4 text-center text-gray-500 text-sm">{index + 1}</td>
                    
                    {/* Item Name Cell */}
                    <td className="p-4 font-medium text-gray-700">
                      {item.isLive && !item.name ? (
                         <span className="text-blue-400 italic text-sm animate-pulse flex items-center gap-1">
                           <i className="fas fa-comment-dots"></i> Say Item...
                         </span>
                      ) : (
                        <span>{item.name}</span>
                      )}
                    </td>

                    {/* Quantity Cell */}
                    <td className="p-4 text-gray-600 text-sm">
                       {item.isLive && !item.quantity ? (
                         item.name ? <span className="text-blue-400 italic text-xs animate-pulse">Say Qty...</span> : '-'
                       ) : (
                         <span>{item.quantity}</span>
                       )}
                    </td>

                    {/* Rate Cell */}
                    <td className="p-4 text-right font-semibold text-gray-800">
                        {item.isLive && item.rate === 0 ? (
                           (item.quantity || item.name) ? <span className="text-blue-400 italic text-xs animate-pulse">Say Rate...</span> : '-'
                        ) : (
                            <span>₹{item.rate.toFixed(2)}</span>
                        )}
                    </td>

                    {/* Delete Action - Enhanced */}
                    <td className="p-4 text-center">
                      {!item.isLive && (
                        <button 
                          type="button"
                          onClick={(e) => handleDelete(item.id, e)}
                          className="bg-white border border-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all w-8 h-8 rounded-full flex items-center justify-center shadow-sm cursor-pointer mx-auto"
                          title={t.delete}
                        >
                          <i className="fas fa-trash-alt text-xs pointer-events-none"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                
                {/* Manual Entry Row */}
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="p-2 text-center text-gray-400 text-xs font-bold">+</td>
                  <td className="p-2">
                    <input 
                      ref={nameInputRef}
                      type="text" 
                      placeholder={t.item}
                      value={newItem.name}
                      onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          quantityInputRef.current?.focus();
                        }
                      }}
                      className="w-full bg-white border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      ref={quantityInputRef}
                      type="text" 
                      placeholder="Qty"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          rateInputRef.current?.focus();
                        }
                      }}
                      className="w-full bg-white border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      ref={rateInputRef}
                      type="number" 
                      placeholder="0.00"
                      value={newItem.rate}
                      onChange={(e) => setNewItem({...newItem, rate: e.target.value})}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
                      className="w-full bg-white border border-gray-300 rounded px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
                    />
                  </td>
                  <td className="p-2 flex items-center justify-center gap-1">
                    <button 
                      type="button"
                      onClick={handleManualAdd}
                      className="bg-primary text-white rounded-md w-9 h-9 flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm"
                      title={t.addItem}
                    >
                      <i className="fas fa-check"></i>
                    </button>
                     <button 
                      type="button"
                      onClick={handleManualClear}
                      className="bg-white border border-gray-300 text-gray-500 rounded-md w-9 h-9 flex items-center justify-center hover:bg-gray-100 transition-colors shadow-sm"
                      title="Clear"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </td>
                </tr>
                
                {/* Scroll Anchor */}
                <tr ref={scrollEndRef}></tr>
              </tbody>
            </table>
          </div>

           {/* Grand Total Footer */}
           <div className="bg-gray-100 p-4 border-t-2 border-gray-300 flex justify-between items-center">
              <span className="font-bold text-gray-600 uppercase text-sm tracking-wide">
                {t.grandTotal}
              </span>
              <span className="font-bold text-2xl text-blue-600">
                ₹{grandTotal.toFixed(2)}
              </span>
          </div>

          {/* Customer Form Area */}
          <div className="p-6 bg-white border-t border-gray-200">
            <CustomerForm details={userDetails} onChange={setUserDetails} t={t} />
          </div>

          {/* Action Footer */}
          <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <button 
              type="button"
              onClick={handleClearAll}
              className="text-sm text-red-500 hover:text-red-700 font-medium px-4 py-2 border border-red-100 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              <i className="fas fa-trash-alt mr-2 pointer-events-none"></i>
              {t.clearAll}
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={allItems.length === 0 || isGeneratingPdf}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold shadow-md transition-all transform hover:scale-105 ${
                allItems.length === 0 || isGeneratingPdf
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isGeneratingPdf ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Processing...
                </>
              ) : (
                <>
                  <i className="fas fa-file-pdf"></i>
                  {t.downloadPdf}
                </>
              )}
            </button>
          </div>

        </div>
        
        {/* Helper Footer for Voice - Dynamic Status Bar */}
        {isListening && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-blue-200 p-3 shadow-2xl z-30 animate-fade-in-up">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                         <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                         <p className="text-sm font-semibold text-gray-700">
                            {getLiveStatus()}
                         </p>
                    </div>
                    <button 
                        type="button"
                        onClick={() => setIsListening(false)} 
                        className="bg-red-100 text-red-600 text-xs px-3 py-1 rounded-full font-bold hover:bg-red-200"
                    >
                        STOP
                    </button>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
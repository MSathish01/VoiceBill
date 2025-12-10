import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Language, BillItem, UserDetails } from './types';
import { TRANSLATIONS } from './constants';
import { parseContinuousInput } from './services/voiceParser';
import { generatePDF } from './services/pdfGenerator';
import VoiceControls from './components/VoiceControls';
import CustomerForm from './components/CustomerForm';

// Lightweight helper to get numeric quantity ("2 kg" -> 2, "" -> 1)
const parseQuantityNumber = (quantity: string | null): number => {
  if (!quantity) return 1;
  const numeric = parseFloat(quantity);
  return Number.isFinite(numeric) ? numeric : 1;
};

// Lightweight voice command parser for deletion/clear actions
const parseDeleteCommand = (text: string):
  | { type: 'delete-last' }
  | { type: 'delete-index'; index: number }
  | { type: 'clear-all' }
  | null => {
  const t = text.toLowerCase();

  // Clear entire list keywords (English + Tamil approximations)
  if (t.includes('clear list') || t.includes('clear all') || t.includes('reset list') || t.includes('முழுவதும்') || t.includes('அழி')) {
    return { type: 'clear-all' };
  }

  // Delete last item keywords
  if (t.includes('delete last') || t.includes('remove last') || t.includes('undo last') || t.includes('கடைசி') || t.includes('முந்தைய')) {
    return { type: 'delete-last' };
  }

  // Delete by index: "delete item 3" / "remove 2" / "item number 4"
  const match = t.match(/(?:delete|remove|item|number|no\.?|நீக்கு|அழி)\s*(?:item\s*)?(\d{1,3})/);
  if (match && match[1]) {
    const idx = parseInt(match[1], 10);
    if (Number.isFinite(idx) && idx > 0) {
      return { type: 'delete-index', index: idx };
    }
  }

  return null;
};

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

  // Central helper to clear everything (usable by UI + voice commands)
  const clearAllItems = () => {
    setConfirmedItems([]);
    setLiveItems([]);
    setNewItem({ name: '', quantity: '', rate: '' });
  };

  // Called repeatedly as the user speaks
  const handleVoiceTranscriptChange = useCallback((transcript: string) => {
    if (!transcript) {
      setLiveItems([]);
      return;
    }

    // Quick voice commands: delete / clear
    const command = parseDeleteCommand(transcript);
    if (command) {
      if (command.type === 'clear-all') {
        clearAllItems();
      } else if (command.type === 'delete-last') {
        setConfirmedItems(prev => prev.slice(0, -1));
      } else if (command.type === 'delete-index') {
        setConfirmedItems(prev => prev.filter((_, idx) => idx !== command.index - 1));
      }
      setLiveItems([]);
      return;
    }

    // Parse the entire streaming transcript
    const parsedDataList = parseContinuousInput(transcript);

    // Convert parsed data to BillItems
    const tempItems: BillItem[] = parsedDataList.map((p, idx) => {
        const rate = p.rate || 0;
        const qtyNum = parseQuantityNumber(p.quantity);
        return {
          id: `live-${idx}`, // Stable ID for live items based on index
          name: p.name || '',
          quantity: p.quantity || '',
          rate: rate,
          total: rate * qtyNum,
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
    const qtyNum = parseQuantityNumber(newItem.quantity);
    
    const billItem: BillItem = {
      id: uuidv4(),
      name: newItem.name,
      quantity: newItem.quantity || '1',
      rate: rateVal,
      total: rateVal * qtyNum
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

  const handleAddSampleItems = () => {
    const samples: BillItem[] = [
      { id: uuidv4(), name: 'Tomato', quantity: '2 kg', rate: 40, total: 80 },
      { id: uuidv4(), name: 'Milk', quantity: '1 ltr', rate: 55, total: 55 },
      { id: uuidv4(), name: 'Bread', quantity: '1', rate: 35, total: 35 }
    ];
    setConfirmedItems(prev => [...prev, ...samples]);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Direct delete without confirmation for faster workflow
    setConfirmedItems(prev => prev.filter(i => i.id !== id));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation(); // CRITICAL
    e.preventDefault();
    
    const confirmMessage = language === 'ta'
      ? "அனைத்தையும் அழிக்கவா?"
      : "Clear entire list?";

    if (window.confirm(confirmMessage)) {
        clearAllItems();
    }
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      await generatePDF(allItems, userDetails, grandTotal, language, t);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Something went wrong while generating the PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getLiveStatus = () => {
    if (!isListening) return null;
    if (liveItems.length === 0) {
      return language === 'ta' 
        ? "பொருளின் பெயரைச் சொல்லுங்கள் (உதா: 'தக்காளி')..." 
        : "Say an item (e.g., 'Tomato')...";
    }
    
    const lastItem = liveItems[liveItems.length - 1];
    if (!lastItem.name) {
      return language === 'ta' ? "பொருளின் பெயரைச் சொல்லுங்கள்..." : "Say Item Name...";
    }
    if (!lastItem.quantity) {
      return language === 'ta' 
        ? `${lastItem.name} கிடைத்தது. அளவு சொல்லுங்கள்...` 
        : `Got ${lastItem.name}. Say Quantity...`;
    }
    if (!lastItem.rate) {
      return language === 'ta' 
        ? `${lastItem.quantity} கிடைத்தது. விலை சொல்லுங்கள்...` 
        : `Got ${lastItem.quantity}. Say Rate...`;
    }
    
    return language === 'ta' ? "விலை சொல்லி முடிக்கவும்..." : "Say Rate to finish row...";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-sky-50 to-white font-sans text-gray-800 pb-20">
      
      {/* Header & Language Toggle - Enhanced */}
      <header className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 shadow-lg sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <i className="fas fa-file-invoice-dollar text-white"></i>
            </div>
            <span className="drop-shadow-sm">{t.title}</span>
          </h1>
          
          <button 
            type="button"
            onClick={handleLanguageToggle}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-all text-sm font-medium border border-white/30 text-white shadow-sm"
          >
            <span className={`transition-all ${language === 'en' ? 'font-bold scale-105' : 'opacity-70'}`}>ENG</span>
            <span className="opacity-50">|</span>
            <span className={`transition-all ${language === 'ta' ? 'font-bold scale-105' : 'opacity-70'}`}>தமிழ்</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-6">

        {/* Quick actions + summary - Enhanced */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <div className="bg-white shadow-md border border-gray-100 rounded-xl p-5 flex flex-col gap-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-gray-500 font-medium">Items</span>
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-shopping-basket text-blue-600 text-sm"></i>
              </div>
            </div>
            <span className="text-3xl font-bold text-gray-800">{allItems.length}</span>
            <span className="text-xs text-gray-400">Live + confirmed</span>
          </div>
          <div className="bg-white shadow-md border border-gray-100 rounded-xl p-5 flex flex-col gap-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-gray-500 font-medium">Grand Total</span>
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-rupee-sign text-emerald-600 text-sm"></i>
              </div>
            </div>
            <span className="text-3xl font-bold text-emerald-600">₹{grandTotal.toFixed(2)}</span>
            <span className="text-xs text-gray-400">Updated in real-time</span>
          </div>
          <div className="bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 text-white rounded-xl p-5 shadow-lg flex flex-col justify-between hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-2">
              <i className="fas fa-wand-magic-sparkles text-purple-200"></i>
              <span className="text-sm font-semibold">Quick Demo</span>
            </div>
            <button
              type="button"
              onClick={handleAddSampleItems}
              className="mt-3 inline-flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white font-semibold px-4 py-2.5 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-inner"
            >
              <i className="fas fa-plus"></i>
              Add Samples
            </button>
          </div>
        </div>
        
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

          {/* Billing Table - Enhanced */}
          <div className="p-0 overflow-x-auto relative">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200 text-xs uppercase text-gray-600 font-bold tracking-wider">
                  <th className="p-4 w-12 text-center">{t.slNo}</th>
                  <th className="p-4">{t.item}</th>
                  <th className="p-4 w-28 text-center">{t.quantity}</th>
                  <th className="p-4 w-28 text-right">{t.total}</th>
                  <th className="p-4 w-20 text-center">
                    <i className="fas fa-cog text-gray-400"></i>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allItems.length === 0 && !isListening && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-microphone text-2xl text-gray-300"></i>
                        </div>
                        <p className="text-gray-500 font-medium">{language === 'ta' ? 'பட்டியல் காலியாக உள்ளது' : 'List is empty'}</p>
                        <p className="text-gray-400 text-sm">{language === 'ta' ? 'மைக்கைத் தட்டி பொருட்களைச் சேர்க்கவும்' : 'Tap the mic to add items'}</p>
                      </div>
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
                    
                    {/* Item Name Cell - Enhanced for Tamil */}
                    <td className="p-4 font-medium text-gray-800">
                      {item.isLive && !item.name ? (
                         <span className="text-blue-400 italic text-sm animate-pulse flex items-center gap-2">
                           <i className="fas fa-comment-dots"></i> 
                           {language === 'ta' ? 'பொருள் சொல்லுங்கள்...' : 'Say Item...'}
                         </span>
                      ) : (
                        <span className="text-base leading-relaxed">{item.name}</span>
                      )}
                    </td>

                    {/* Quantity Cell - Enhanced */}
                    <td className="p-4 text-center">
                       {item.isLive && !item.quantity ? (
                         item.name ? <span className="text-blue-400 italic text-xs animate-pulse">{language === 'ta' ? 'அளவு...' : 'Qty...'}</span> : <span className="text-gray-300">—</span>
                       ) : (
                         <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded-md text-gray-700 text-sm font-medium">{item.quantity}</span>
                       )}
                    </td>

                    {/* Total Cell - Shows item total (rate × quantity) */}
                    <td className="p-4 text-right">
                        {item.isLive && item.rate === 0 ? (
                           (item.quantity || item.name) ? <span className="text-blue-400 italic text-xs animate-pulse">{language === 'ta' ? 'விலை...' : 'Rate...'}</span> : <span className="text-gray-300">—</span>
                        ) : (
                            <span className="font-bold text-emerald-600">₹{item.total.toFixed(2)}</span>
                        )}
                    </td>

                    {/* Delete Action - Always Visible for Confirmed Items */}
                    <td className="p-4 text-center">
                      {item.isLive === true ? (
                        <span className="inline-flex items-center justify-center w-9 h-9 text-blue-400">
                          <i className="fas fa-circle-notch fa-spin text-sm"></i>
                        </span>
                      ) : (
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setConfirmedItems(prev => prev.filter(i => i.id !== item.id));
                          }}
                          className="bg-red-50 border-2 border-red-300 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all duration-200 w-10 h-10 rounded-full flex items-center justify-center shadow-md cursor-pointer mx-auto hover:shadow-lg hover:scale-110 active:scale-95"
                          title={language === 'ta' ? 'நீக்கு' : 'Delete this item'}
                        >
                          <i className="fas fa-trash-alt text-sm pointer-events-none"></i>
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

           {/* Grand Total Footer - Enhanced */}
           <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-5 border-t-2 border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-calculator text-emerald-600"></i>
                </div>
                <span className="font-bold text-gray-700 uppercase text-sm tracking-wide">
                  {t.grandTotal}
                </span>
              </div>
              <div className="text-right">
                <span className="font-black text-3xl bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>
          </div>

          {/* Customer Form Area */}
          <div className="p-6 bg-white border-t border-gray-200">
            <CustomerForm details={userDetails} onChange={setUserDetails} t={t} />
          </div>

          {/* Action Footer - Enhanced */}
          <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-t border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <button 
              type="button"
              onClick={handleClearAll}
              disabled={allItems.length === 0}
              className={`text-sm font-medium px-5 py-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                allItems.length === 0 
                  ? 'text-gray-400 border border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'text-red-500 hover:text-white border border-red-200 hover:bg-red-500 hover:border-red-500'
              }`}
            >
              <i className="fas fa-trash-alt pointer-events-none"></i>
              {t.clearAll}
            </button>
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              {allItems.length === 0 && (
                <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
                  <i className="fas fa-info-circle mr-1"></i>
                  {language === 'ta' ? 'PDF ஐ இயக்க பொருட்களைச் சேர்க்கவும்' : 'Add items to enable PDF'}
                </span>
              )}
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={allItems.length === 0 || isGeneratingPdf}
                className={`flex items-center gap-3 px-8 py-3.5 rounded-xl font-bold shadow-lg transition-all transform ${
                  allItems.length === 0 || isGeneratingPdf
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed scale-100'
                    : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700 hover:scale-105 hover:shadow-xl active:scale-95'
                }`}
              >
                {isGeneratingPdf ? (
                  <>
                    <i className="fas fa-circle-notch fa-spin"></i>
                    {language === 'ta' ? 'செயலாக்கம்...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <i className="fas fa-file-pdf text-lg"></i>
                    {t.downloadPdf}
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
        
        {/* Helper Footer for Voice - Dynamic Status Bar - Enhanced */}
        {isListening && (
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 border-t-4 border-blue-400 p-4 shadow-2xl z-30 animate-fade-in-up">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                         <div className="relative">
                           <div className="w-4 h-4 bg-red-500 rounded-full animate-ping absolute"></div>
                           <div className="w-4 h-4 bg-red-500 rounded-full relative"></div>
                         </div>
                         <p className="text-sm font-semibold text-white">
                            {getLiveStatus()}
                         </p>
                    </div>
                    <button 
                        type="button"
                        onClick={() => setIsListening(false)} 
                        className="bg-white/20 hover:bg-white/30 text-white text-xs px-4 py-2 rounded-full font-bold transition-all flex items-center gap-2"
                    >
                        <i className="fas fa-stop"></i>
                        {language === 'ta' ? 'நிறுத்து' : 'STOP'}
                    </button>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
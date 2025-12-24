import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Language, BillItem, UserDetails } from './types';
import { TRANSLATIONS } from './constants';
import { parseContinuousInput } from './services/voiceParser';
import { generatePDFWithTamilSupport } from './services/pdfGeneratorV2';
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
    email: '',
    pdfTitle: ''
  });
  const [isListening, setIsListening] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [includePriceInVoice, setIncludePriceInVoice] = useState(true);
  const [showEditInterface, setShowEditInterface] = useState(false);
  const [editingItems, setEditingItems] = useState<BillItem[]>([]);
  
  // Manual Input State
  const [newItem, setNewItem] = useState<{name: string, quantity: string, rate: string}>({
    name: '', quantity: '', rate: ''
  });
  
  // Inline Edit State - tracks which item is being edited
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditValues, setInlineEditValues] = useState<{name: string, quantity: string, rate: string}>({
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

  // Track which items have been auto-committed during this voice session
  const autoCommittedRef = useRef<Set<string>>(new Set());

  // Central helper to clear everything (usable by UI + voice commands)
  const clearAllItems = () => {
    setConfirmedItems([]);
    setLiveItems([]);
    setNewItem({ name: '', quantity: '', rate: '' });
    autoCommittedRef.current.clear();
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
      autoCommittedRef.current.clear();
      return;
    }

    // Parse the entire streaming transcript
    const parsedDataList = parseContinuousInput(transcript);

    // Separate completed items (with rate) from incomplete items (no rate yet)
    const completedItems: BillItem[] = [];
    const incompleteItems: BillItem[] = [];

    parsedDataList.forEach((p, idx) => {
      const rate = includePriceInVoice ? (p.rate || 0) : 0;
      const qtyNum = parseQuantityNumber(p.quantity);
      const itemKey = `${p.name || ''}-${p.quantity || ''}-${rate}`;
      
      const billItem: BillItem = {
        id: `live-${idx}`,
        name: p.name || '',
        quantity: p.quantity || '',
        rate: rate,
        total: rate * qtyNum,
        isLive: true
      };

      // An item is "complete" if it has a name and quantity
      // Rate can be added/edited later manually
      const isComplete = p.name && p.quantity;
      if (isComplete) {
        // Check if we already auto-committed this item
        if (!autoCommittedRef.current.has(itemKey)) {
          completedItems.push(billItem);
          autoCommittedRef.current.add(itemKey);
        }
        // Already committed items are not shown in live
      } else {
        // Incomplete item (no name or no quantity) - show in live section
        incompleteItems.push(billItem);
      }
    });

    // Auto-commit completed items
    if (completedItems.length > 0) {
      setConfirmedItems(prev => [
        ...prev,
        ...completedItems.map(item => ({
          ...item,
          id: uuidv4(),
          isLive: false,
          name: item.name || 'Unknown Item',
        }))
      ]);
    }

    // Update live items to show only incomplete ones
    setLiveItems(incompleteItems);
  }, []);

  // Called when user stops speaking
  const handleVoiceListeningEnd = useCallback(() => {
    // Commit any remaining live items when voice session ends
    if (liveItems.length > 0) {
      const committedItems = liveItems
        .filter(item => item.name) // Only commit items with names
        .map(item => ({
          ...item,
          id: uuidv4(),
          isLive: false,
          name: item.name || 'Unknown Item',
        }));
      
      if (committedItems.length > 0) {
        setConfirmedItems(prev => [...prev, ...committedItems]);
      }
      setLiveItems([]);
    }
    
    // Show edit interface after voice input completes
    if (allItems.length > 0) {
      setEditingItems([...allItems]);
      setShowEditInterface(true);
    }
    
    // Reset auto-commit tracking for next voice session
    autoCommittedRef.current.clear();
  }, [liveItems, allItems]);

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
      // Use HTML-based PDF generator for proper Tamil Unicode rendering
      await generatePDFWithTamilSupport(allItems, userDetails, grandTotal, language, t);
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
    if (includePriceInVoice && !lastItem.rate) {
      return language === 'ta' 
        ? `${lastItem.quantity} கிடைத்தது. விலை சொல்லுங்கள்...` 
        : `Got ${lastItem.quantity}. Say Rate...`;
    }
    if (!includePriceInVoice) {
      return language === 'ta' ? "அடுத்த பொருள் சொல்லுங்கள்..." : "Say next item...";
    }
    
    if (includePriceInVoice && !lastItem.rate) {
      return language === 'ta' 
        ? `${lastItem.quantity} கிடைத்தது. விலை சொல்லுங்கள்...` 
        : `Got ${lastItem.quantity}. Say Rate...`;
    }
    
    return language === 'ta' ? "அடுத்த பொருள் சொல்லுங்கள்..." : "Say next item...";
  };

  // Edit interface handlers
  const handleEditItem = (index: number, field: 'name' | 'quantity' | 'rate', value: string) => {
    setEditingItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Recalculate total
      if (field === 'quantity' || field === 'rate') {
        const rate = field === 'rate' ? parseFloat(value) || 0 : updated[index].rate;
        const qty = parseQuantityNumber(field === 'quantity' ? value : updated[index].quantity);
        updated[index].total = rate * qty;
      }
      
      return updated;
    });
  };

  const handleSaveEdits = () => {
    setConfirmedItems(editingItems.filter(item => item.name.trim()));
    setLiveItems([]);
    setShowEditInterface(false);
  };

  const handleCancelEdits = () => {
    setEditingItems([]);
    setShowEditInterface(false);
  };

  const handleRemoveEditItem = (index: number) => {
    setEditingItems(prev => prev.filter((_, i) => i !== index));
  };

  // Inline edit handlers
  const startInlineEdit = (item: BillItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    // Only allow editing confirmed items (not live)
    if (item.isLive) return;
    
    setInlineEditId(item.id);
    setInlineEditValues({
      name: item.name,
      quantity: item.quantity,
      rate: item.rate.toString()
    });
  };

  const saveInlineEdit = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!inlineEditId) return;
    
    const rateVal = parseFloat(inlineEditValues.rate) || 0;
    const qtyNum = parseQuantityNumber(inlineEditValues.quantity || '1');
    
    setConfirmedItems(prev => prev.map(item => {
      if (item.id === inlineEditId) {
        return {
          ...item,
          name: inlineEditValues.name.trim() || item.name,
          quantity: inlineEditValues.quantity.trim() || item.quantity,
          rate: rateVal,
          total: rateVal * qtyNum
        };
      }
      return item;
    }));
    
    setInlineEditId(null);
    setInlineEditValues({ name: '', quantity: '', rate: '' });
  };

  const cancelInlineEdit = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setInlineEditId(null);
    setInlineEditValues({ name: '', quantity: '', rate: '' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-sky-50 to-white font-sans text-gray-800 pb-20">
      
      {/* Header & Language Toggle - Enhanced */}
      <header className="bg-white shadow-lg sticky top-0 z-20 border-b-4 border-cyan-500">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-green-500 rounded-xl flex items-center justify-center">
              <i className="fas fa-file-invoice-dollar text-white"></i>
            </div>
            <span>{t.title}</span>
          </h1>
          
          <button 
            type="button"
            onClick={handleLanguageToggle}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-all text-sm font-medium border border-slate-200 text-slate-700 shadow-sm"
          >
            <span className={`transition-all ${language === 'en' ? 'font-bold text-cyan-600 scale-105' : 'text-slate-500'}`}>ENG</span>
            <span className="text-slate-300">|</span>
            <span className={`transition-all ${language === 'ta' ? 'font-bold text-cyan-600 scale-105' : 'text-slate-500'}`}>தமிழ்</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-6">

        {/* Quick actions + summary - Enhanced */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <div className="bg-white shadow-md border border-gray-100 rounded-xl p-5 flex flex-col gap-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-gray-500 font-medium">Items</span>
              <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-shopping-basket text-cyan-600 text-sm"></i>
              </div>
            </div>
            <span className="text-3xl font-bold text-gray-800">{allItems.length}</span>
            <span className="text-xs text-gray-400">Live + confirmed</span>
          </div>
          <div className="bg-white shadow-md border border-gray-100 rounded-xl p-5 flex flex-col gap-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-gray-500 font-medium">Grand Total</span>
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-rupee-sign text-green-600 text-sm"></i>
              </div>
            </div>
            <span className="text-3xl font-bold text-green-500">₹{grandTotal.toFixed(2)}</span>
            <span className="text-xs text-gray-400">Updated in real-time</span>
          </div>
          <div className="bg-gradient-to-br from-cyan-500 to-green-500 text-white rounded-xl p-5 shadow-lg flex flex-col justify-between hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-2">
              <i className="fas fa-wand-magic-sparkles text-white/80"></i>
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

          {/* Voice Settings */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <i className="fas fa-cog text-gray-400"></i>
                <span className="text-sm font-medium text-gray-700">
                  {language === 'ta' ? 'குரல் அமைப்புகள்' : 'Voice Settings'}
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePriceInVoice}
                  onChange={(e) => setIncludePriceInVoice(e.target.checked)}
                  className="w-4 h-4 text-cyan-500 bg-gray-100 border-gray-300 rounded focus:ring-cyan-500"
                />
                <span className="text-sm text-gray-600">
                  {language === 'ta' ? 'குரலில் விலை சேர்க்கவும்' : 'Include Price in Voice'}
                </span>
              </label>
            </div>
          </div>

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
                        ? 'bg-cyan-50/80 border-l-4 border-cyan-500 shadow-inner' 
                        : inlineEditId === item.id 
                          ? 'bg-amber-50 border-l-4 border-amber-500'
                          : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-4 text-center text-gray-500 text-sm">{index + 1}</td>
                    
                    {/* Item Name Cell - Inline Edit Mode */}
                    <td className="p-4 font-medium text-gray-800">
                      {inlineEditId === item.id ? (
                        <input
                          type="text"
                          value={inlineEditValues.name}
                          onChange={(e) => setInlineEditValues(prev => ({...prev, name: e.target.value}))}
                          className="w-full bg-white border-2 border-amber-400 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          autoFocus
                        />
                      ) : item.isLive && !item.name ? (
                         <span className="text-blue-400 italic text-sm animate-pulse flex items-center gap-2">
                           <i className="fas fa-comment-dots"></i> 
                           {language === 'ta' ? 'பொருள் சொல்லுங்கள்...' : 'Say Item...'}
                         </span>
                      ) : (
                        <span className="text-base leading-relaxed">{item.name}</span>
                      )}
                    </td>

                    {/* Quantity Cell - Inline Edit Mode */}
                    <td className="p-4 text-center">
                      {inlineEditId === item.id ? (
                        <input
                          type="text"
                          value={inlineEditValues.quantity}
                          onChange={(e) => setInlineEditValues(prev => ({...prev, quantity: e.target.value}))}
                          className="w-full bg-white border-2 border-amber-400 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      ) : item.isLive && !item.quantity ? (
                         item.name ? <span className="text-blue-400 italic text-xs animate-pulse">{language === 'ta' ? 'அளவு...' : 'Qty...'}</span> : <span className="text-gray-300">—</span>
                       ) : (
                         <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded-md text-gray-700 text-sm font-medium">{item.quantity}</span>
                       )}
                    </td>

                    {/* Rate/Total Cell - Inline Edit Mode */}
                    <td className="p-4 text-right">
                      {inlineEditId === item.id ? (
                        <input
                          type="number"
                          value={inlineEditValues.rate}
                          onChange={(e) => setInlineEditValues(prev => ({...prev, rate: e.target.value}))}
                          onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                          className="w-full bg-white border-2 border-amber-400 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="Rate ₹"
                        />
                      ) : item.isLive && item.rate === 0 ? (
                           (item.quantity || item.name) ? <span className="text-blue-400 italic text-xs animate-pulse">{language === 'ta' ? 'விலை...' : 'Rate...'}</span> : <span className="text-gray-300">—</span>
                        ) : (
                            <span className="font-bold text-emerald-600">₹{item.total.toFixed(2)}</span>
                        )}
                    </td>

                    {/* Actions - Edit & Delete */}
                    <td className="p-4 text-center">
                      {item.isLive === true && (!item.name || !item.quantity) ? (
                        <span className="inline-flex items-center justify-center w-9 h-9 text-blue-400">
                          <i className="fas fa-circle-notch fa-spin text-sm"></i>
                        </span>
                      ) : inlineEditId === item.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            type="button"
                            onClick={(e) => saveInlineEdit(e)}
                            className="bg-green-500 hover:bg-green-600 text-white transition-all duration-200 w-9 h-9 rounded-full flex items-center justify-center shadow-md cursor-pointer hover:shadow-lg hover:scale-110 active:scale-95"
                            title={language === 'ta' ? 'சேமி' : 'Save'}
                          >
                            <i className="fas fa-check text-sm pointer-events-none"></i>
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => cancelInlineEdit(e)}
                            className="bg-gray-400 hover:bg-gray-500 text-white transition-all duration-200 w-9 h-9 rounded-full flex items-center justify-center shadow-md cursor-pointer hover:shadow-lg hover:scale-110 active:scale-95"
                            title={language === 'ta' ? 'ரத்து' : 'Cancel'}
                          >
                            <i className="fas fa-times text-sm pointer-events-none"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            type="button"
                            onClick={(e) => startInlineEdit(item, e)}
                            className="bg-amber-50 border-2 border-amber-300 text-amber-500 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all duration-200 w-9 h-9 rounded-full flex items-center justify-center shadow-md cursor-pointer hover:shadow-lg hover:scale-110 active:scale-95"
                            title={language === 'ta' ? 'திருத்து' : 'Edit this item'}
                          >
                            <i className="fas fa-pencil-alt text-xs pointer-events-none"></i>
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setConfirmedItems(prev => prev.filter(i => i.id !== item.id));
                            }}
                            className="bg-red-50 border-2 border-red-300 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all duration-200 w-9 h-9 rounded-full flex items-center justify-center shadow-md cursor-pointer hover:shadow-lg hover:scale-110 active:scale-95"
                            title={language === 'ta' ? 'நீக்கு' : 'Delete this item'}
                          >
                            <i className="fas fa-trash-alt text-xs pointer-events-none"></i>
                          </button>
                        </div>
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
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-calculator text-green-600"></i>
                </div>
                <span className="font-bold text-gray-700 uppercase text-sm tracking-wide">
                  {t.grandTotal}
                </span>
              </div>
              <div className="text-right">
                <span className="font-black text-3xl bg-gradient-to-r from-cyan-500 to-green-500 bg-clip-text text-transparent">
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
                    : 'bg-gradient-to-r from-cyan-500 to-green-500 text-white hover:from-cyan-600 hover:to-green-600 hover:scale-105 hover:shadow-xl active:scale-95'
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
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-cyan-500 p-4 shadow-2xl z-30 animate-fade-in-up">
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

      {/* Edit Interface Modal */}
      {showEditInterface && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <i className="fas fa-edit text-blue-600"></i>
                <h3 className="text-lg font-bold text-gray-800">
                  {language === 'ta' ? 'பொருட்களை திருத்தவும்' : 'Edit Items'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCancelEdits}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-96">
              <div className="space-y-4">
                {editingItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                    <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                      {index + 1}
                    </span>
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {language === 'ta' ? 'பொருள்' : 'Item'}
                        </label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleEditItem(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={language === 'ta' ? 'பொருளின் பெயர்' : 'Item name'}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {language === 'ta' ? 'அளவு' : 'Quantity'}
                        </label>
                        <input
                          type="text"
                          value={item.quantity}
                          onChange={(e) => handleEditItem(index, 'quantity', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={language === 'ta' ? 'அளவு' : 'Quantity'}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {language === 'ta' ? 'விலை (₹)' : 'Rate (₹)'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => handleEditItem(index, 'rate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">
                        {language === 'ta' ? 'மொத்தம்' : 'Total'}
                      </div>
                      <div className="font-bold text-emerald-600">
                        ₹{item.total.toFixed(2)}
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleRemoveEditItem(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title={language === 'ta' ? 'அழிக்கவும்' : 'Remove'}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}
                
                {editingItems.length === 0 && (
                  <div className="text-center py-8">
                    <i className="fas fa-inbox text-4xl text-gray-300 mb-3"></i>
                    <p className="text-gray-500">
                      {language === 'ta' ? 'திருத்த பொருட்கள் இல்லை' : 'No items to edit'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-600">
                <span className="font-medium">
                  {language === 'ta' ? 'மொத்தம்:' : 'Total:'} 
                </span>
                <span className="ml-2 text-lg font-bold text-emerald-600">
                  ₹{editingItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                </span>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdits}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {language === 'ta' ? 'रद्द' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {language === 'ta' ? 'சேமிக्क' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
import React, { useState } from 'react';
import {
  Printer,
  Trash2,
  Plus,
  Minus,
  FileCheck,
  Package,
  Eye,
  X,
  FolderOpen,
  HardDrive,
  ExternalLink,
  Share2,
  CheckCircle2,
  Download,
} from 'lucide-react';
import type { Customer, PrintQueueItem, SenderSettings } from '../types';
import { generateA4ShippingLabels } from '../utils/pdfGenerator';

interface PrintQueueViewProps {
  queue: PrintQueueItem[];
  customers: Customer[];
  senderSettings: SenderSettings;
  onUpdateQueue: (updatedQueue: PrintQueueItem[]) => void;
  onClearQueue: () => void;
}

export const PrintQueueView: React.FC<PrintQueueViewProps> = ({
  queue,
  customers,
  senderSettings,
  onUpdateQueue,
  onClearQueue,
}) => {
  const [selectedCustomerToAdd, setSelectedCustomerToAdd] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSheetPreview, setShowSheetPreview] = useState(false);

  // Save PDF Modal State
  const [isSavePdfModalOpen, setIsSavePdfModalOpen] = useState(false);
  const [pdfFilename, setPdfFilename] = useState(
    `Versandetiketten_6er_${new Date().toISOString().slice(0, 10)}`
  );
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Compute total labels counting individual package quantities
  const totalLabels = queue.reduce((acc, item) => acc + (item.quantity || 1), 0);
  const totalPages = Math.max(1, Math.ceil(totalLabels / 6));

  // Flatten queue items for sheet preview
  const flattenedPreviewItems: Customer[] = [];
  queue.forEach((item) => {
    const qty = Math.max(1, item.quantity || 1);
    for (let k = 0; k < qty; k++) {
      flattenedPreviewItems.push(item.customer);
    }
  });

  const handleAddCustomerToQueue = (customerIdStr: string) => {
    if (!customerIdStr) return;
    const cust = customers.find((c) => String(c.id) === customerIdStr);
    if (!cust) return;

    const newItem: PrintQueueItem = {
      id: `${cust.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      customer: cust,
      quantity: 1,
    };

    onUpdateQueue([...queue, newItem]);
    setSelectedCustomerToAdd('');
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    const updated = queue
      .map((item) => {
        if (item.id === itemId) {
          const nextQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: nextQty };
        }
        return item;
      })
      .filter(Boolean);
    onUpdateQueue(updated);
  };

  const handleRemoveItem = (itemId: string) => {
    onUpdateQueue(queue.filter((q) => q.id !== itemId));
  };

  const handleAddAllCustomers = () => {
    const newItems: PrintQueueItem[] = customers.map((c) => ({
      id: `${c.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      customer: c,
      quantity: 1,
    }));
    onUpdateQueue([...queue, ...newItems]);
  };

  // Helper download trigger
  const triggerPdfDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setSaveSuccessMsg('PDF-Datei erfolgreich im Download-Ordner gespeichert!');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Option 1: Native "Save As..." File Picker
  const handleSavePdfWithPicker = async () => {
    if (queue.length === 0) return;
    setIsGenerating(true);
    try {
      const { blob } = generateA4ShippingLabels(queue, senderSettings);
      const finalName = pdfFilename.endsWith('.pdf') ? pdfFilename : `${pdfFilename}.pdf`;

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: finalName,
            types: [
              {
                description: 'PDF Versandetiketten (*.pdf)',
                accept: { 'application/pdf': ['.pdf'] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          setSaveSuccessMsg('Etiketten erfolgreich im gewählten Verzeichnis gespeichert!');
          setTimeout(() => setSaveSuccessMsg(null), 4000);
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error(err);
            triggerPdfDownload(blob, finalName);
          }
        }
      } else {
        triggerPdfDownload(blob, finalName);
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Fehler beim Erstellen der PDF-Etiketten.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Option 2: Direct Browser Download
  const handleDirectPdfDownload = () => {
    if (queue.length === 0) return;
    try {
      const { blob } = generateA4ShippingLabels(queue, senderSettings);
      const finalName = pdfFilename.endsWith('.pdf') ? pdfFilename : `${pdfFilename}.pdf`;
      triggerPdfDownload(blob, finalName);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Fehler beim Erstellen der PDF-Etiketten.');
    }
  };

  // Option 3: Open in browser tab for direct printer dialog
  const handleOpenPdfInBrowser = () => {
    if (queue.length === 0) return;
    try {
      const { blob } = generateA4ShippingLabels(queue, senderSettings);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setSaveSuccessMsg('PDF im neuen Tab geöffnet. Bereit zum Drucken.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error opening PDF:', err);
      alert('Fehler beim Öffnen der PDF-Etiketten.');
    }
  };

  // Option 4: Share PDF via native share sheet
  const handleSharePdf = async () => {
    if (queue.length === 0) return;
    try {
      const { blob } = generateA4ShippingLabels(queue, senderSettings);
      const finalName = pdfFilename.endsWith('.pdf') ? pdfFilename : `${pdfFilename}.pdf`;

      if (navigator.share) {
        const file = new File([blob], finalName, { type: 'application/pdf' });
        await navigator.share({
          title: 'Versandetiketten PDF',
          text: `WMS Versandetiketten (${totalLabels} Etiketten auf ${totalPages} Seiten)`,
          files: [file],
        });
      } else {
        alert('Die Teilen-Funktion wird in diesem Browser nicht unterstützt. Bitte "Speichern unter" nutzen.');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-white">
              Versandetiketten Druckwarteschlange (6 Etiketten / A4-Bogen)
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-mono font-bold border border-rose-500/20">
              {totalLabels} Etiketten ({totalPages} DIN A4 {totalPages === 1 ? 'Seite' : 'Seiten'})
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            2 Spalten × 3 Zeilen (105mm × 99mm): Nur Absender und Empfänger in deutscher Sprache ohne Länderangabe oder Zusatzdaten.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {queue.length > 0 && (
            <>
              <button
                onClick={() => setShowSheetPreview(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shadow-xs cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                <span>Bogen-Vorschau</span>
              </button>

              <button
                onClick={onClearQueue}
                className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                Warteschlange leeren
              </button>
            </>
          )}

          <button
            onClick={handleAddAllCustomers}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shadow-xs cursor-pointer"
          >
            + Alle Kunden hinzufügen
          </button>

          {/* Trigger button opening the save options dialog */}
          <button
            onClick={() => setIsSavePdfModalOpen(true)}
            disabled={queue.length === 0 || isGenerating}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>6er Etiketten drucken / speichern...</span>
          </button>
        </div>
      </div>

      {/* Add Recipient Selector */}
      <div className="p-4 rounded-xl bg-[#141820] border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <label className="text-xs font-semibold text-slate-300 whitespace-nowrap">
          Empfänger hinzufügen:
        </label>
        <select
          value={selectedCustomerToAdd}
          onChange={(e) => setSelectedCustomerToAdd(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
        >
          <option value="">-- Kunden auswählen --</option>
          {customers.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.firstName} {c.lastName} ({c.city})
            </option>
          ))}
        </select>
        <button
          onClick={() => handleAddCustomerToQueue(selectedCustomerToAdd)}
          disabled={!selectedCustomerToAdd}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
        >
          + Zur Warteschlange
        </button>
      </div>

      {/* Main Grid: Queue Items Cards */}
      {queue.length === 0 ? (
        <div className="py-20 rounded-xl bg-[#141820] border border-dashed border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-300">Druckwarteschlange ist leer</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Wähle Kunden aus der Liste oder oben aus, um 6er A4-Versandetiketten zu erstellen.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {queue.map((item, index) => {
            const c = item.customer;
            return (
              <div
                key={item.id}
                className="p-5 rounded-xl bg-[#141820] border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between relative group"
              >
                {/* Delete button */}
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="absolute top-3 right-3 p-1 text-slate-500 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Entfernen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div>
                  {/* Label Index Tag */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                      Etikett #{index + 1}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      DIN A4 (105×99 mm)
                    </span>
                  </div>

                  {/* Clean German-Only Label Representation (No Country) */}
                  <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800/90 text-xs space-y-3">
                    {/* ABSENDER */}
                    <div className="border-b border-slate-800 pb-2 text-[11px]">
                      <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                        Absender:
                      </div>
                      <div className="font-semibold text-slate-300 mt-0.5">
                        {senderSettings.senderName}
                      </div>
                      <div className="text-slate-400">
                        {senderSettings.senderStreet}, {senderSettings.senderZip} {senderSettings.senderCity}
                      </div>
                    </div>

                    {/* EMPFÄNGER (Kein Land) */}
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                        Empfänger:
                      </div>
                      {c.company && (
                        <div className="text-xs font-semibold text-slate-200">
                          {c.company}
                        </div>
                      )}
                      <div className="text-sm font-bold text-white">
                        {c.firstName} {c.lastName}
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5">{c.address}</div>
                      <div className="text-xs font-bold text-white">
                        {c.postalCode} {c.city}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer with Quantity Stepper */}
                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">Anzahl Etiketten:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateQuantity(item.id, -1)}
                      className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold text-white w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, 1)}
                      className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Layout Specifications Note */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-2">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <FileCheck className="w-4 h-4 text-emerald-400" />
          <span>Spezifikation: 6er Versandetiketten (105mm × 99mm)</span>
        </div>
        <p>
          Die gesamte Fläche der DIN A4 Seite wird voll ausgenutzt (2 Spalten × 3 Zeilen). Die Etiketten enthalten ausschließlich die Daten von <strong>Absender</strong> und <strong>Empfänger</strong> in deutscher Sprache ohne Länderangaben oder zusätzliche Zierelemente.
        </p>
      </div>

      {/* ======================================================== */}
      {/* 1. SAVE PDF OPTIONS MODAL                                */}
      {/* ======================================================== */}
      {isSavePdfModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#141820] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Printer className="w-4 h-4 text-rose-500" />
                  <span>Save Shipping Labels PDF</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Choose how and where to save or print the generated A4 sheet
                </p>
              </div>
              <button
                onClick={() => setIsSavePdfModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Feedback Alert if action succeeded */}
              {saveSuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Summary Pill Strip */}
              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300">
                <span>{totalLabels} Labels ({totalPages} DIN A4 {totalPages === 1 ? 'Page' : 'Pages'})</span>
                <span className="text-rose-400 font-semibold">105 × 99 mm Grid</span>
              </div>

              {/* Filename Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  File Name
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={pdfFilename}
                    onChange={(e) => setPdfFilename(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700/80 rounded-l-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                  />
                  <span className="px-3 py-2 bg-slate-800 border border-l-0 border-slate-700/80 rounded-r-lg text-xs font-mono text-slate-400">
                    .pdf
                  </span>
                </div>
              </div>

              {/* Menu of Options */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Select Save Destination:
                </span>

                {/* Option A: Native Save As (Choose Directory) */}
                <button
                  onClick={handleSavePdfWithPicker}
                  className="w-full flex items-center justify-between p-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Save As... (Choose Destination Folder)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Pick exact local folder, external drive, or network share
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                    Browse →
                  </span>
                </button>

                {/* Option B: Direct Browser Download */}
                <button
                  onClick={handleDirectPdfDownload}
                  className="w-full flex items-center justify-between p-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Download to Downloads Folder
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Quick download directly to your default browser downloads path
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 group-hover:text-white">
                    Download ↓
                  </span>
                </button>

                {/* Option C: Open for instant printing */}
                <button
                  onClick={handleOpenPdfInBrowser}
                  className="w-full flex items-center justify-between p-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/40 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Open in New Tab & Print
                      </div>
                      <div className="text-[11px] text-slate-400">
                        View rendered PDF and open system print dialog directly
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-rose-400 group-hover:text-rose-300">
                    Open ↗
                  </span>
                </button>

                {/* Option D: Device Share */}
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={handleSharePdf}
                    className="w-full flex items-center justify-between p-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20">
                        <Share2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">
                          Share File via System Menu
                        </div>
                        <div className="text-[11px] text-slate-400">
                          AirDrop, email attachment, or local device apps
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-400 group-hover:text-white">
                      Share
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsSavePdfModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. FULL SHEET VISUAL PREVIEW MODAL                       */}
      {/* ======================================================== */}
      {showSheetPreview && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-[#141820] border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">
                  A4 Bogen-Vorschau (6 Etiketten pro Blatt)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Seite 1 von {totalPages} · 2 Spalten × 3 Zeilen (105 mm × 99 mm pro Etikett)
                </p>
              </div>
              <button
                onClick={() => setShowSheetPreview(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated A4 Sheet */}
            <div className="p-6 overflow-y-auto flex justify-center bg-slate-950">
              <div className="w-full max-w-[560px] aspect-[210/297] bg-white text-slate-900 shadow-2xl p-4 grid grid-cols-2 grid-rows-3 gap-2 border border-slate-300">
                {Array.from({ length: 6 }).map((_, slotIdx) => {
                  const cust = flattenedPreviewItems[slotIdx];
                  if (!cust) {
                    return (
                      <div
                        key={slotIdx}
                        className="border border-dashed border-slate-300 rounded p-3 flex items-center justify-center text-slate-400 text-[11px] italic"
                      >
                        Position #{slotIdx + 1} (Leer)
                      </div>
                    );
                  }

                  return (
                    <div
                      key={slotIdx}
                      className="border border-dashed border-slate-400 rounded p-2.5 flex flex-col justify-between bg-slate-50/50"
                    >
                      {/* Absender */}
                      <div className="border-b border-slate-300 pb-1.5">
                        <div className="text-[8px] uppercase font-bold text-slate-500">
                          Absender:
                        </div>
                        <div className="font-bold text-[9px] text-slate-800">
                          {senderSettings.senderName}
                        </div>
                        <div className="text-[8px] text-slate-600">
                          {senderSettings.senderStreet}, {senderSettings.senderZip} {senderSettings.senderCity}
                        </div>
                      </div>

                      {/* Empfänger (Kein Land) */}
                      <div className="py-1">
                        <div className="text-[8px] uppercase font-bold text-slate-500">
                          Empfänger:
                        </div>
                        {cust.company && (
                          <div className="text-[9px] font-semibold text-slate-700">
                            {cust.company}
                          </div>
                        )}
                        <div className="text-[12px] font-bold text-slate-900 leading-tight">
                          {cust.firstName} {cust.lastName}
                        </div>
                        <div className="text-[10px] text-slate-800">{cust.address}</div>
                        <div className="text-[11px] font-bold text-slate-900">
                          {cust.postalCode} {cust.city}
                        </div>
                      </div>

                      {/* Slot Indicator */}
                      <div className="text-right text-[7px] text-slate-400 font-mono">
                        Feld {slotIdx + 1}/6
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Gesamt {totalLabels} Etiketten auf {totalPages} DIN A4 Seiten
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSheetPreview(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Schließen
                </button>
                <button
                  onClick={() => {
                    setShowSheetPreview(false);
                    setIsSavePdfModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Speicheroptionen öffnen...</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Save,
  Download,
  Upload,
  Sparkles,
  AlertTriangle,
  Building,
  CheckCircle2,
  FolderOpen,
  Copy,
  Share2,
  FileCode,
  X,
  FileText,
  HardDrive,
} from 'lucide-react';
import type { Customer, Transaction, SenderSettings } from '../types';
import { db } from '../db';

interface SettingsViewProps {
  senderSettings: SenderSettings;
  onSaveSenderSettings: (settings: SenderSettings) => Promise<void>;
  customers: Customer[];
  transactions: Transaction[];
  onReloadData: () => Promise<void>;
  onSeedDemoData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  senderSettings,
  onSaveSenderSettings,
  customers,
  transactions,
  onReloadData,
  onSeedDemoData,
}) => {
  const [formSettings, setFormSettings] = useState<SenderSettings>(senderSettings);
  const [isSavedAlert, setIsSavedAlert] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Backup Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [backupFilename, setBackupFilename] = useState(
    `WMS_Backup_${new Date().toISOString().slice(0, 10)}`
  );
  const [backupFormat, setBackupFormat] = useState<'formatted' | 'minified'>('formatted');
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSenderSettings(formSettings);
    setIsSavedAlert(true);
    setTimeout(() => setIsSavedAlert(false), 3000);
  };

  // Build the backup payload
  const getBackupJSONString = (minified = false) => {
    const backupData = {
      system: 'Warehouse Command Center (WMS)',
      version: 2,
      exportDate: new Date().toISOString(),
      senderSettings: formSettings,
      customers,
      finances: transactions,
      meta: {
        totalCustomers: customers.length,
        totalTransactions: transactions.length,
      },
    };
    return minified
      ? JSON.stringify(backupData)
      : JSON.stringify(backupData, null, 2);
  };

  // Download helper
  const triggerDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setSaveSuccessMsg('Datei erfolgreich im Download-Ordner gespeichert!');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Option 1: Native "Save As" File Picker (allows choosing directory & name)
  const handleSaveWithPicker = async () => {
    const jsonString = getBackupJSONString(backupFormat === 'minified');
    const finalName = backupFilename.endsWith('.json')
      ? backupFilename
      : `${backupFilename}.json`;

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: finalName,
          types: [
            {
              description: 'JSON-Sicherungsdatei (*.json)',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        setSaveSuccessMsg('Backup erfolgreich im gewählten Verzeichnis gespeichert!');
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(err);
          // Fallback to standard download if picker errors
          triggerDownload(jsonString, finalName);
        }
      }
    } else {
      // Browser does not support showSaveFilePicker, fall back gracefully
      triggerDownload(jsonString, finalName);
    }
  };

  // Option 2: Standard Browser Download
  const handleDirectDownload = () => {
    const jsonString = getBackupJSONString(backupFormat === 'minified');
    triggerDownload(jsonString, backupFilename);
  };

  // Option 3: Copy to Clipboard
  const handleCopyToClipboard = async () => {
    const jsonString = getBackupJSONString(backupFormat === 'minified');
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  // Option 4: Device Share (Share Sheet)
  const handleDeviceShare = async () => {
    const jsonString = getBackupJSONString(backupFormat === 'minified');
    const finalName = backupFilename.endsWith('.json')
      ? backupFilename
      : `${backupFilename}.json`;

    if (navigator.share) {
      try {
        const file = new File([jsonString], finalName, { type: 'application/json' });
        await navigator.share({
          title: 'WMS Database Backup',
          text: `WMS Database Backup (${customers.length} clients, ${transactions.length} transactions)`,
          files: [file],
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(err);
        }
      }
    } else {
      alert('Die native Teilen-Funktion wird in diesem Browser/Gerät nicht unterstützt. Bitte nutze "Speichern unter" oder "Herunterladen".');
    }
  };

  // Import JSON Handler
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Warnung: Das Wiederherstellen dieses Backups überschreibt alle aktuellen Datenbankeinträge. Fortfahren?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.customers || !parsed.finances) {
          throw new Error('Ungültige WMS-Backup-Struktur.');
        }

        await db.customers.clear();
        await db.finances.clear();

        if (parsed.customers.length > 0) {
          await db.customers.bulkAdd(parsed.customers);
        }
        if (parsed.finances.length > 0) {
          await db.finances.bulkAdd(parsed.finances);
        }
        if (parsed.senderSettings) {
          await onSaveSenderSettings(parsed.senderSettings);
          setFormSettings(parsed.senderSettings);
        }

        await onReloadData();
        setImportStatus('Backup erfolgreich wiederhergestellt!');
        setTimeout(() => setImportStatus(null), 4000);
      } catch (err: any) {
        console.error(err);
        alert(`Wiederherstellung fehlgeschlagen: ${err.message || 'Beschädigte JSON-Datei'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleFactoryReset = async () => {
    if (
      window.confirm(
        'ACHTUNG: Möchtest du wirklich alle Kunden und Transaktionen unwiderruflich löschen?'
      )
    ) {
      await db.customers.clear();
      await db.finances.clear();
      await onReloadData();
      alert('Lokale Datenbank wurde vollständig zurückgesetzt.');
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Sender Configuration Card */}
      <div className="p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-rose-500" />
            <div>
              <h3 className="text-base font-semibold text-white">
                Absender-Informationen & Rücksendeadresse
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Wird als offizieller Absender auf den A4-Versandetiketten gedruckt
              </p>
            </div>
          </div>
          {isSavedAlert && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Gespeichert!</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Firmenname / Absender
              </label>
              <input
                type="text"
                value={formSettings.senderName}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, senderName: e.target.value })
                }
                required
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Straße & Hausnummer
              </label>
              <input
                type="text"
                value={formSettings.senderStreet}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, senderStreet: e.target.value })
                }
                required
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Postleitzahl (PLZ)
              </label>
              <input
                type="text"
                value={formSettings.senderZip}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, senderZip: e.target.value })
                }
                required
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Stadt / Ort
              </label>
              <input
                type="text"
                value={formSettings.senderCity}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, senderCity: e.target.value })
                }
                required
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Absenderprofil speichern</span>
            </button>
          </div>
        </form>
      </div>

      {/* Backup and Restore Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Card */}
        <div className="p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-white font-semibold text-base">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Datenbank-Sicherung exportieren</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Öffnet das Speichermenü mit erweiterten Optionen: Speicherort selbst wählen, als Datei herunterladen, in die Zwischenablage kopieren oder teilen.
            </p>
            <div className="text-xs font-mono text-slate-500 space-y-1 mb-6">
              <div>· Kunden: {customers.length} Datensätze</div>
              <div>· Finanztransaktionen: {transactions.length} Datensätze</div>
            </div>
          </div>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Sicherungsoptionen anzeigen...</span>
          </button>
        </div>

        {/* Import Card */}
        <div className="p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-white font-semibold text-base">
              <Upload className="w-4 h-4 text-rose-400" />
              <span>Sicherung wiederherstellen</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Wähle eine gültige WMS JSON-Backup-Datei aus, um Daten einzuspielen. Achtung: Vorhandene Datensätze werden ersetzt.
            </p>
            {importStatus && (
              <div className="p-2.5 mb-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                {importStatus}
              </div>
            )}
          </div>

          <div>
            <label className="block w-full">
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
                id="restoreFileInput"
              />
              <span className="w-full cursor-pointer py-2.5 px-4 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-xs font-semibold text-rose-300 flex items-center justify-center gap-2 transition-colors">
                <Upload className="w-4 h-4" />
                <span>JSON-Datei auswählen & wiederherstellen</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Demo Data & Danger Zone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-white font-semibold text-base">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Demodaten-Generator</span>
          </div>
          <p className="text-xs text-slate-400 mb-5">
            Fügt realistische Testdaten hinzu (Kunden, Bestellungen, DHL-Logistikkosten, Gabelstapler-Wartung und Vorräte).
          </p>
          <button
            onClick={onSeedDemoData}
            className="w-full py-2.5 px-4 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-semibold text-amber-300 flex items-center justify-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Beispieldatenbank generieren</span>
          </button>
        </div>

        <div className="p-6 rounded-xl bg-[#141820] border border-red-900/40 shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-rose-400 font-semibold text-base">
            <AlertTriangle className="w-4 h-4" />
            <span>Werkseinstellungen</span>
          </div>
          <p className="text-xs text-slate-400 mb-5">
            Löscht alle Kunden und Finanztransaktionen im lokalen Browserspeicher vollständig.
          </p>
          <button
            onClick={handleFactoryReset}
            className="w-full py-2.5 px-4 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-xs font-semibold text-rose-300 flex items-center justify-center gap-2 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Lokale Datenbank leeren</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* EXPORT BACKUP OPTIONS MODAL (قائمة خيارات حفظ النسخة)    */}
      {/* ======================================================== */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#141820] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Sicherungsoptionen / خيارات حفظ النسخة الاحتياطية</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Wähle, wie und wo du die Sicherung deines Warenwirtschaftssystems speichern möchtest
                </p>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
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
                <span>Inhalt: {customers.length} Kunden · {transactions.length} Buchungen</span>
                <span className="text-emerald-400 font-semibold">JSON Format</span>
              </div>

              {/* Filename & Format Configuration */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Dateiname / اسم الملف
                  </label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={backupFilename}
                      onChange={(e) => setBackupFilename(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700/80 rounded-l-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                    />
                    <span className="px-3 py-2 bg-slate-800 border border-l-0 border-slate-700/80 rounded-r-lg text-xs font-mono text-slate-400">
                      .json
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Formatierung / نوع التنسيق
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setBackupFormat('formatted')}
                      className={`py-1.5 px-3 rounded-md font-medium transition-all ${
                        backupFormat === 'formatted'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Lesbar formatiert (Indent 2)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBackupFormat('minified')}
                      className={`py-1.5 px-3 rounded-md font-medium transition-all ${
                        backupFormat === 'minified'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Kompakt (Minified)
                    </button>
                  </div>
                </div>
              </div>

              {/* The Menu of Saving Options */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Speichermethode wählen / خيارات الحفظ:
                </span>

                {/* Option A: Native Save As (Choose Directory) */}
                <button
                  onClick={handleSaveWithPicker}
                  className="w-full flex items-center justify-between p-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Speichern unter... (Verzeichnis frei wählen)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        حفظ مخصص — يفتح نافذة النظام لاختيار المجلد والقرص يدوياً
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                    Auswählen →
                  </span>
                </button>

                {/* Option B: Direct Browser Download */}
                <button
                  onClick={handleDirectDownload}
                  className="w-full flex items-center justify-between p-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Als Datei herunterladen (Downloads-Ordner)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        تنزيل الملف العادي في مجلد التنزيلات الافتراضي
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 group-hover:text-white">
                    Herunterladen ↓
                  </span>
                </button>

                {/* Option C: Copy to Clipboard */}
                <button
                  onClick={handleCopyToClipboard}
                  className="w-full flex items-center justify-between p-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20">
                      <Copy className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">
                        In die Zwischenablage kopieren (Clipboard)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        نسخ بيانات الـ JSON مباشرة للصقها في ملف أو بريد
                      </div>
                    </div>
                  </div>
                  {copySuccess ? (
                    <span className="text-xs font-bold text-emerald-400">Kopiert! ✓</span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400 group-hover:text-white">
                      Kopieren
                    </span>
                  )}
                </button>

                {/* Option D: Device Share */}
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={handleDeviceShare}
                    className="w-full flex items-center justify-between p-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20">
                        <Share2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">
                          Über Geräte-Menü teilen (AirDrop / Mail / Cloud)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          مشاركة النسخة عبر تطبيقات ومجلدات النظام السحابية
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-400 group-hover:text-white">
                      Teilen
                    </span>
                  </button>
                )}
              </div>

              {/* Option E: Toggle JSON Code Preview */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowJsonPreview(!showJsonPreview)}
                  className="text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5 text-rose-500" />
                  <span>
                    {showJsonPreview
                      ? 'JSON-Vorschau ausblenden'
                      : 'JSON-Dateninhalt vorab ansehen... (معاينة الكود)'}
                  </span>
                </button>

                {showJsonPreview && (
                  <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 max-h-48 overflow-y-auto">
                    <pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap leading-relaxed">
                      {getBackupJSONString(backupFormat === 'minified')}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Schließen (إغلاق)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

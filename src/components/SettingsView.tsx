import React, { useState } from 'react';
import {
  Save,
  Download,
  Upload,
  AlertTriangle,
  Building,
  CheckCircle2,
  FolderOpen,
  Copy,
  Share2,
  FileCode,
  X,
  HardDrive,
  Trash2,
  ShieldAlert,
  Globe,
  Palette,
} from 'lucide-react';
import type { Customer, Transaction, SenderSettings } from '../types';
import { db } from '../db';

interface SettingsViewProps {
  senderSettings: SenderSettings;
  onSaveSenderSettings: (settings: SenderSettings) => Promise<void>;
  customers: Customer[];
  transactions: Transaction[];
  onReloadData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  senderSettings,
  onSaveSenderSettings,
  customers,
  transactions,
  onReloadData,
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

  // Multi-Step Reset Database Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [confirmCheck1, setConfirmCheck1] = useState(false);
  const [confirmCheck2, setConfirmCheck2] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessAlert, setResetSuccessAlert] = useState(false);

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
    setSaveSuccessMsg('File successfully saved to your Downloads folder!');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Option 1: Native "Save As" File Picker
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
              description: 'JSON Backup File (*.json)',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        setSaveSuccessMsg('Backup successfully saved to selected folder!');
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(err);
          triggerDownload(jsonString, finalName);
        }
      }
    } else {
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

  // Option 4: Device Share
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
      alert('Native sharing is not supported in this browser. Please use "Save As" or "Download".');
    }
  };

  // Import JSON Handler
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Warning: Restoring this backup will replace current database records. Continue?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.customers || !parsed.finances) {
          throw new Error('Invalid WMS backup structure.');
        }

        await db.customers.clear();
        await db.finances.clear();

        if (parsed.customers.length > 0) {
          await db.customers.bulkAdd(parsed.customers);
        }
        if (parsed.finances.length > 0) {
          await db.finances.bulkAdd(parsed.finances);
        }
        if (parsed.orders && parsed.orders.length > 0) {
          await db.orders.bulkAdd(parsed.orders);
        }
        if (parsed.suppliers && parsed.suppliers.length > 0) {
          await db.suppliers.bulkAdd(parsed.suppliers);
        }
        if (parsed.supplierTransactions && parsed.supplierTransactions.length > 0) {
          await db.supplierTransactions.bulkAdd(parsed.supplierTransactions);
        }
        if (parsed.senderSettings) {
          await onSaveSenderSettings(parsed.senderSettings);
          setFormSettings(parsed.senderSettings);
        }

        await onReloadData();
        setImportStatus('Backup restored successfully!');
        setTimeout(() => setImportStatus(null), 4000);
      } catch (err: any) {
        console.error(err);
        alert(`Restore failed: ${err.message || 'Corrupted JSON file'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Multi-step reset execution
  const isPhraseValid =
    confirmPhrase.trim().toUpperCase() === 'DELETE' ||
    confirmPhrase.trim().toUpperCase() === 'LÖSCHEN';
  const isResetButtonEnabled = confirmCheck1 && confirmCheck2 && isPhraseValid && !isResetting;

  const handleExecuteReset = async () => {
    if (!isResetButtonEnabled) return;
    setIsResetting(true);
    try {
      await db.customers.clear();
      await db.finances.clear();
      await db.suppliers.clear();
      await db.supplierTransactions.clear();
      await db.orders.clear();
      await onReloadData();
      setIsResetModalOpen(false);
      setConfirmCheck1(false);
      setConfirmCheck2(false);
      setConfirmPhrase('');
      setResetSuccessAlert(true);
      setTimeout(() => setResetSuccessAlert(false), 5000);
    } catch (err: any) {
      console.error('Error during database wipe:', err);
      alert(`Failed to reset database: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Reset Success Banner */}
      {resetSuccessAlert && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-3 shadow-md animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold block text-sm text-white">Database Successfully Reset</span>
            All client accounts and financial ledger records were permanently cleared from local storage.
          </div>
        </div>
      )}

      {/* Sender Configuration Card */}
      <div className="p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-rose-500" />
            <div>
              <h3 className="text-base font-semibold text-white">
                Sender Information & Return Address
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Printed as the official dispatch sender on A4 shipping label sheets
              </p>
            </div>
          </div>
          {isSavedAlert && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved!</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Company / Sender Name
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
                Street & House Number
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
                Postal Code (PLZ)
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
                City / Location
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

          {/* New Requested Feature: Address Fields Configuration (Hide/Show Country Field) */}
          <div className="pt-4 mt-2 border-t border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-rose-500/10 text-rose-400 shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      Show Country Field in Addresses
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        formSettings.showCountryField
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {formSettings.showCountryField ? 'Visible' : 'Hidden (Germany Only)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                    When turned off, the Country field is hidden from customer forms and address views, simplifying daily operations since all customers are located in Germany.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={formSettings.showCountryField ?? false}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, showCountryField: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>
          </div>

          {/* Dynamic Financial Theme Preference */}
          <div className="pt-3 border-t border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400 shrink-0">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      Dynamic Financial Theme (Profit / Debt Mood Shift)
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        formSettings.enableDynamicTheme ?? true
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {formSettings.enableDynamicTheme ?? true ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                    Dynamically shifts application aura, top glow line, indicators, and accents in graded color levels (vibrant emerald for high profit down to crimson for heavy debt).
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={formSettings.enableDynamicTheme ?? true}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, enableDynamicTheme: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Sender Profile & Preferences</span>
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
              <span>Export Database Backup</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Open backup options to save your complete database: custom folder selection, direct download, clipboard copy, or system sharing.
            </p>
            <div className="text-xs font-mono text-slate-500 space-y-1 mb-6">
              <div>· Clients: {customers.length} records</div>
              <div>· Financial ledger: {transactions.length} records</div>
            </div>
          </div>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Open Backup Options...</span>
          </button>
        </div>

        {/* Import Card */}
        <div className="p-6 rounded-xl bg-[#141820] border border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-white font-semibold text-base">
              <Upload className="w-4 h-4 text-rose-400" />
              <span>Restore Database Backup</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Select a valid WMS JSON backup file to restore records. Existing entries will be updated or replaced.
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
                <span>Select & Restore JSON Backup</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Danger Zone: Factory Reset (Multi-Step Confirmation) */}
      <div className="p-6 rounded-xl bg-[#141820] border border-rose-900/40 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-base">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <span>Factory Reset / Wipe Database</span>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Permanently clears all customers ({customers.length}) and transaction records ({transactions.length}) from local browser storage. A multi-step security verification is enforced to prevent accidental data loss.
            </p>
          </div>

          <button
            onClick={() => {
              setConfirmCheck1(false);
              setConfirmCheck2(false);
              setConfirmPhrase('');
              setIsResetModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 border border-rose-800 text-xs font-bold text-rose-300 flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Reset Database...</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. EXPORT BACKUP OPTIONS MODAL                           */}
      {/* ======================================================== */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#141820] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Backup Export Options</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select your preferred format and storage destination for the WMS database
                </p>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
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
                <span>Payload: {customers.length} Clients · {transactions.length} Transactions</span>
                <span className="text-emerald-400 font-semibold">JSON Format</span>
              </div>

              {/* Filename & Format Configuration */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    File Name
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
                    Formatting
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setBackupFormat('formatted')}
                      className={`py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer ${
                        backupFormat === 'formatted'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Formatted (Indent 2)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBackupFormat('minified')}
                      className={`py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer ${
                        backupFormat === 'minified'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Compact (Minified)
                    </button>
                  </div>
                </div>
              </div>

              {/* The Menu of Saving Options */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Select Save Destination:
                </span>

                {/* Option A: Native Save As (Choose Directory) */}
                <button
                  onClick={handleSaveWithPicker}
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
                  onClick={handleDirectDownload}
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

                {/* Option C: Copy to Clipboard */}
                <button
                  onClick={handleCopyToClipboard}
                  className="w-full flex items-center justify-between p-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20">
                      <Copy className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Copy JSON to Clipboard
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Copy raw JSON string to paste into text editor or email
                      </div>
                    </div>
                  </div>
                  {copySuccess ? (
                    <span className="text-xs font-bold text-emerald-400">Copied! ✓</span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400 group-hover:text-white">
                      Copy
                    </span>
                  )}
                </button>

                {/* Option D: Device Share */}
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={handleDeviceShare}
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

              {/* Option E: Toggle JSON Code Preview */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowJsonPreview(!showJsonPreview)}
                  className="text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-rose-500" />
                  <span>
                    {showJsonPreview
                      ? 'Hide JSON Preview'
                      : 'Preview JSON Payload Content...'}
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
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MULTI-STEP DATABASE WIPE CONFIRMATION MODAL           */}
      {/* ======================================================== */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#141820] border border-rose-600/50 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-rose-950/40 border-b border-rose-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Permanent Database Reset
                  </h3>
                  <p className="text-xs text-rose-300/80">
                    Security Check: Multi-step verification required
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Critical Alert Box */}
              <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/60 text-xs text-rose-200 space-y-2">
                <div className="font-bold text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>Warning: Irreversible Action</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  This action will permanently delete all client accounts ({customers.length}) and all finance and order ledger entries ({transactions.length}) from local storage. Deleted data cannot be recovered without a previous backup.
                </p>
              </div>

              {/* Confirmation Step 1 */}
              <label className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  checked={confirmCheck1}
                  onChange={(e) => setConfirmCheck1(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-700 text-rose-600 focus:ring-rose-500 bg-slate-800 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-white block">
                    1. Acknowledge Irreversibility
                  </span>
                  <span className="text-slate-400 mt-0.5 block">
                    I understand that all database records will be permanently wiped immediately.
                  </span>
                </div>
              </label>

              {/* Confirmation Step 2 */}
              <label className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  checked={confirmCheck2}
                  onChange={(e) => setConfirmCheck2(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-700 text-rose-600 focus:ring-rose-500 bg-slate-800 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-semibold text-white block">
                    2. Backup Verification
                  </span>
                  <span className="text-slate-400 mt-0.5 block">
                    I have exported a JSON backup or confirm that I no longer need this data.
                  </span>
                </div>
              </label>

              {/* Confirmation Step 3: Security Phrase Input */}
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
                <label className="block text-xs font-semibold text-white">
                  3. Enter Security Confirmation Phrase:
                </label>
                <p className="text-[11px] text-slate-400">
                  Type <strong className="text-rose-400 font-mono">DELETE</strong> into the field below to unlock the button:
                </p>
                <input
                  type="text"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white font-mono tracking-wider focus:outline-none focus:border-rose-500 uppercase"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={!isResetButtonEnabled}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md cursor-pointer"
              >
                {isResetting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Wiping Database...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Wipe All Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

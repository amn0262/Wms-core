import React, { useState, useEffect } from 'react';
import { X, Check, Building2 } from 'lucide-react';
import type { Supplier } from '../types';
import { useI18n } from '../utils/i18n';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: Omit<Supplier, 'id' | 'created'> & { id?: number }) => Promise<void>;
  editingSupplier?: Supplier | null;
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingSupplier,
}) => {
  const { tr } = useI18n();
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingSupplier) {
      setName(editingSupplier.name || '');
      setContactPerson(editingSupplier.contactPerson || '');
      setPhone(editingSupplier.phone || '');
      setEmail(editingSupplier.email || '');
      setNotes(editingSupplier.notes || '');
    } else {
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setNotes('');
    }
  }, [editingSupplier, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        id: editingSupplier?.id,
        name: name.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#141820] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-600/15 text-rose-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {editingSupplier
                  ? tr('Edit Goods Supplier', 'تعديل بيانات مورد البضائع')
                  : tr('Add New Goods Supplier', 'إضافة مورد بضائع جديد')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {tr(
                  'Merchandise vendor details, contact info, and payment terms (no address needed)',
                  'تفاصيل مورد البضائع، معلومات التواصل، وشروط الدفع (لا يلزم عنوان)'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Supplier Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {tr('Goods Supplier / Vendor Name', 'اسم المورد / الشركة الموردة')}{' '}
              <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={tr(
                'e.g. Textile Wholesale GmbH, Electronics Direct, Global Trading',
                'مثال: شركة النسيج للجملة، إلكترونيات دايركت، التجارة العالمية'
              )}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-medium"
            />
          </div>

          {/* Contact Person */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {tr('Contact Person / Sales Representative', 'اسم الشخص المسؤول / مندوب المبيعات')}{' '}
              <span className="text-slate-500">{tr('(Optional)', '(اختياري)')}</span>
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder={tr('e.g. Thomas Weber', 'مثال: توماس فيبر')}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {tr('Phone Number', 'رقم الهاتف')}{' '}
                <span className="text-slate-500">{tr('(Optional)', '(اختياري)')}</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+49 30 1234567"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {tr('Email Address', 'البريد الإلكتروني')}{' '}
                <span className="text-slate-500">{tr('(Optional)', '(اختياري)')}</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sales@vendor.com"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Notes & Terms */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {tr('Account Notes & Terms', 'ملاحظات الحساب وشروط الدفع')}{' '}
              <span className="text-slate-500">{tr('(Optional)', '(اختياري)')}</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={tr(
                'e.g. Net 14 days payment terms, IBAN: DE89 3704 0044..., standard discount agreement',
                'مثال: الدفع خلال 14 يوماً، رقم الآيبان IBAN، اتفاقية الخصم المعتادة'
              )}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {tr('Cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? tr('Saving...', 'جاري الحفظ...')
                  : editingSupplier
                  ? tr('Update Supplier', 'تحديث بيانات المورد')
                  : tr('Save Supplier', 'حفظ المورد')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

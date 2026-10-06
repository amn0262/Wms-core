import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import type { Customer } from '../types';
import { useI18n } from '../utils/i18n';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Omit<Customer, 'id' | 'created'> & { id?: number }) => Promise<void>;
  editingCustomer?: Customer | null;
  showCountryField?: boolean;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingCustomer,
  showCountryField = false,
}) => {
  const { tr } = useI18n();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Germany');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingCustomer) {
      setFirstName(editingCustomer.firstName || '');
      setLastName(editingCustomer.lastName || '');
      setCompany(editingCustomer.company || '');
      setAddress(editingCustomer.address || '');
      setPostalCode(editingCustomer.postalCode || '');
      setCity(editingCustomer.city || '');
      setCountry(editingCustomer.country || 'Germany');
      setEmail(editingCustomer.email || '');
      setPhone(editingCustomer.phone || '');
      setNotes(editingCustomer.notes || '');
    } else {
      setFirstName('');
      setLastName('');
      setCompany('');
      setAddress('');
      setPostalCode('');
      setCity('');
      setCountry('Germany');
      setEmail('');
      setPhone('');
      setNotes('');
    }
  }, [editingCustomer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !address.trim() || !postalCode.trim() || !city.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        id: editingCustomer?.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        company: company.trim() || undefined,
        address: address.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
        country: country.trim() || 'Germany',
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#141820] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {editingCustomer
                ? tr('Edit Customer', 'تعديل بيانات الزبون')
                : tr('Add New Customer', 'إضافة زبون جديد')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {tr(
                'Contact and shipping address details for packaging and dispatch',
                'بيانات التواصل وعنوان الشحن للتغليف والإرسال'
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Name fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {tr('First Name', 'الاسم الأول')} <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                placeholder={tr('Marcus', 'أحمد')}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {tr('Last Name', 'اسم العائلة')} <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                placeholder={tr('Schmidt', 'المنصور')}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Company */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {tr('Company Name', 'اسم الشركة')}{' '}
              <span className="text-slate-500">{tr('(Optional)', '(اختياري)')}</span>
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder={tr('e.g. Schmidt Warenhandel GmbH', 'مثال: شركة النور للتجارة')}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Street & House Number */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {tr('Street & House Number', 'الشارع ورقم المبنى')} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              placeholder="e.g. Hauptstraße 12 or Industrieweg 4"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Zip & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {tr('Postal Code', 'الرمز البريدي')} <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                required
                placeholder="10115"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {tr('City', 'المدينة')} <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                placeholder="Berlin"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Country (Conditionally toggled from Settings) */}
          {showCountryField && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {tr('Country', 'الدولة')} <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required={showCountryField}
                placeholder="Germany"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          )}

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {tr('Email Address', 'البريد الإلكتروني')}{' '}
                <span className="text-slate-500">{tr('(Optional)', '(اختياري)')}</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="buyer@client.de"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {tr('Phone Number', 'رقم الهاتف')}{' '}
                <span className="text-slate-500">{tr('(Optional)', '(اختياري)')}</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+49 30 123456"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {tr('Internal Warehouse Notes', 'ملاحظات المستودع الداخلية')}{' '}
              <span className="text-slate-500">{tr('(Optional)', '(اختياري)')}</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tr(
                'e.g. Requires pallet tail lift, preferred carrier DHL Freight',
                'مثال: يتطلب رافعة خلفية للطبلية، شركة الشحن المفضلة DHL'
              )}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              {tr('Cancel', 'إلغاء')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? tr('Saving...', 'جاري الحفظ...')
                  : editingCustomer
                  ? tr('Update Customer', 'تحديث بيانات الزبون')
                  : tr('Save Customer', 'حفظ الزبون')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

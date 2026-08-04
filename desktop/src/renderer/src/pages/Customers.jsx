import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import InitialsAvatar from '../components/InitialsAvatar'
import Pagination from '../components/Pagination'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { addLogoToPDF } from '../utils/pdfLogo'

const BOLGE_OPTIONS = [
  { value: '', label: 'Seçiniz' },
  { value: '01', label: 'İç Anadolu' },
  { value: '21', label: 'Güney Batı Akdeniz' },
  { value: '31', label: 'Kuzey Anadolu' },
  { value: '41', label: 'İstanbul - Avrupa' },
  { value: '42', label: 'İstanbul - Anadolu' },
  { value: '51', label: 'Batı Anadolu' },
  { value: '61', label: 'Doğu ve Güneydoğu' }
];

const CITY_OPTIONS = [
  { value: '', label: 'Seçiniz' },
  { value: '01', label: 'ADANA' }, { value: '02', label: 'ADIYAMAN' }, { value: '03', label: 'AFYON' },
  { value: '04', label: 'AĞRI' }, { value: '05', label: 'AMASYA' }, { value: '06', label: 'ANKARA' },
  { value: '07', label: 'ANTALYA' }, { value: '08', label: 'ARTVİN' }, { value: '09', label: 'AYDIN' },
  { value: '10', label: 'BALIKESİR' }, { value: '11', label: 'BİLECİK' }, { value: '12', label: 'BİNGÖL' },
  { value: '13', label: 'BİTLİS' }, { value: '14', label: 'BOLU' }, { value: '15', label: 'BURDUR' },
  { value: '16', label: 'BURSA' }, { value: '17', label: 'ÇANAKKALE' }, { value: '18', label: 'ÇANKIRI' },
  { value: '19', label: 'ÇORUM' }, { value: '20', label: 'DENİZLİ' }, { value: '21', label: 'DİYARBAKIR' },
  { value: '22', label: 'EDİRNE' }, { value: '23', label: 'ELAZIĞ' }, { value: '24', label: 'ERZİNCAN' },
  { value: '25', label: 'ERZURUM' }, { value: '26', label: 'ESKİŞEHİR' }, { value: '27', label: 'GAZİANTEP' },
  { value: '28', label: 'GİRESUN' }, { value: '29', label: 'GÜMÜŞHANE' }, { value: '30', label: 'HAKKARİ' },
  { value: '31', label: 'HATAY' }, { value: '32', label: 'ISPARTA' }, { value: '33', label: 'MERSİN' },
  { value: '34', label: 'İSTANBUL' }, { value: '35', label: 'İZMİR' }, { value: '36', label: 'KARS' },
  { value: '37', label: 'KASTAMONU' }, { value: '38', label: 'KAYSERİ' }, { value: '39', label: 'KIRKLARELİ' },
  { value: '40', label: 'KIRŞEHİR' }, { value: '41', label: 'KOCAELİ' }, { value: '42', label: 'KONYA' },
  { value: '43', label: 'KÜTAHYA' }, { value: '44', label: 'MALATYA' }, { value: '45', label: 'MANİSA' },
  { value: '46', label: 'KAHRAMANMARAŞ' }, { value: '47', label: 'MARDİN' }, { value: '48', label: 'MUĞLA' },
  { value: '49', label: 'MUŞ' }, { value: '50', label: 'NEVŞEHİR' }, { value: '51', label: 'NİĞDE' },
  { value: '52', label: 'ORDU' }, { value: '53', label: 'RİZE' }, { value: '54', label: 'SAKARYA' },
  { value: '55', label: 'SAMSUN' }, { value: '56', label: 'SİİRT' }, { value: '57', label: 'SİNOP' },
  { value: '58', label: 'SİVAS' }, { value: '59', label: 'TEKİRDAĞ' }, { value: '60', label: 'TOKAT' },
  { value: '61', label: 'TRABZON' }, { value: '62', label: 'TUNCELİ' }, { value: '63', label: 'ŞANLIURFA' },
  { value: '64', label: 'UŞAK' }, { value: '65', label: 'VAN' }, { value: '66', label: 'YOZGAT' },
  { value: '67', label: 'ZONGULDAK' }, { value: '68', label: 'AKSARAY' }, { value: '69', label: 'BAYBURT' },
  { value: '70', label: 'KARAMAN' }, { value: '71', label: 'KIRIKKALE' }, { value: '72', label: 'BATMAN' },
  { value: '73', label: 'ŞIRNAK' }, { value: '74', label: 'BARTIN' }, { value: '75', label: 'ARDAHAN' },
  { value: '76', label: 'IĞDIR' }, { value: '77', label: 'YALOVA' }, { value: '78', label: 'KARABÜK' },
  { value: '79', label: 'KİLİS' }, { value: '80', label: 'OSMANİYE' }, { value: '81', label: 'DÜZCE' }
];

const badgeStyles = {
  active: 'bg-primary-fixed text-on-primary-fixed-variant',
  review: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  clear: 'bg-primary-fixed text-on-primary-fixed-variant',
  pending: 'bg-primary-fixed text-on-primary-fixed-variant',
}

const ITEMS_PER_PAGE = 5

const emptyForm = {
  // Identity
  customerType: 'Company',
  fullName: '',
  companyName: '',
  taxId: '',
  taxOffice: '',
  country: '',
  ticaretSicil: '',
  mersisNo: '',
  bolge: '',
  cariTip: '',
  istatistikGrup: '',
  mukellefTipi: 'Vergi Mükellefi',
  // Address
  address: '',
  city: '',
  district: '',
  postalCode: '',
  phone: '',
  email: '',
  // Tax & Docs
  eInvoiceStatus: false,
  eArchiveStatus: false,
  eDispatchStatus: false,
  invoiceScenario: 'Basic',
  // Financial
  accountCode: '',
  accountType: 'Customer',
  currency: 'TRY',
  paymentTerm: '',
  creditLimit: '',
  // Bank
  bankName: '',
  iban: '',
  branchCode: '',
  accountHolder: '',
  // Invoicing & Payment
  invoiceType: '',
  paymentMethod: '',
  paymentTerms: '',
  // Contact Person
  contactName: '',
  contactPersonPhone: '',
  contactPersonEmail: '',
  contactNamePurchasing: '',
  contactPersonPhonePurchasing: '',
  contactPersonEmailPurchasing: '',
  contactPhone: '',
  contactEmail: '',
  contactPosition: '',
  // Optional
  industry: '',
  customerCategory: '',
  salesRepName: '',
  notes: '',
  gdprConsent: false,
}

function getTabDefs(t) {
  return [
    { id: 'identity',  label: t('customers.form.tabIdentity'),  icon: 'badge'                   },
    { id: 'address',   label: t('customers.form.tabAddress'),   icon: 'location_on'             },
    { id: 'tax',       label: t('customers.form.tabTax'),       icon: 'receipt_long'            },
    { id: 'financial', label: t('customers.form.tabFinancial'), icon: 'account_balance_wallet'  },
    { id: 'contact',   label: t('customers.form.tabContact'),   icon: 'contact_phone'           },
  ]
}

function getTabFields(tabId, form, t) {
  const f = (key) => t(`customers.form.${key}`)
  switch (tabId) {
    case 'identity':
      return [
        {
          id: 'customerType', label: f('customerType'), icon: 'category', type: 'select', col: 2,
          options: [{ value: 'Company', label: f('customerTypeCompany') }, { value: 'Individual', label: f('customerTypeIndividual') }],
        },
        ...(form.customerType === 'Individual'
          ? [{ id: 'fullName', label: f('fullName'), icon: 'person', type: 'text', col: 2, placeholder: f('fullNamePh') }]
          : [{ id: 'companyName', label: f('companyName'), icon: 'business', type: 'text', col: 2, placeholder: f('companyNamePh') }]
        ),
        {
          id: 'mukellefTipi', label: f('mukellefTipi'), icon: 'gavel', type: 'radio', col: 2,
          options: [
            { value: 'Vergi Mükellefi', label: f('vergiMukellef') },
            { value: 'Şahıs', label: f('sahis') },
          ],
        },
        {
          id: 'taxId', label: f('taxId'), icon: 'fingerprint', type: 'text', col: 2,
          placeholder: form.mukellefTipi === 'Şahıs' ? f('taxIdPh11') : f('taxIdPh10'),
          maxLength: form.mukellefTipi === 'Şahıs' ? 11 : 10,
        },
        { id: 'taxOffice', label: f('taxOffice'), icon: 'account_balance', type: 'text', col: 1, placeholder: f('taxOfficePh') },
        { id: 'country', label: f('country'), icon: 'public', type: 'text', col: 1, placeholder: f('countryPh') },
        { id: 'ticaretSicil', label: f('ticaretSicil'), icon: 'receipt', type: 'text', col: 1, placeholder: f('ticaretSicilPh') },
        { id: 'mersisNo', label: f('mersisNo'), icon: 'pin', type: 'text', col: 1, placeholder: f('mersisNoPh') },
        { id: 'bolge', label: f('bolge'), icon: 'travel_explore', type: 'select', col: 1, options: BOLGE_OPTIONS },
        {
          id: 'cariTip', label: f('cariTip'), icon: 'person_search', type: 'select', col: 1,
          options: [
            { value: '', label: f('select') },
            { value: 'Alıcı', label: f('alici') },
            { value: 'Satıcı', label: f('satici') },
            { value: 'Alıcı/Satıcı', label: f('aliciSatici') },
          ],
        },
        { id: 'istatistikGrup', label: f('istatistikGrup'), icon: 'bar_chart', type: 'text', col: 2, placeholder: f('istatistikGrupPh') },
      ]
    case 'address':
      return [
        { id: 'address', label: f('address'), icon: 'home', type: 'text', col: 2, placeholder: f('addressPh'), maxLength: 50 },
        { id: 'city', label: f('city'), icon: 'apartment', type: 'select', col: 1, options: CITY_OPTIONS },
        { id: 'district', label: f('district'), icon: 'map', type: 'text', col: 1, placeholder: f('districtPh') },
        { id: 'postalCode', label: f('postalCode'), icon: 'markunread_mailbox', type: 'text', col: 1, placeholder: f('postalCodePh') },
        { id: 'phone', label: f('phoneNumber'), icon: 'phone', type: 'tel', col: 1, placeholder: f('phonePh') },
        { id: 'email', label: f('emailAddress'), icon: 'mail', type: 'email', col: 1, placeholder: f('emailPh') },
        { id: 'contactPhone', label: f('contactPhone'), icon: 'smartphone', type: 'tel', col: 1, placeholder: f('phonePh') },
        { id: 'contactEmail', label: f('contactEmail'), icon: 'alternate_email', type: 'email', col: 1, placeholder: f('emailPh') },
      ]
    case 'tax':
      return [
        { id: 'eInvoiceStatus', label: f('eInvoiceStatus'), icon: 'receipt', type: 'toggle', col: 1 },
        { id: 'eArchiveStatus', label: f('eArchiveStatus'), icon: 'archive', type: 'toggle', col: 1 },
        { id: 'eDispatchStatus', label: f('eDispatchStatus'), icon: 'local_shipping', type: 'toggle', col: 1 },
        {
          id: 'invoiceScenario', label: f('invoiceScenario'), icon: 'description', type: 'select', col: 1,
          options: [{ value: 'Basic', label: f('basic') }, { value: 'Commercial', label: f('commercial') }],
        },
      ]
    case 'financial':
      return [
        { id: 'accountCode', label: f('accountCode'), icon: 'tag', type: 'text', col: 1, placeholder: f('accountCodePh') },
        {
          id: 'accountType', label: f('accountType'), icon: 'manage_accounts', type: 'select', col: 1,
          options: [{ value: 'Customer', label: f('accountTypeCustomer') }, { value: 'Vendor', label: f('accountTypeVendor') }, { value: 'Both', label: f('accountTypeBoth') }],
        },
        {
          id: 'currency', label: f('currency'), icon: 'currency_exchange', type: 'select', col: 1,
          options: [{ value: 'TRY', label: f('currencyTRY') }, { value: 'USD', label: f('currencyUSD') }, { value: 'EUR', label: f('currencyEUR') }],
        },
        { id: 'paymentTerm', label: f('paymentTerm'), icon: 'schedule', type: 'text', col: 1, placeholder: f('paymentTermPh') },
        { id: 'creditLimit', label: f('creditLimit'), icon: 'credit_score', type: 'number', col: 2, placeholder: '0.00' },
        { id: '_div_bank', label: f('bankInfo'), icon: 'account_balance', type: 'divider', col: 2 },
        { id: 'bankName', label: f('bankName'), icon: 'account_balance', type: 'text', col: 1, placeholder: f('bankNamePh') },
        { id: 'iban', label: f('iban'), icon: 'credit_card', type: 'text', col: 1, placeholder: f('ibanPh') },
        { id: 'branchCode', label: f('branchCode'), icon: 'store', type: 'text', col: 1, placeholder: f('branchCodePh') },
        { id: 'accountHolder', label: f('accountHolder'), icon: 'person', type: 'text', col: 1, placeholder: f('accountHolderPh') },
        { id: '_div_pay', label: f('invoicePaySettings'), icon: 'payments', type: 'divider', col: 2 },
        {
          id: 'invoiceType', label: f('invoiceType'), icon: 'description', type: 'select', col: 1,
          options: [{ value: '', label: f('select') }, { value: 'e-Invoice', label: f('eInvoice') }, { value: 'e-Archive', label: f('eArchive') }],
        },
        {
          id: 'paymentMethod', label: f('paymentMethod'), icon: 'payments', type: 'select', col: 1,
          options: [{ value: '', label: f('select') }, { value: 'Cash', label: f('cash') }, { value: 'Transfer', label: f('transfer') }, { value: 'Check', label: f('check') }, { value: 'Note', label: f('promissoryNote') }],
        },
        {
          id: 'paymentTerms', label: f('paymentTerms'), icon: 'schedule_send', type: 'select', col: 2,
          options: [{ value: '', label: f('select') }, { value: 'Cash', label: f('cash') }, { value: 'Deferred', label: f('deferred') }],
        },
      ]
    case 'contact':
      return [
        { id: 'contactName', label: f('contactName'), icon: 'person', type: 'text', col: 2, placeholder: f('contactNamePh') },
        { id: 'contactPersonPhone', label: f('contactPersonPhone'), icon: 'phone_in_talk', type: 'tel', col: 1, placeholder: f('personPhonePh') },
        { id: 'contactPersonEmail', label: f('contactPersonEmail'), icon: 'forward_to_inbox', type: 'email', col: 1, placeholder: f('personEmailPh') },
        { id: 'contactNamePurchasing', label: f('contactNamePurchasing'), icon: 'person', type: 'text', col: 2, placeholder: f('contactNamePh') },
        { id: 'contactPersonPhonePurchasing', label: f('contactPersonPhonePurchasing'), icon: 'phone_in_talk', type: 'tel', col: 1, placeholder: f('personPhonePh') },
        { id: 'contactPersonEmailPurchasing', label: f('contactPersonEmailPurchasing'), icon: 'forward_to_inbox', type: 'email', col: 1, placeholder: f('personEmailPh') },
        { id: '_div_opt', label: f('optionalFields'), icon: 'tune', type: 'divider', col: 2 },
        { id: 'industry', label: f('industry'), icon: 'factory', type: 'text', col: 1, placeholder: f('industryPh') },
        {
          id: 'customerCategory', label: f('customerCategory'), icon: 'grade', type: 'select', col: 1,
          options: [{ value: '', label: f('select') }, { value: 'A', label: f('catA') }, { value: 'B', label: f('catB') }, { value: 'C', label: f('catC') }],
        },
        { id: 'salesRepName', label: f('salesRepName'), icon: 'badge', type: 'text', col: 2, placeholder: f('salesRepNamePh') },
        { id: 'notes', label: f('notesRemarks'), icon: 'edit_note', type: 'textarea', col: 2, placeholder: f('notesPh') },
        { id: 'gdprConsent', label: f('gdprConsent'), icon: 'verified_user', type: 'toggle', col: 2 },
      ]
    default:
      return []
  }
}

function FieldInput({ field, value, onChange, error }) {
  const { t } = useTranslation()
  const { id, label, icon, type, placeholder, options, maxLength } = field

  if (type === 'divider') {
    return (
      <div className="col-span-1 md:col-span-2 flex items-center gap-3 pt-1">
        <div className="flex-1 h-px bg-surface-container-high" />
        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">{icon}</span>
          {label}
        </span>
        <div className="flex-1 h-px bg-surface-container-high" />
      </div>
    )
  }

  if (type === 'radio') {
    return (
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
          {label}
        </label>
        <div className="flex gap-1.5 sm:gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-2 sm:px-3 sm:py-2.5 rounded-lg transition-all ${
                value === o.value
                  ? 'bg-primary/10 ring-2 ring-primary text-primary'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px] flex-shrink-0">
                {value === o.value ? 'radio_button_checked' : 'radio_button_unchecked'}
              </span>
              <span className="text-[11px] sm:text-sm font-semibold leading-tight text-center whitespace-nowrap">{o.label}</span>
            </button>
          ))}
        </div>
        {error && <p className="text-[10px] text-error font-medium mt-1">{error}</p>}
      </div>
    )
  }

  if (type === 'toggle') {
    return (
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
          {label}
        </label>
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2 py-2 sm:px-3 sm:py-2.5 rounded-lg transition-all w-full ${
            value ? 'bg-primary/10 ring-2 ring-primary' : 'bg-surface-container-high'
          }`}
        >
          <span className={`material-symbols-outlined text-[18px] sm:text-[20px] flex-shrink-0 ${value ? 'text-primary' : 'text-on-surface-variant'}`}>
            {value ? 'toggle_on' : 'toggle_off'}
          </span>
          <span className={`text-[11px] sm:text-sm font-semibold whitespace-nowrap ${value ? 'text-primary' : 'text-on-surface-variant'}`}>
            {value ? t('common.yesActive') : t('common.noInactive')}
          </span>
        </button>
      </div>
    )
  }

  if (type === 'select') {
    return (
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
          {label}
        </label>
        <div className={`flex items-center gap-1.5 sm:gap-2 bg-surface-container-high rounded-lg px-2.5 py-2 sm:px-3 sm:py-2.5 transition-all ${
          error ? 'ring-2 ring-error' : 'focus-within:ring-2 focus-within:ring-primary'
        }`}>
          <span className="material-symbols-outlined text-on-surface-variant text-[16px] sm:text-[18px] flex-shrink-0">{icon}</span>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-transparent border-none outline-none text-[13px] sm:text-sm text-on-surface w-full"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-[10px] text-error font-medium mt-1">{error}</p>}
      </div>
    )
  }

  if (type === 'textarea') {
    return (
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
          {label}
        </label>
        <div className={`flex items-start gap-1.5 sm:gap-2 bg-surface-container-high rounded-lg px-2.5 py-2 sm:px-3 sm:py-2.5 transition-all ${
          error ? 'ring-2 ring-error' : 'focus-within:ring-2 focus-within:ring-primary'
        }`}>
          <span className="material-symbols-outlined text-on-surface-variant text-[16px] sm:text-[18px] flex-shrink-0 mt-0.5">{icon}</span>
          <textarea
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="bg-transparent border-none outline-none text-[13px] sm:text-sm text-on-surface w-full placeholder-slate-400 resize-none"
          />
        </div>
        {error && <p className="text-[10px] text-error font-medium mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
        {label}
      </label>
      <div className={`flex items-center gap-1.5 sm:gap-2 bg-surface-container-high rounded-lg px-2.5 py-2 sm:px-3 sm:py-2.5 transition-all ${
        error ? 'ring-2 ring-error' : 'focus-within:ring-2 focus-within:ring-primary'
      }`}>
        <span className="material-symbols-outlined text-on-surface-variant text-[16px] sm:text-[18px] flex-shrink-0">{icon}</span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          className="bg-transparent border-none outline-none text-[13px] sm:text-sm text-on-surface w-full placeholder-slate-400"
        />
      </div>
      {error && <p className="text-[10px] text-error font-medium mt-1">{error}</p>}
    </div>
  )
}

function AddCustomerModal({ onClose, onSave }) {
  const { t } = useTranslation()
  const tabDefs = getTabDefs(t)
  const [activeTab, setActiveTab] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})

  const set = (field) => (val) =>
    setForm((f) => ({ ...f, [field]: val }))

  function validate() {
    const e = {}
    const name = form.customerType === 'Individual' ? form.fullName : form.companyName
    if (!name.trim()) {
      e[form.customerType === 'Individual' ? 'fullName' : 'companyName'] = 'Required'
    }
    if (!form.phone.trim()) e.phone = 'Required'
    else if (!/^[+\d\s\-().]{7,}$/.test(form.phone)) e.phone = 'Invalid phone number'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address'
    if (form.contactPersonEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactPersonEmail)) e.contactPersonEmail = 'Invalid email'
    if (form.contactPersonEmailPurchasing.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactPersonEmailPurchasing)) e.contactPersonEmailPurchasing = 'Invalid email'
    if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) e.contactEmail = 'Invalid email'
    if (form.taxId.trim()) {
      const expected = form.mukellefTipi === 'Şahıs' ? 11 : 10
      if (!/^\d+$/.test(form.taxId) || form.taxId.length !== expected)
        e.taxId = `${expected} haneli rakam giriniz`
    }
    return e
  }

  function handleSave() {
    const e = validate()
    if (Object.keys(e).length) {
      setErrors(e)
      // jump to first tab containing an error
      const errorIds = new Set(Object.keys(e))
      for (let i = 0; i < tabDefs.length; i++) {
        const fields = getTabFields(tabDefs[i].id, form, t)
        if (fields.some((f) => errorIds.has(f.id))) { setActiveTab(i); break }
      }
      return
    }
    onSave(form)
  }

  const fields = getTabFields(tabDefs[activeTab].id, form, t)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface-container-lowest rounded-3xl shadow-2xl shadow-inverse-surface/20 w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-8 pt-7 pb-5 border-b border-surface-container-low flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 primary-gradient rounded-xl flex items-center justify-center text-white">
              <span className="material-symbols-outlined fill-icon">person_add</span>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-on-surface">{t('customers.newCustomer')}</h2>
              <p className="text-[10px] sm:text-xs text-on-surface-variant">{t('customers.addPartner')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center justify-start gap-1 px-4 lg:px-6 pt-4 pb-0 flex-shrink-0 overflow-x-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabDefs.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(i)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-t-lg text-[11px] lg:text-xs font-bold transition-all flex-shrink-0 whitespace-nowrap ${
                activeTab === i
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-4 md:px-8 py-5 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto flex-1 border-t border-surface-container-low mt-0">
          {fields.map((field) => {
            const colClass = field.col === 2 ? 'col-span-1 md:col-span-2' : 'col-span-1'
            const val = form[field.id] ?? ''
            return (
              <div key={field.id} className={colClass}>
                <FieldInput
                  field={field}
                  value={val}
                  onChange={set(field.id)}
                  error={errors[field.id]}
                />
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end lg:justify-between gap-4 px-4 lg:px-8 pb-4 lg:pb-7 pt-4 border-t border-surface-container-low flex-shrink-0">
          {/* Prev/Next (Desktop Only) */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => setActiveTab((t) => Math.max(0, t - 1))}
              disabled={activeTab === 0}
              className="px-4 py-2.5 rounded-xl text-on-surface-variant text-sm font-semibold hover:bg-surface-container-low transition-colors disabled:opacity-40 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
              {t('common.prev')}
            </button>
            <button
              onClick={() => setActiveTab((t) => Math.min(tabDefs.length - 1, t + 1))}
              disabled={activeTab === tabDefs.length - 1}
              className="px-4 py-2.5 rounded-xl text-on-surface-variant text-sm font-semibold hover:bg-surface-container-low transition-colors disabled:opacity-40 flex items-center gap-1"
            >
              {t('common.next')}
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 w-full lg:w-auto">
            <button
              onClick={onClose}
              className="flex-1 lg:flex-none px-4 py-2 lg:px-5 lg:py-2.5 rounded-xl text-on-surface-variant text-xs lg:text-sm font-semibold hover:bg-surface-container-low transition-colors flex items-center justify-center"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 lg:flex-none px-4 py-2 lg:px-6 lg:py-2.5 rounded-xl primary-gradient text-white text-xs lg:text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center"
            >
              {t('customers.saveCustomer')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-surface-container-low last:border-0">
      <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="material-symbols-outlined text-on-surface-variant text-[18px]">{icon}</span>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
        <p className="text-sm font-semibold text-on-surface mt-0.5">{value || '—'}</p>
      </div>
    </div>
  )
}

function SectionHeader({ icon, label }) {
  return (
    <div className="flex items-center gap-3 py-2 col-span-1 md:col-span-2">
      <div className="flex-1 h-px bg-surface-container-high" />
      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {label}
      </span>
      <div className="flex-1 h-px bg-surface-container-high" />
    </div>
  )
}

function fmtNum(n) {
  return (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function OrdersTab({ customerOrders }) {
  const { t } = useTranslation()
  const [expandedId, setExpandedId] = useState(null)

  if (customerOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant flex-1">
        <span className="material-symbols-outlined text-5xl mb-3 opacity-30">shopping_bag</span>
        <p className="text-sm font-semibold">No orders yet</p>
        <p className="text-xs mt-1 opacity-70">Orders for this customer will appear here</p>
      </div>
    )
  }

  const total = customerOrders.reduce((s, o) => s + (o.totalAmount || 0), 0)
  const open  = customerOrders.filter((o) => o.status !== 'Delivered').length

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Summary bar */}
      <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-2 sm:py-3 bg-surface-container-low border-b border-surface-container text-[10px] sm:text-xs flex-shrink-0 overflow-x-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="text-on-surface-variant whitespace-nowrap">
          <span className="hidden sm:inline">{t('customers.totalOrders')}</span>
          <span className="sm:hidden">Top. S.</span>: <span className="font-bold text-on-surface">{customerOrders.length}</span>
        </div>
        <div className="text-on-surface-variant whitespace-nowrap">
          <span className="hidden sm:inline">{t('customers.openOrders')}</span>
          <span className="sm:hidden">Açık</span>: <span className="font-bold text-on-surface">{open}</span>
        </div>
        <div className="text-on-surface-variant whitespace-nowrap ml-auto">
          <span className="hidden sm:inline">{t('customers.totalValue')}</span>
          <span className="sm:hidden">Değer</span>: <span className="font-bold text-on-surface">{fmtNum(total)}</span>
        </div>
      </div>

      <div className="overflow-x-hidden overflow-y-auto flex-1 px-4 sm:px-0 pb-4">
        <table className="w-full text-sm block sm:table mt-4 sm:mt-0">
          <thead className="hidden sm:table-header-group sticky top-0 bg-surface-container-lowest border-b border-surface-container-low z-10">
            <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <th className="w-8" />
              <th className="text-left px-4 py-3">{t('orders.order')}</th>
              <th className="text-left px-4 py-3">{t('common.status')}</th>
              <th className="text-left px-4 py-3">{t('orders.payment')}</th>
              <th className="text-right px-4 py-3">Items</th>
              <th className="text-left px-4 py-3">{t('common.currency')}</th>
              <th className="text-right px-6 py-3">{t('orders.total')}</th>
            </tr>
          </thead>
          <tbody className="block sm:table-row-group">
            {customerOrders.map((o) => {
              const isExpanded = expandedId === o.id
              const hasItems = (o.items || []).length > 0
              return (
                <>
                  <tr
                    key={o.id}
                    onClick={() => hasItems && setExpandedId(isExpanded ? null : o.id)}
                    className={`block sm:table-row border border-theme-border sm:border-0 sm:border-b sm:border-surface-container-low transition-colors ${hasItems ? 'cursor-pointer hover:bg-surface-container-low' : ''} ${isExpanded ? 'bg-surface-container-low' : ''} p-4 sm:p-0 mb-4 sm:mb-0 bg-surface-container-low/30 sm:bg-transparent rounded-xl sm:rounded-none relative`}
                  >
                    <td className="hidden sm:table-cell pl-4 py-3 text-center">
                      {hasItems && (
                        <span className="material-symbols-outlined text-sm text-on-surface-variant">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      )}
                    </td>
                    <td className="block sm:table-cell p-0 sm:px-4 sm:py-3 mb-2 sm:mb-0">
                      <div className="flex items-center justify-between sm:block pr-8 sm:pr-0">
                        <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('orders.order')}</span>
                        <div className="text-right sm:text-left">
                          <p className="font-bold text-on-surface text-xs">{o.code}</p>
                          <p className="text-[10px] text-on-surface-variant mt-0.5">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="block sm:table-cell p-0 sm:px-4 sm:py-3 mb-2 sm:mb-0">
                      <div className="flex items-center justify-between sm:block">
                        <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('common.status')}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${ORDER_STATUS_CLS[o.status] || 'bg-surface-container text-on-surface-variant'}`}>
                          {o.status || 'Draft'}
                        </span>
                      </div>
                    </td>
                    <td className="block sm:table-cell p-0 sm:px-4 sm:py-3 mb-2 sm:mb-0">
                      <div className="flex items-center justify-between sm:block">
                        <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('orders.payment')}</span>
                        <span className="text-xs text-on-surface-variant">{o.paymentMethod || '—'}</span>
                      </div>
                    </td>
                    <td className="block sm:table-cell p-0 sm:px-4 sm:py-3 mb-2 sm:mb-0">
                      <div className="flex items-center justify-between sm:block">
                        <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Items</span>
                        <span className="text-right text-xs font-semibold text-on-surface">{(o.items || []).length}</span>
                      </div>
                    </td>
                    <td className="block sm:table-cell p-0 sm:px-4 sm:py-3 mb-2 sm:mb-0">
                      <div className="flex items-center justify-between sm:block">
                        <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('common.currency')}</span>
                        <span className="text-xs font-semibold text-on-surface text-right">{o.items?.[0]?.product?.currency || '—'}</span>
                      </div>
                    </td>
                    <td className="block sm:table-cell p-0 sm:px-6 sm:py-3 mt-3 sm:mt-0 pt-3 sm:pt-0 border-t border-theme-border sm:border-0">
                      <div className="flex items-center justify-between sm:block">
                        <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('orders.total')}</span>
                        <span className="text-right font-bold text-sm text-on-surface">{fmtNum(o.totalAmount)}</span>
                      </div>
                    </td>
                    {hasItems && (
                      <div className="sm:hidden absolute top-4 right-4 w-6 h-6 rounded-full bg-surface-container flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm text-on-surface-variant">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    )}
                  </tr>

                  {/* Expanded items */}
                  {isExpanded && (
                    <tr key={`${o.id}-items`} className="block sm:table-row border-b border-surface-container-low bg-surface-container-low/50 -mt-5 sm:mt-0 pt-2 sm:pt-0 rounded-b-xl sm:rounded-none relative z-0">
                      <td colSpan={7} className="block sm:table-cell px-3 sm:px-6 pb-4 pt-4 sm:pt-1">
                        <div className="overflow-hidden sm:overflow-x-auto rounded-xl sm:rounded-none bg-surface-container-lowest sm:bg-transparent border border-theme-border sm:border-0 p-2 sm:p-0">
                          <table className="w-full text-xs block sm:table min-w-0 sm:min-w-[500px]">
                          <thead className="hidden sm:table-header-group">
                            <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-surface-container">
                              <th className="text-left py-1.5 pr-4">{t('orders.product')}</th>
                              <th className="text-right py-1.5 pr-4">{t('orders.qty')}</th>
                              <th className="text-left py-1.5 pr-4">{t('common.unit')}</th>
                              <th className="text-right py-1.5 pr-4">{t('orders.unitPrice')}</th>
                              <th className="text-right py-1.5 pr-4">{t('orders.vat')}</th>
                              <th className="text-right py-1.5">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="block sm:table-row-group">
                            {o.items.map((item) => (
                              <tr key={item.id} className="block sm:table-row border-b border-surface-container last:border-0 p-2 sm:p-0">
                                <td className="block sm:table-cell py-1 sm:py-1.5 pr-0 sm:pr-4 flex justify-between items-center sm:table-cell">
                                  <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('orders.product')}</span>
                                  <span className="font-medium text-on-surface text-right sm:text-left">{item.product?.name || '—'}</span>
                                </td>
                                <td className="block sm:table-cell py-1 sm:py-1.5 pr-0 sm:pr-4 flex justify-between items-center sm:table-cell text-right text-on-surface tabular-nums">
                                  <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('orders.qty')}</span>
                                  {item.qty}
                                </td>
                                <td className="block sm:table-cell py-1 sm:py-1.5 pr-0 sm:pr-4 flex justify-between items-center sm:table-cell text-on-surface-variant">
                                  <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('common.unit')}</span>
                                  {item.product?.unit || '—'}
                                </td>
                                <td className="block sm:table-cell py-1 sm:py-1.5 pr-0 sm:pr-4 flex justify-between items-center sm:table-cell text-right tabular-nums text-on-surface">
                                  <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('orders.unitPrice')}</span>
                                  <div>
                                    {fmtNum(item.price)}
                                    {item.product?.currency && (
                                      <span className="text-on-surface-variant ml-1">{item.product.currency}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="block sm:table-cell py-1 sm:py-1.5 pr-0 sm:pr-4 flex justify-between items-center sm:table-cell text-right text-on-surface-variant">
                                  <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('orders.vat')}</span>
                                  {item.vat ? `${item.vat}%` : '—'}
                                </td>
                                <td className="block sm:table-cell py-1 sm:py-1.5 flex justify-between items-center sm:table-cell text-right font-semibold tabular-nums text-on-surface mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-surface-container sm:border-0">
                                  <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Subtotal</span>
                                  {fmtNum(item.qty * item.price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const ORDER_STATUS_CLS = {
  'Draft':                'bg-surface-container text-on-surface-variant',
  'Processing':           'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  'Confirmed':            'bg-primary-fixed text-on-primary-fixed-variant',
  'In-Production':        'bg-secondary-container text-on-secondary-container',
  'Production Completed': 'bg-secondary-container text-on-secondary-container',
  'E-WayBill':            'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  'In Delivery':          'bg-primary/10 text-primary',
  'E-Invoice':            'bg-primary/10 text-primary',
  'Delivered':            'bg-primary-fixed text-on-primary-fixed-variant',
}

function CustomerDetailModal({ customer, reports, onClose, onSave, onDelete }) {
  const { t } = useTranslation()
  const tabDefs = getTabDefs(t)
  const { isAdmin, orders, financeRecords } = useData()
  const [viewTab, setViewTab] = useState('info')
  const [editing, setEditing] = useState(false)
  const [editTab, setEditTab] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [errors, setErrors] = useState({})

  const customerOrders = orders.filter((o) => o.customerId === customer.id)
  const customerOrderIds = new Set(customerOrders.map((o) => o.id))
  let customerFinance = financeRecords.filter((f) => f.orderId && customerOrderIds.has(f.orderId))

  const [form, setForm] = useState({
    customerType:    customer.customerType    || 'Company',
    fullName:        customer.fullName        || '',
    companyName:     customer.name            || '',
    taxId:           customer.taxId           || '',
    taxOffice:       customer.taxOffice       || '',
    country:         customer.country         || '',
    ticaretSicil:    customer.ticaretSicil    || '',
    mersisNo:        customer.mersisNo        || '',
    bolge:           customer.bolge           || '',
    cariTip:         customer.cariTip         || '',
    istatistikGrup:  customer.istatistikGrup  || '',
    mukellefTipi:    customer.mukellefTipi    || 'Vergi Mükellefi',
    address:         customer.address         || '',
    city:            customer.city            || '',
    district:        customer.district        || '',
    postalCode:      customer.postalCode      || '',
    phone:           customer.phone           || '',
    email:           customer.email           || '',
    eInvoiceStatus:  customer.eInvoiceStatus  || false,
    eArchiveStatus:  customer.eArchiveStatus  || false,
    eDispatchStatus: customer.eDispatchStatus || false,
    invoiceScenario: customer.invoiceScenario || 'Basic',
    accountCode:     customer.accountCode     || '',
    accountType:     customer.accountType     || 'Customer',
    currency:        customer.currency        || 'TRY',
    paymentTerm:     customer.paymentTerm     || '',
    creditLimit:     customer.creditLimit != null ? String(customer.creditLimit) : '',
    bankName:        customer.bankName        || '',
    iban:            customer.iban            || '',
    branchCode:      customer.branchCode      || '',
    accountHolder:   customer.accountHolder   || '',
    invoiceType:     customer.invoiceType     || '',
    paymentMethod:   customer.paymentMethod   || '',
    paymentTerms:    customer.paymentTerms    || '',
    contactName:                  customer.contactName                  || '',
    contactPersonPhone:           customer.contactPersonPhone           || '',
    contactPersonEmail:           customer.contactPersonEmail           || '',
    contactNamePurchasing:        customer.contactNamePurchasing        || '',
    contactPersonPhonePurchasing: customer.contactPersonPhonePurchasing || '',
    contactPersonEmailPurchasing: customer.contactPersonEmailPurchasing || '',
    contactPhone:                 customer.contactPhone                 || '',
    contactEmail:        customer.contactEmail        || '',
    contactPosition:     customer.contactPosition     || '',
    industry:        customer.industry        || '',
    customerCategory: customer.customerCategory || '',
    salesRepName:    customer.salesRepName    || '',
    notes:           customer.notes           || '',
    gdprConsent:     customer.gdprConsent     || false,
  })

  useEffect(() => {
    if (!editing) {
      setForm({
        customerType:    customer.customerType    || 'Company',
        fullName:        customer.fullName        || '',
        companyName:     customer.name            || '',
        taxId:           customer.taxId           || '',
        taxOffice:       customer.taxOffice       || '',
        country:         customer.country         || '',
        ticaretSicil:    customer.ticaretSicil    || '',
        mersisNo:        customer.mersisNo        || '',
        bolge:           customer.bolge           || '',
        cariTip:         customer.cariTip         || '',
        istatistikGrup:  customer.istatistikGrup  || '',
        mukellefTipi:    customer.mukellefTipi    || 'Vergi Mükellefi',
        address:         customer.address         || '',
        city:            customer.city            || '',
        district:        customer.district        || '',
        postalCode:      customer.postalCode      || '',
        phone:           customer.phone           || '',
        email:           customer.email           || '',
        eInvoiceStatus:  customer.eInvoiceStatus  || false,
        eArchiveStatus:  customer.eArchiveStatus  || false,
        eDispatchStatus: customer.eDispatchStatus || false,
        invoiceScenario: customer.invoiceScenario || 'Basic',
        accountCode:     customer.accountCode     || '',
        accountType:     customer.accountType     || 'Customer',
        currency:        customer.currency        || 'TRY',
        paymentTerm:     customer.paymentTerm     || '',
        creditLimit:     customer.creditLimit != null ? String(customer.creditLimit) : '',
        bankName:        customer.bankName        || '',
        iban:            customer.iban            || '',
        branchCode:      customer.branchCode      || '',
        accountHolder:   customer.accountHolder   || '',
        invoiceType:     customer.invoiceType     || '',
        paymentMethod:   customer.paymentMethod   || '',
        paymentTerms:    customer.paymentTerms    || '',
        contactName:                  customer.contactName                  || '',
        contactPersonPhone:           customer.contactPersonPhone           || '',
        contactPersonEmail:           customer.contactPersonEmail           || '',
        contactNamePurchasing:        customer.contactNamePurchasing        || '',
        contactPersonPhonePurchasing: customer.contactPersonPhonePurchasing || '',
        contactPersonEmailPurchasing: customer.contactPersonEmailPurchasing || '',
        contactPhone:                 customer.contactPhone                 || '',
        contactEmail:        customer.contactEmail        || '',
        contactPosition:     customer.contactPosition     || '',
        industry:        customer.industry        || '',
        customerCategory: customer.customerCategory || '',
        salesRepName:    customer.salesRepName    || '',
        notes:           customer.notes           || '',
        gdprConsent:     customer.gdprConsent     || false,
      })
    }
  }, [customer, editing])

  const set = (field) => (val) => setForm((f) => ({ ...f, [field]: val }))

  function validate() {
    const e = {}
    const name = form.customerType === 'Individual' ? form.fullName : form.companyName
    if (!name.trim()) e[form.customerType === 'Individual' ? 'fullName' : 'companyName'] = 'Required'
    if (form.phone.trim() && !/^[+\d\s\-().]{7,}$/.test(form.phone)) e.phone = 'Invalid phone number'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    if (form.contactPersonEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactPersonEmail)) e.contactPersonEmail = 'Invalid email'
    if (form.contactPersonEmailPurchasing.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactPersonEmailPurchasing)) e.contactPersonEmailPurchasing = 'Invalid email'
    if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) e.contactEmail = 'Invalid email'
    if (form.taxId.trim()) {
      const expected = form.mukellefTipi === 'Şahıs' ? 11 : 10
      if (!/^\d+$/.test(form.taxId) || form.taxId.length !== expected)
        e.taxId = `${expected} haneli rakam giriniz`
    }
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    await onSave(customer.id, form)
    setEditing(false)
    setErrors({})
  }

  function handleCancel() {
    setViewTab('info')
    setForm({
      customerType:    customer.customerType    || 'Company',
      fullName:        customer.fullName        || '',
      companyName:     customer.name            || '',
      taxId:           customer.taxId           || '',
      taxOffice:       customer.taxOffice       || '',
      country:         customer.country         || '',
      ticaretSicil:    customer.ticaretSicil    || '',
      mersisNo:        customer.mersisNo        || '',
      bolge:           customer.bolge           || '',
      cariTip:         customer.cariTip         || '',
      istatistikGrup:  customer.istatistikGrup  || '',
      mukellefTipi:    customer.mukellefTipi    || 'Vergi Mükellefi',
      address:         customer.address         || '',
      city:            customer.city            || '',
      district:        customer.district        || '',
      postalCode:      customer.postalCode      || '',
      phone:           customer.phone           || '',
      email:           customer.email           || '',
      eInvoiceStatus:  customer.eInvoiceStatus  || false,
      eArchiveStatus:  customer.eArchiveStatus  || false,
      eDispatchStatus: customer.eDispatchStatus || false,
      invoiceScenario: customer.invoiceScenario || 'Basic',
      accountCode:     customer.accountCode     || '',
      accountType:     customer.accountType     || 'Customer',
      currency:        customer.currency        || 'TRY',
      paymentTerm:     customer.paymentTerm     || '',
      creditLimit:     customer.creditLimit != null ? String(customer.creditLimit) : '',
      bankName:        customer.bankName        || '',
      iban:            customer.iban            || '',
      branchCode:      customer.branchCode      || '',
      accountHolder:   customer.accountHolder   || '',
      invoiceType:     customer.invoiceType     || '',
      paymentMethod:   customer.paymentMethod   || '',
      paymentTerms:    customer.paymentTerms    || '',
      contactName:     customer.contactName     || '',
      contactPhone:    customer.contactPhone    || '',
      contactEmail:    customer.contactEmail    || '',
      contactPosition: customer.contactPosition || '',
      industry:        customer.industry        || '',
      customerCategory: customer.customerCategory || '',
      salesRepName:    customer.salesRepName    || '',
      notes:           customer.notes           || '',
      gdprConsent:     customer.gdprConsent     || false,
    })
    setErrors({})
    setEditing(false)
    setEditTab(0)
  }

  const editFields = getTabFields(tabDefs[editTab].id, form, t)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface-container-lowest rounded-3xl shadow-2xl shadow-inverse-surface/20 w-full max-w-2xl flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Header banner */}
        <div className="primary-gradient px-4 md:px-8 pt-6 md:pt-8 pb-6 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-surface-container-lowest/20 rounded-2xl flex items-center justify-center text-white font-black text-xl">
                {customer.initials}
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white leading-tight">
                  {editing ? t('customers.editCustomer') : customer.name}
                </h2>
                <p className="text-blue-200 text-[10px] sm:text-xs font-medium mt-0.5">ID: #{customer.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-surface-container-lowest/10 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {!editing && (
            <div className="hidden lg:flex flex-wrap items-center gap-2 mt-5">
              <div className="bg-surface-container-lowest/10 rounded-lg px-3 py-1.5 text-center">
                <p className="text-white font-black text-base sm:text-lg leading-none">
                  {(reports || []).filter((r) => r.customerId === customer.id).length}
                </p>
                <p className="text-blue-200 text-[10px] font-bold uppercase tracking-wider mt-0.5">{t('nav.tasks')}</p>
              </div>
              <div className="bg-surface-container-lowest/10 rounded-lg px-3 py-1.5 text-center">
                <p className="text-white font-black text-base sm:text-lg leading-none">{customerOrders.length}</p>
                <p className="text-blue-200 text-[10px] font-bold uppercase tracking-wider mt-0.5">{t('customers.tabOrders')}</p>
              </div>
              <div className="bg-surface-container-lowest/10 rounded-lg px-3 py-1.5 text-center">
                <p className="text-white font-black text-base sm:text-lg leading-none">{customerFinance.length}</p>
                <p className="text-blue-200 text-[10px] font-bold uppercase tracking-wider mt-0.5">{t('customers.tabFinance')}</p>
              </div>
              {customer.customerType && (
                <span className="bg-surface-container-lowest/10 text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg">
                  {customer.customerType}
                </span>
              )}
              {customer.customerCategory && (
                <span className="bg-surface-container-lowest/10 text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg">
                  Cat. {customer.customerCategory}
                </span>
              )}
              {customer.flagged && (
                <span className="ml-auto bg-tertiary-fixed text-tertiary text-[10px] font-black uppercase px-3 py-1.5 rounded-lg flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  {t('customers.reviewRequired')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* View mode — tabbed */}
        {!editing && (
          <>
            {/* Sub-tab bar */}
            <div className="flex w-full justify-between sm:justify-start items-center gap-1 px-2 sm:px-6 pt-3 pb-0 border-b border-surface-container-low flex-shrink-0 overflow-x-auto scrollbar-thin">
              {[
                { key: 'info',    label: t('customers.tabInfo'),    icon: 'person' },
                { key: 'orders',  label: t('customers.tabOrders'),  icon: 'shopping_bag',           count: customerOrders.length },
                { key: 'finance', label: t('customers.tabFinance'), icon: 'account_balance_wallet', count: customerFinance.length },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setViewTab(t.key)}
                  className={`flex flex-col sm:flex-row flex-1 sm:flex-none items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-2 sm:py-2.5 rounded-t-xl text-[10px] sm:text-sm font-bold transition-all relative ${
                    viewTab === t.key
                      ? 'text-primary bg-primary/5'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg sm:text-lg">{t.icon}</span>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-center leading-none sm:leading-normal">{t.label}</span>
                    {t.count !== undefined && (
                      <span className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-xs leading-none sm:leading-normal ${viewTab === t.key ? 'bg-primary text-white' : 'bg-surface-container-highest text-on-surface'}`}>
                        {t.count}
                      </span>
                    )}
                  </div>
                  {viewTab === t.key && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Info tab */}
            {viewTab === 'info' && (
              <div className="px-4 md:px-8 py-4 overflow-y-auto flex-1 space-y-0">
                <DetailRow icon="category"    label="Customer Type"     value={customer.customerType} />
                {customer.customerType === 'Individual' && (
                  <DetailRow icon="person"    label="Full Name"         value={customer.fullName} />
                )}
                <DetailRow icon="fingerprint" label="Tax ID (TIN/TCKN)" value={customer.taxId} />
                <DetailRow icon="gavel"          label="Mükellef Tipi" value={customer.mukellefTipi || 'Vergi Mükellefi'} />
                <DetailRow icon="account_balance" label="Tax Office"    value={customer.taxOffice} />
                <DetailRow icon="receipt"        label="Ticaret Sicil No" value={customer.ticaretSicil} />
                <DetailRow icon="pin"            label="Mersis No"        value={customer.mersisNo} />
                <DetailRow icon="travel_explore" label="Bölge"            value={customer.bolge} />
                <DetailRow icon="person_search"  label="Cari Tip"         value={customer.cariTip} />
                <DetailRow icon="bar_chart"      label="İstatistik Grup"  value={customer.istatistikGrup} />
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-surface-container-high" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    Address & Contact
                  </span>
                  <div className="flex-1 h-px bg-surface-container-high" />
                </div>
                <DetailRow icon="home"               label="Address"      value={customer.address} />
                <DetailRow icon="apartment"          label="City"         value={customer.city} />
                <DetailRow icon="map"                label="District"     value={customer.district} />
                <DetailRow icon="markunread_mailbox" label="Postal Code"  value={customer.postalCode} />
                <DetailRow icon="public"             label="Country"      value={customer.country} />
                <DetailRow icon="phone"              label="Phone"                  value={customer.phone} />
                <DetailRow icon="mail"               label="Email"                  value={customer.email} />
                <DetailRow icon="smartphone"         label="Customer Phone Number"  value={customer.contactPhone} />
                <DetailRow icon="alternate_email"    label="Customer Email Address" value={customer.contactEmail} />
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-surface-container-high" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                    Tax & e-Document
                  </span>
                  <div className="flex-1 h-px bg-surface-container-high" />
                </div>
                <DetailRow icon="receipt"      label="e-Invoice"         value={customer.eInvoiceStatus ? t('common.active') : t('common.inactive')} />
                <DetailRow icon="archive"      label="e-Archive Invoice" value={customer.eArchiveStatus ? t('common.active') : t('common.inactive')} />
                <DetailRow icon="local_shipping" label="e-Dispatch"      value={customer.eDispatchStatus ? t('common.active') : t('common.inactive')} />
                <DetailRow icon="description"  label="Invoice Scenario"  value={customer.invoiceScenario} />
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-surface-container-high" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                    Financial & Bank
                  </span>
                  <div className="flex-1 h-px bg-surface-container-high" />
                </div>
                <DetailRow icon="tag"              label="Account Code"    value={customer.accountCode} />
                <DetailRow icon="manage_accounts"  label="Account Type"    value={customer.accountType} />
                <DetailRow icon="currency_exchange" label="Currency"       value={customer.currency} />
                <DetailRow icon="schedule"         label="Payment Term"    value={customer.paymentTerm} />
                <DetailRow icon="credit_score"     label="Credit Limit"    value={customer.creditLimit != null ? customer.creditLimit.toLocaleString() : null} />
                <DetailRow icon="account_balance"  label="Bank Name"       value={customer.bankName} />
                <DetailRow icon="credit_card"      label="IBAN"            value={customer.iban} />
                <DetailRow icon="store"            label="Branch Code"     value={customer.branchCode} />
                <DetailRow icon="person"           label="Account Holder"  value={customer.accountHolder} />
                <DetailRow icon="description"      label="Invoice Type"    value={customer.invoiceType} />
                <DetailRow icon="payments"         label="Payment Method"  value={customer.paymentMethod} />
                <DetailRow icon="schedule_send"    label="Payment Terms"   value={customer.paymentTerms} />
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-surface-container-high" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">contact_phone</span>
                    Contact Person
                  </span>
                  <div className="flex-1 h-px bg-surface-container-high" />
                </div>
                <DetailRow icon="person"           label="Contact Person Name (Finance)" value={customer.contactName} />
                <DetailRow icon="phone_in_talk"    label="Contact Person Phone (Finance)"        value={customer.contactPersonPhone} />
                <DetailRow icon="forward_to_inbox" label="Contact Person Email (Finance)"        value={customer.contactPersonEmail} />
                <DetailRow icon="person"           label="Contact Person Name (Purchasing)" value={customer.contactNamePurchasing} />
                <DetailRow icon="phone_in_talk"    label="Contact Person Phone (Purchasing)" value={customer.contactPersonPhonePurchasing} />
                <DetailRow icon="forward_to_inbox" label="Contact Person Email (Purchasing)" value={customer.contactPersonEmailPurchasing} />
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-surface-container-high" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">tune</span>
                    Other
                  </span>
                  <div className="flex-1 h-px bg-surface-container-high" />
                </div>
                <DetailRow icon="factory"      label="Industry / Sector"    value={customer.industry} />
                <DetailRow icon="grade"        label="Customer Category"    value={customer.customerCategory} />
                <DetailRow icon="badge"        label="Sales Representative" value={customer.salesRepName} />
                <DetailRow icon="edit_note"    label="Notes"                value={customer.notes} />
                <DetailRow icon="verified_user" label="GDPR / KVKK Consent" value={customer.gdprConsent ? 'Consented' : 'Not Consented'} />
              </div>
            )}

            {/* Orders tab */}
            {viewTab === 'orders' && (
              <OrdersTab customerOrders={customerOrders} />
            )}

            {/* Finance tab */}
            {viewTab === 'finance' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Summary bar + export buttons */}
                {(() => {

                  const income  = customerFinance.filter((f) => f.type === 'income').reduce((s, f) => s + (f.amount || 0), 0)
                  const expense = customerFinance.filter((f) => f.type === 'expense').reduce((s, f) => s + (f.amount || 0), 0)
                  const net = income - expense
                  const fmt2 = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

                  async function exportFinancePDF() {
                    const doc = new jsPDF({ orientation: 'landscape' })
                    await addLogoToPDF(doc)
                    doc.setFontSize(14)
                    doc.setFont('helvetica', 'bold')
                    doc.text(`Finance — ${customer.name}`, 14, 15)
                    doc.setFontSize(9)
                    doc.setFont('helvetica', 'normal')
                    doc.setTextColor(100)
                    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22)
                    doc.text(`Income: ${fmt2(income)}  |  Expense: ${fmt2(expense)}  |  Net: ${fmt2(net)}`, 14, 28)
                    doc.setTextColor(0)
                    autoTable(doc, {
                      startY: 33,
                      head: [['Code', 'Type', 'Category', 'Order', 'Date', 'Amount', 'Curr.', 'Reference']],
                      body: customerFinance.map((f) => [
                        f.code,
                        f.type === 'income' ? 'Income' : 'Expense',
                        f.category || '',
                        f.order?.code || '',
                        f.date || '',
                        (f.type === 'income' ? '+' : '-') + fmt2(f.amount || 0),
                        f.currency || '',
                        f.reference || '',
                      ]),
                      styles: { fontSize: 8, cellPadding: 2 },
                      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
                      alternateRowStyles: { fillColor: [245, 247, 250] },
                      columnStyles: { 5: { halign: 'right' } },
                    })
                    doc.save(`finance_${customer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
                  }

                  function exportFinanceExcel() {
                    const fmt2 = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    const summaryRows = [
                      [`Finance Records — ${customer.name}`],
                      [`Generated: ${new Date().toLocaleString()}`],
                      [],
                      ['Income', income, 'Expense', expense, 'Net', net],
                      [],
                    ]
                    const header = ['Code', 'Type', 'Category', 'Order', 'Date', 'Amount', 'Currency', 'Reference', 'Description']
                    const dataRows = customerFinance.map((f) => [
                      f.code,
                      f.type === 'income' ? 'Income' : 'Expense',
                      f.category || '',
                      f.order?.code || '',
                      f.date || '',
                      f.amount || 0,
                      f.currency || '',
                      f.reference || '',
                      f.description || '',
                    ])
                    const ws = XLSX.utils.aoa_to_sheet([...summaryRows, header, ...dataRows])
                    ws['!cols'] = [
                      { wch: 16 }, { wch: 10 }, { wch: 20 }, { wch: 14 },
                      { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 16 }, { wch: 28 },
                    ]
                    const wb = XLSX.utils.book_new()
                    XLSX.utils.book_append_sheet(wb, ws, 'Finance')
                    XLSX.writeFile(wb, `finance_${customer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`)
                  }

                  return (
                    <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-surface-container-low border-b border-surface-container flex-shrink-0 overflow-x-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs">
                        <div className="text-on-surface-variant whitespace-nowrap">
                          <span className="hidden sm:inline">{t('finance.records')}:</span>
                          <span className="sm:hidden">Kayıt:</span> <span className="font-bold text-on-surface">{customerFinance.length}</span>
                        </div>
                        <div className="text-on-surface-variant whitespace-nowrap">
                          <span className="hidden sm:inline">{t('finance.income')}:</span>
                          <span className="sm:hidden">Gelir:</span> <span className="font-bold text-primary">{fmt2(income)}</span>
                        </div>
                        <div className="text-on-surface-variant whitespace-nowrap">
                          <span className="hidden sm:inline">{t('finance.expense')}:</span>
                          <span className="sm:hidden">Gider:</span> <span className="font-bold text-error">{fmt2(expense)}</span>
                        </div>
                        <div className="text-on-surface-variant whitespace-nowrap">
                          <span className="hidden sm:inline">{t('dashboard.net')}:</span>
                          <span className="sm:hidden">Net:</span> <span className={`font-bold ${net >= 0 ? 'text-primary' : 'text-error'}`}>{fmt2(net)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                        <button
                          onClick={exportFinanceExcel}
                          disabled={customerFinance.length === 0}
                          className="flex items-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-lg border border-surface-container text-[10px] font-semibold text-on-surface-variant hover:bg-surface-container transition disabled:opacity-40"
                        >
                          <span className="material-symbols-outlined text-[14px]">grid_on</span>
                          <span className="hidden sm:inline">Excel</span>
                        </button>
                        <button
                          onClick={exportFinancePDF}
                          disabled={customerFinance.length === 0}
                          className="flex items-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-1 rounded-lg border border-surface-container text-[10px] font-semibold text-on-surface-variant hover:bg-surface-container transition disabled:opacity-40"
                        >
                          <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                          <span className="hidden sm:inline">PDF</span>
                        </button>
                      </div>
                    </div>
                  )
                })()}
                <div className="overflow-auto flex-1">
                  {customerFinance.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
                      <span className="material-symbols-outlined text-5xl mb-3 opacity-30">account_balance_wallet</span>
                      <p className="text-sm font-semibold">No finance records</p>
                      <p className="text-xs mt-1 opacity-70">Finance records linked to this customer's orders appear here</p>
                    </div>
                  ) : (
                    <div className="overflow-x-hidden overflow-y-auto flex-1 px-4 sm:px-0 pb-4">
                      <table className="w-full text-sm block sm:table mt-4 sm:mt-0">
                        <thead className="hidden sm:table-header-group sticky top-0 bg-surface-container-lowest border-b border-surface-container-low z-10">
                          <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            <th className="text-left px-6 py-3">{t('common.code')}</th>
                            <th className="text-left px-4 py-3">{t('common.type')}</th>
                            <th className="text-left px-4 py-3">{t('common.category')}</th>
                            <th className="text-left px-4 py-3">{t('orders.order')}</th>
                            <th className="text-left px-4 py-3">{t('common.date')}</th>
                            <th className="text-right px-6 py-3">{t('common.amount')}</th>
                          </tr>
                        </thead>
                        <tbody className="block sm:table-row-group">
                          {customerFinance.map((f) => (
                            <tr key={f.id} className="block sm:table-row border border-theme-border sm:border-0 sm:border-b sm:border-surface-container-low p-4 sm:p-0 mb-4 sm:mb-0 bg-surface-container-low/30 sm:bg-transparent rounded-xl sm:rounded-none">
                              <td className="block sm:table-cell p-0 sm:px-6 sm:py-3 mb-2 sm:mb-0">
                                <div className="flex justify-between items-center sm:block">
                                  <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('common.code')}</span>
                                  <div className="text-right sm:text-left">
                                    <p className="font-bold text-on-surface text-xs">{f.code}</p>
                                    {f.reference && <p className="text-[10px] text-on-surface-variant mt-0.5">{f.reference}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="block sm:table-cell p-0 sm:px-4 sm:py-3 mb-2 sm:mb-0">
                                <div className="flex justify-between items-center sm:block">
                                  <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('common.type')}</span>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                    f.type === 'income'
                                      ? 'bg-primary-fixed text-on-primary-fixed-variant'
                                      : 'bg-error/10 text-error'
                                  }`}>
                                    <span className="material-symbols-outlined text-[12px]">
                                      {f.type === 'income' ? 'arrow_downward' : 'arrow_upward'}
                                    </span>
                                    {f.type}
                                  </span>
                                </div>
                              </td>
                              <td className="block sm:table-cell p-0 sm:px-4 sm:py-3 mb-2 sm:mb-0">
                                <div className="flex justify-between items-center sm:block">
                                  <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('common.category')}</span>
                                  <span className="text-xs text-on-surface-variant">{f.category || '—'}</span>
                                </div>
                              </td>
                              <td className="block sm:table-cell p-0 sm:px-4 sm:py-3 mb-2 sm:mb-0">
                                <div className="flex justify-between items-center sm:block">
                                  <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('orders.order')}</span>
                                  <span className="text-xs font-mono text-on-surface-variant">{f.order?.code || '—'}</span>
                                </div>
                              </td>
                              <td className="block sm:table-cell p-0 sm:px-4 sm:py-3 mb-2 sm:mb-0">
                                <div className="flex justify-between items-center sm:block">
                                  <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('common.date')}</span>
                                  <span className="text-xs text-on-surface-variant">{f.date || '—'}</span>
                                </div>
                              </td>
                              <td className="block sm:table-cell p-0 sm:px-6 sm:py-3 mt-3 sm:mt-0 pt-3 sm:pt-0 border-t border-theme-border sm:border-0">
                                <div className="flex justify-between items-center sm:block">
                                  <span className="sm:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('common.amount')}</span>
                                  <div className="text-right">
                                    <span className={`font-bold text-sm ${f.type === 'income' ? 'text-primary' : 'text-error'}`}>
                                      {f.type === 'expense' ? '−' : '+'}{(f.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant ml-1">{f.currency}</span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Edit mode – tabbed */}
        {editing && (
          <>
            <div className="flex w-full justify-start items-center gap-1 px-2 sm:px-6 pt-4 flex-shrink-0 overflow-x-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabDefs.map((tab, i) => (
                <button
                  key={tab.id}
                  onClick={() => setEditTab(i)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-bold transition-all flex-shrink-0 whitespace-nowrap ${
                    editTab === i
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  <span className="text-center">{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="px-4 md:px-8 py-5 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto flex-1 border-t border-surface-container-low">
              {editFields.map((field) => {
                const colClass = field.col === 2 ? 'col-span-1 md:col-span-2' : 'col-span-1'
                const val = form[field.id] ?? ''
                return (
                  <div key={field.id} className={colClass}>
                    <FieldInput
                      field={field}
                      value={val}
                      onChange={set(field.id)}
                      error={errors[field.id]}
                    />
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Delete confirmation */}
        {isAdmin && confirming && (
          <div className="mx-8 mb-4 px-5 py-4 bg-error-container rounded-2xl flex items-center justify-between gap-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-error-container">warning</span>
              <div>
                <p className="text-sm font-bold text-on-error-container">{t('customers.deleteCustomer')}</p>
                <p className="text-xs text-on-error-container/70 mt-0.5">{t('common.cantUndo')}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setConfirming(false)}
                className="px-4 py-2 rounded-xl text-on-error-container text-xs font-bold hover:bg-error-container/60 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => onDelete(customer.id)}
                className="px-4 py-2 rounded-xl bg-error text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                {t('common.yesDelete')}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 lg:px-8 pb-4 lg:pb-8 pt-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 lg:gap-4 flex-shrink-0 border-t border-surface-container-low">
          {!editing ? (
            <>
              <div className="flex items-center gap-2 w-full lg:w-auto">
                <button
                  onClick={() => { setEditing(true); setViewTab('info') }}
                  className="flex-1 lg:flex-none px-4 py-2 lg:px-5 lg:py-2.5 rounded-xl border-2 border-primary text-primary text-xs lg:text-sm font-bold hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-1.5 lg:gap-2"
                >
                  <span className="material-symbols-outlined text-[14px] lg:text-base">edit</span>
                  {t('common.edit')}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setConfirming((v) => !v)}
                    className={`flex-1 lg:flex-none px-4 py-2 lg:px-5 lg:py-2.5 rounded-xl border-2 text-xs lg:text-sm font-bold transition-all flex items-center justify-center gap-1.5 lg:gap-2 ${
                      confirming
                        ? 'border-error bg-error text-white'
                        : 'border-error text-error hover:bg-error hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px] lg:text-base">delete</span>
                    {t('common.delete')}
                  </button>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full lg:w-auto px-4 py-2 lg:px-6 lg:py-2.5 rounded-xl primary-gradient text-white text-xs lg:text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
              >
                {t('common.close')}
              </button>
            </>
          ) : (
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                onClick={handleCancel}
                className="flex-1 lg:flex-none px-4 py-2 lg:px-5 lg:py-2.5 rounded-xl text-on-surface-variant text-xs lg:text-sm font-semibold hover:bg-surface-container-low transition-colors flex items-center justify-center"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 lg:flex-none px-4 py-2 lg:px-6 lg:py-2.5 rounded-xl primary-gradient text-white text-xs lg:text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center"
              >
                {t('common.saveChanges')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Customers() {
  const { t } = useTranslation()
  const { customers, addCustomer, updateCustomer, deleteCustomer, syncAndRefreshCustomers, reports, user } = useData()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  
  const { token } = useAuth()
  const isAdmin = user?.role === 'admin'



  function handleSave(form) {
    addCustomer(form)
    setShowModal(false)
    setPage(1)
  }

  const filtered = customers.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.contactName || c.contact || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q) ||
      (c.country || '').toLowerCase().includes(q)
    )
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  return (
    <div className="p-2 sm:p-4 lg:p-8 min-h-screen bg-page-bg">
      {showModal && (
        <AddCustomerModal onClose={() => setShowModal(false)} onSave={handleSave} />
      )}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          reports={reports}
          onClose={() => setSelectedCustomer(null)}
          onSave={async (id, form) => {
            const updated = await updateCustomer(id, form)
            if (updated) setSelectedCustomer(updated)
          }}
          onDelete={async (id) => {
            await deleteCustomer(id)
            setSelectedCustomer(null)
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 mb-6 lg:mb-12">
        <div className="max-w-2xl">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-on-surface mb-2">
            {t('customers.title')}
          </h1>
          <p className="text-on-surface-variant text-xs sm:text-sm lg:text-base leading-relaxed">
            {t('customers.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0 overflow-x-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full md:w-auto max-w-full pb-2 md:pb-0">
          <button onClick={syncAndRefreshCustomers} className="flex items-center justify-center gap-1.5 border border-theme-border px-2.5 py-2 lg:px-3 lg:py-2 rounded-xl text-[11px] lg:text-sm text-text-muted hover:bg-hover-bg transition whitespace-nowrap flex-shrink-0">
            <span className="material-symbols-outlined text-[14px] lg:text-base">sync</span>
            <span className="hidden lg:inline">{t('common.refresh', 'Yenile/Senkronize Et')}</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-2 lg:px-4 lg:py-2.5 rounded-xl primary-gradient text-white font-bold text-[11px] lg:text-sm flex items-center justify-center gap-1.5 shadow-xl shadow-primary/10 hover:opacity-90 transition-opacity whitespace-nowrap flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[14px] lg:text-base">person_add</span>
            {t('customers.addCustomer')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {(() => {
        const uniqueCountries = new Set(customers.map((c) => c.country).filter(Boolean)).size
        const uniqueCities    = new Set(customers.map((c) => c.city).filter(Boolean)).size
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: t('nav.customers'),            value: customers.length, icon: 'groups',        color: 'bg-surface-tint'      },
              { label: t('customers.serviceCountries'), value: uniqueCountries,  icon: 'public',        color: 'bg-primary-container' },
              { label: t('customers.serviceCities'),    value: uniqueCities,     icon: 'location_city', color: 'bg-secondary'         },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 flex flex-row sm:flex-col xl:flex-row items-center gap-4 sm:gap-3 xl:gap-4 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${color}`} />
                <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">{icon}</span>
                </div>
                <div className="text-left sm:text-center xl:text-left">
                  <p className="text-xl sm:text-2xl font-black text-on-surface leading-none">{value.toLocaleString()}</p>
                  <p className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mt-1.5 leading-tight">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Search */}
      <div className="flex items-center gap-1.5 md:gap-2 bg-surface-container-low px-3 md:px-4 py-1.5 md:py-2.5 rounded-xl mb-4 md:mb-8 w-full max-w-sm">
        <span className="material-symbols-outlined text-on-surface-variant text-[16px] md:text-lg">search</span>
        <input
          type="text"
          placeholder={t('customers.searchPlaceholder')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="bg-transparent border-none outline-none text-xs md:text-sm w-full placeholder-slate-400"
        />
      </div>

      {/* Customer Table / List */}
      <div className="xl:bg-surface-container-lowest xl:rounded-2xl xl:overflow-x-auto xl:shadow-sm">
        <table className="w-full text-left block xl:table border-collapse xl:min-w-[700px]">
          <thead className="hidden xl:table-header-group">
            <tr className="bg-surface-container-low">
              {[t('customers.colCustomer'), t('customers.colContact'), t('customers.colCity'), t('customers.colTasks'), t('customers.colDetails')].map(
                (h, i) => (
                  <th key={h} className={`px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest ${i === 4 ? 'text-right' : ''}`}>
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="block xl:table-row-group space-y-4 xl:space-y-0">
            {paginated.map((customer) => (
              <tr
                key={customer.id}
                className="group xl:hover:bg-surface-container-low transition-colors cursor-pointer xl:border-b xl:border-surface-container-low block xl:table-row bg-surface-container-lowest rounded-2xl xl:rounded-none p-4 xl:p-0 shadow-sm xl:shadow-none"
                onClick={() => setSelectedCustomer(customer)}
              >
                <td className="block xl:table-cell p-0 xl:px-6 xl:py-5 mb-4 xl:mb-0 border-b border-surface-container-low pb-4 xl:border-0 xl:pb-0">
                  <div className="flex items-center gap-4">
                    <InitialsAvatar initials={customer.initials} size="lg" />
                    <div>
                      <div className="font-bold text-on-surface text-sm xl:text-base">{customer.name}</div>
                      {customer.customerType && (
                        <div className="text-[10px] text-on-surface-variant font-medium uppercase">{customer.customerType}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="flex xl:table-cell justify-between items-center p-0 xl:px-6 xl:py-5 mb-3 xl:mb-0 mt-4 xl:mt-0">
                  <span className="xl:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('customers.colContact')}</span>
                  <div className="font-semibold text-on-surface text-xs xl:text-sm">{customer.contactName || '—'}</div>
                </td>
                <td className="flex xl:table-cell justify-between items-center p-0 xl:px-6 xl:py-5 mb-4 xl:mb-0">
                  <span className="xl:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('customers.colCity')}</span>
                  <div className="text-on-surface-variant text-xs xl:text-sm font-medium text-right">
                    {[customer.city, customer.country].filter(Boolean).join(', ') || customer.region}
                  </div>
                </td>
                <td className="block xl:table-cell p-0 xl:px-6 xl:py-5 mb-4 xl:mb-0">
                  <span className="xl:hidden text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-2">{t('customers.colTasks')}</span>
                  {(() => {
                    const ct = (reports || []).filter((r) => r.customerId === customer.id)
                    const counts = [
                      { label: t('customers.open'),    col: 'open',        cls: 'status-cancelled-badge' },
                      { label: t('customers.inProg'),  col: 'in-progress', cls: 'status-progress-badge'  },
                      { label: t('customers.review'),  col: 'review',      cls: 'status-scheduled-badge' },
                      { label: t('customers.done'),    col: 'completed',   cls: 'status-completed-badge' },
                    ]
                    return (
                      <div className="flex flex-wrap xl:flex-nowrap items-center gap-1.5 min-w-[200px]">
                        <span className="hidden xl:inline-block text-base font-black text-on-surface w-6">{ct.length}</span>
                        {counts.map(({ label, col, cls }) => {
                          const n = ct.filter((r) => r.column === col).length
                          return (
                            <span key={col} className={`flex-1 xl:flex-none flex flex-col xl:flex-row items-center justify-center px-2 py-1.5 xl:py-0.5 rounded-md font-bold gap-0.5 xl:gap-1 ${cls}`}>
                              <span className="text-xs xl:text-[10px] leading-none">{n}</span>
                              <span className="text-[9px] xl:text-[10px] uppercase xl:normal-case tracking-wider xl:tracking-normal text-center leading-none">{label}</span>
                            </span>
                          )
                        })}
                      </div>
                    )
                  })()}
                </td>
                <td className="block xl:table-cell p-0 xl:px-6 xl:py-5 text-right mt-4 xl:mt-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer) }}
                    className="w-full xl:w-auto text-primary font-bold text-xs xl:text-sm px-3 py-2 bg-primary/10 xl:bg-transparent hover:bg-primary/20 xl:hover:bg-primary/5 rounded-xl transition-colors flex justify-center items-center gap-1.5"
                  >
                    {t('customers.viewDetails')}
                    <span className="material-symbols-outlined text-[14px] xl:hidden">arrow_forward</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        totalItems={filtered.length}
        itemsPerPage={ITEMS_PER_PAGE}
        label="customers.showingOf"
      />
    </div>
  )
}

import { useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../config'
import InitialsAvatar from '../components/InitialsAvatar'

const PAGES = [
  { key: 'customers',   label: 'Customers',   icon: 'groups' },
  { key: 'products',    label: 'Products',    icon: 'inventory_2' },
  { key: 'orders',      label: 'Orders',      icon: 'shopping_cart' },
  { key: 'work-orders', label: 'Site Visits', icon: 'location_on' },
  { key: 'reports',     label: 'Tasks',       icon: 'analytics' },
  { key: 'employees',   label: 'Employees',   icon: 'badge' },
  { key: 'finance',     label: 'Finance',     icon: 'account_balance_wallet' },
  { key: 'production',  label: 'Production',  icon: 'precision_manufacturing' },
  { key: 'maintenance', label: 'Maintenance', icon: 'build' },
  { key: 'logistics',   label: 'Logistics',   icon: 'local_shipping' },
  { key: 'purchasing',  label: 'Purchasing',  icon: 'shopping_bag' },
  { key: 'attendance',  label: 'Attendance',  icon: 'schedule' },
]

const ITEMS_PER_PAGE = 10

const STATUSES    = ['Active', 'On Leave', 'Inactive', 'Terminated']
const GENDERS     = ['Male', 'Female', 'Other']
const MARITAL     = ['Single', 'Married', 'Divorced', 'Widowed']
const WORK_TYPES  = ['Full-time', 'Part-time', 'Contract', 'Intern', 'Remote']
const SALARY_TYPES = ['Monthly', 'Weekly', 'Daily', 'Hourly']
const INSURANCE_TYPES = ['SSK', 'BAĞ-KUR', 'Emekli Sandığı', 'Other']
const EDUCATION_LEVELS = ['Primary', 'High School', 'Associate', 'Bachelor', 'Master', 'PhD']
const MILITARY_STATUSES = ['Completed', 'Exempt', 'Deferred', 'Pending', 'N/A']

const emptyForm = {
  // Identity
  firstName: '', lastName: '', tckn: '', birthDate: '', birthPlace: '',
  gender: '', maritalStatus: '', motherName: '', fatherName: '',
  registryProvince: '', registryDistrict: '',
  // Contact
  phone: '', email: '', address: '', emergencyContact: '', emergencyPhone: '',
  // Job
  personnelNo: '', department: '', position: '', title: '',
  hireDate: '', exitDate: '', workType: '', workLocation: '',
  status: 'Active',
  // Salary & Finance
  salary: '', netSalary: '', salaryType: '', iban: '', bankName: '',
  premium: '', bonus: '', sideRights: '',
  // SGK & Legal
  sgkNo: '', insuranceType: '', occupationCode: '',
  disabilityStatus: '', retirementStatus: '',
  // Education
  educationLevel: '', graduationDept: '', foreignLanguage: '',
  certificates: '', militaryStatus: '',
  // Documents
  docIdCopy: false, docResidency: false, docDiploma: false,
  docHealthReport: false, docCriminalRecord: false,
  docEmploymentContract: false, docSgkDeclaration: false,
  // Operational
  shift: '', leaveRights: '', performanceNotes: '',
}

const TABS = [
  { id: 'identity',    labelKey: 'employees.tabIdentity',  icon: 'badge'                  },
  { id: 'contact',     labelKey: 'employees.tabContact',   icon: 'contact_phone'          },
  { id: 'finance',     labelKey: 'employees.tabFinance',   icon: 'account_balance_wallet' },
  { id: 'legal',       labelKey: 'employees.tabLegal',     icon: 'gavel'                  },
  { id: 'education',   labelKey: 'employees.tabEducation', icon: 'school'                 },
  { id: 'operational', labelKey: 'employees.tabDocs',      icon: 'folder_managed'         },
  { id: 'job',         labelKey: 'employees.tabJob',       icon: 'work'                   },
  { id: 'access',      labelKey: 'employees.tabAccess',    icon: 'shield_person'          },
]

// ─── Field helpers ────────────────────────────────────────────────────────────
function inp(errors, field) {
  return `w-full bg-surface-container-lowest border rounded-lg md:rounded-xl px-2.5 md:px-3 py-1.5 md:py-2 text-[11px] md:text-sm text-on-surface outline-none focus:border-primary transition ${
    errors[field] ? 'border-error' : 'border-theme-border'
  }`
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-text-muted mb-0.5 md:mb-1">{label}</label>
      {children}
      {error && <p className="text-[10px] md:text-xs text-error mt-1">{error}</p>}
    </div>
  )
}

function Divider({ label }) {
  return (
    <div className="col-span-2 flex items-center gap-2 md:gap-3 pt-1">
      <div className="flex-1 h-px bg-surface-container-high" />
      <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-text-muted">{label}</span>
      <div className="flex-1 h-px bg-surface-container-high" />
    </div>
  )
}

function DocCheckbox({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 md:gap-2.5 px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg md:rounded-xl border transition text-[11px] md:text-sm ${
        checked
          ? 'bg-primary/10 border-primary text-primary'
          : 'bg-surface-container-lowest border-theme-border text-text-muted hover:bg-hover-bg'
      }`}
    >
      <span className="material-symbols-outlined text-[14px] md:text-base">
        {checked ? 'check_circle' : 'radio_button_unchecked'}
      </span>
      {label}
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function EmployeeModal({ title, form, setForm, onClose, onSave, errors, saveError, employee, allEmployees, onPhotoFileSelected }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState('identity')
  const { roles, permissions, updateRolePermissions, uploadEmployeePhoto } = useData()
  const { token } = useAuth()
  const [isManagerLocal, setIsManagerLocal] = useState(!!employee?.isManager)
  const [managerSaving, setManagerSaving] = useState(false)
  const [confirmManager, setConfirmManager] = useState(null) // { next: bool, existingManager: obj|null }
  const [permSaving, setPermSaving] = useState({})
  const [photoPreview, setPhotoPreview] = useState(employee?.photo ? `${API_URL.replace('/api', '')}${employee.photo}` : null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const setVal = (field) => (val) => setForm(f => ({ ...f, [field]: val }))

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
    if (!employee?.id) {
      // New employee — pass file to parent to upload after creation
      onPhotoFileSelected?.(file)
      return
    }
    setPhotoUploading(true)
    setPhotoError('')
    try {
      await uploadEmployeePhoto(employee.id, file)
    } catch (err) {
      setPhotoError(err.message)
    } finally {
      setPhotoUploading(false)
    }
  }

  const dept = form.department

  function requestManagerToggle() {
    if (!employee?.id || !dept) return
    const next = !isManagerLocal
    const existingManager = next
      ? (allEmployees || []).find(e => e.isManager && e.department === dept && e.id !== employee.id)
      : null
    setConfirmManager({ next, existingManager })
  }

  async function confirmManagerToggle() {
    if (!confirmManager || !employee?.id || !dept) return
    const { next } = confirmManager
    setConfirmManager(null)
    setManagerSaving(true)
    try {
      if (next) {
        await fetch(`${API_URL}/employees/setmanager`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ employeeId: employee.id, department: dept }),
        })
      } else {
        await fetch(`${API_URL}/employees/${employee.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, isManager: false }),
        })
      }
      setIsManagerLocal(next)
    } finally {
      setManagerSaving(false)
    }
  }

  const PAGE_SUB_KEYS = { orders: ['orders-create'], purchasing: ['purchasing:create'] }

  async function togglePermission(pageKey) {
    if (!dept) return
    const current = permissions[dept] || []
    let next
    if (current.includes(pageKey)) {
      const subs = PAGE_SUB_KEYS[pageKey] || []
      next = current.filter(p => p !== pageKey && !subs.includes(p))
    } else {
      next = [...current, pageKey]
    }
    setPermSaving(s => ({ ...s, [pageKey]: true }))
    try { await updateRolePermissions(dept, next) }
    finally { setPermSaving(s => ({ ...s, [pageKey]: false })) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 md:p-0" onClick={onClose}>
      <div
        className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 md:pt-5 pb-3 md:pb-3 border-b border-theme-border shrink-0">
          <h2 className="text-sm md:text-base font-bold text-on-surface">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-error transition">
            <span className="material-symbols-outlined text-lg md:text-xl">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto shrink-0 border-b border-theme-border [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tabItem => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`flex items-center gap-1 md:gap-1.5 px-3 md:px-4 py-2 md:py-2.5 text-[11px] md:text-xs font-semibold whitespace-nowrap border-b-2 transition -mb-px ${
                tab === tabItem.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[14px] md:text-sm">{tabItem.icon}</span>
              {t(tabItem.labelKey)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 md:px-6 py-4 md:py-5">

          {/* ── Identity ── */}
          {tab === 'identity' && (
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {/* Photo upload — spans full width */}
              <div className="col-span-2 flex items-center gap-5 pb-2">
                <div className="relative shrink-0">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Employee photo" className="w-20 h-20 rounded-full object-cover border-2 border-primary" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-surface-container-high border-2 border-dashed border-theme-border flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl text-text-muted">person</span>
                    </div>
                  )}
                  {photoUploading && (
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-xl animate-spin">progress_activity</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-theme-border bg-surface-container text-sm text-on-surface hover:bg-hover-bg transition">
                    <span className="material-symbols-outlined text-base">upload</span>
                    {photoPreview ? 'Change photo' : 'Upload photo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                  <p className="text-[11px] text-text-muted mt-1">JPG, PNG, WEBP · max 5 MB</p>
                  {!employee?.id && photoPreview && (
                    <p className="text-[11px] text-amber-500 mt-1">Photo will be uploaded after saving the employee.</p>
                  )}
                  {photoError && <p className="text-xs text-error mt-1">{photoError}</p>}
                </div>
              </div>
              <Field label="First Name *" error={errors.firstName}>
                <input className={inp(errors, 'firstName')} value={form.firstName} onChange={set('firstName')} placeholder="First name" />
              </Field>
              <Field label="Last Name *" error={errors.lastName}>
                <input className={inp(errors, 'lastName')} value={form.lastName} onChange={set('lastName')} placeholder="Last name" />
              </Field>
              <Field label="TCKN (Turkish ID No.)">
                <input className={inp(errors, 'tckn')} value={form.tckn} onChange={set('tckn')} placeholder="11-digit ID number" maxLength={11} />
              </Field>
              <Field label="Date of Birth">
                <input type="date" className={inp(errors, 'birthDate')} value={form.birthDate} onChange={set('birthDate')} />
              </Field>
              <Field label="Place of Birth">
                <input className={inp(errors, 'birthPlace')} value={form.birthPlace} onChange={set('birthPlace')} placeholder="City / district" />
              </Field>
              <Field label="Gender">
                <select className={inp(errors, 'gender')} value={form.gender} onChange={set('gender')}>
                  <option value="">Select…</option>
                  {GENDERS.map(g => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Marital Status">
                <select className={inp(errors, 'maritalStatus')} value={form.maritalStatus} onChange={set('maritalStatus')}>
                  <option value="">Select…</option>
                  {MARITAL.map(m => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className={inp(errors, 'status')} value={form.status} onChange={set('status')}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Divider label="Family & Registry" />
              <Field label="Mother's Name">
                <input className={inp(errors, 'motherName')} value={form.motherName} onChange={set('motherName')} placeholder="Mother's first name" />
              </Field>
              <Field label="Father's Name">
                <input className={inp(errors, 'fatherName')} value={form.fatherName} onChange={set('fatherName')} placeholder="Father's first name" />
              </Field>
              <Field label="Registry Province (Nüfus İl)">
                <input className={inp(errors, 'registryProvince')} value={form.registryProvince} onChange={set('registryProvince')} placeholder="Province" />
              </Field>
              <Field label="Registry District (Nüfus İlçe)">
                <input className={inp(errors, 'registryDistrict')} value={form.registryDistrict} onChange={set('registryDistrict')} placeholder="District" />
              </Field>
            </div>
          )}

          {/* ── Contact & Job ── */}
          {tab === 'contact' && (
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <Divider label="Contact Information" />
              <Field label="Mobile Phone">
                <input type="tel" className={inp(errors, 'phone')} value={form.phone} onChange={set('phone')} placeholder="+90 (555) 000-0000" />
              </Field>
              <Field label="Email">
                <input type="email" className={inp(errors, 'email')} value={form.email} onChange={set('email')} placeholder="name@company.com" />
              </Field>
              <Field label="Address">
                <input className={inp(errors, 'address')} value={form.address} onChange={set('address')} placeholder="Full address" />
              </Field>
              <Field label="Emergency Contact Person">
                <input className={inp(errors, 'emergencyContact')} value={form.emergencyContact} onChange={set('emergencyContact')} placeholder="Full name" />
              </Field>
              <Field label="Emergency Contact Phone">
                <input type="tel" className={inp(errors, 'emergencyPhone')} value={form.emergencyPhone} onChange={set('emergencyPhone')} placeholder="+90 (555) 000-0000" />
              </Field>

            </div>
          )}

          {/* ── Salary & Finance ── */}
          {tab === 'finance' && (
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <Divider label="Salary" />
              <Field label="Gross Salary (Brüt Maaş)">
                <input type="number" min="0" step="0.01" className={inp(errors, 'salary')} value={form.salary} onChange={set('salary')} placeholder="0.00" />
              </Field>
              <Field label="Net Salary (Net Maaş)">
                <input type="number" min="0" step="0.01" className={inp(errors, 'netSalary')} value={form.netSalary} onChange={set('netSalary')} placeholder="0.00" />
              </Field>
              <Field label="Salary Type (Maaş Türü)">
                <select className={inp(errors, 'salaryType')} value={form.salaryType} onChange={set('salaryType')}>
                  <option value="">Select…</option>
                  {SALARY_TYPES.map(st => <option key={st}>{st}</option>)}
                </select>
              </Field>
              <Field label="Premium (Prim)">
                <input type="number" min="0" step="0.01" className={inp(errors, 'premium')} value={form.premium} onChange={set('premium')} placeholder="0.00" />
              </Field>
              <Field label="Bonus">
                <input type="number" min="0" step="0.01" className={inp(errors, 'bonus')} value={form.bonus} onChange={set('bonus')} placeholder="0.00" />
              </Field>
              <Field label="Side Benefits (Yan Haklar)">
                <input className={inp(errors, 'sideRights')} value={form.sideRights} onChange={set('sideRights')} placeholder="e.g. Health insurance, meal card…" />
              </Field>

              <Divider label="Bank Information" />
              <Field label="Bank Name (Banka Adı)">
                <input className={inp(errors, 'bankName')} value={form.bankName} onChange={set('bankName')} placeholder="e.g. Garanti BBVA" />
              </Field>
              <Field label="IBAN">
                <input className={inp(errors, 'iban')} value={form.iban} onChange={set('iban')} placeholder="TR00 0000 0000 0000 0000 0000 00" />
              </Field>
            </div>
          )}

          {/* ── SGK & Legal ── */}
          {tab === 'legal' && (
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <Divider label="SGK Information" />
              <Field label="SGK Sicil No">
                <input className={inp(errors, 'sgkNo')} value={form.sgkNo} onChange={set('sgkNo')} placeholder="SGK registration number" />
              </Field>
              <Field label="Insurance Type (Sigorta Türü)">
                <select className={inp(errors, 'insuranceType')} value={form.insuranceType} onChange={set('insuranceType')}>
                  <option value="">Select…</option>
                  {INSURANCE_TYPES.map(ins => <option key={ins}>{ins}</option>)}
                </select>
              </Field>
              <Field label="Occupation Code (Meslek Kodu)">
                <input className={inp(errors, 'occupationCode')} value={form.occupationCode} onChange={set('occupationCode')} placeholder="e.g. 2141.01" />
              </Field>
              <Field label="Disability Status (Engellilik Durumu)">
                <input className={inp(errors, 'disabilityStatus')} value={form.disabilityStatus} onChange={set('disabilityStatus')} placeholder="None / Degree 1–3" />
              </Field>
              <Field label="Retirement Status (Emeklilik Durumu)">
                <input className={inp(errors, 'retirementStatus')} value={form.retirementStatus} onChange={set('retirementStatus')} placeholder="Active / Retired / Eligible" />
              </Field>
            </div>
          )}

          {/* ── Education ── */}
          {tab === 'education' && (
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <Divider label="Education" />
              <Field label="Education Level (Eğitim Durumu)">
                <select className={inp(errors, 'educationLevel')} value={form.educationLevel} onChange={set('educationLevel')}>
                  <option value="">Select…</option>
                  {EDUCATION_LEVELS.map(l => <option key={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="Graduation Department (Mezuniyet Bölümü)">
                <input className={inp(errors, 'graduationDept')} value={form.graduationDept} onChange={set('graduationDept')} placeholder="e.g. Computer Engineering" />
              </Field>
              <Field label="Foreign Language (Yabancı Dil)">
                <input className={inp(errors, 'foreignLanguage')} value={form.foreignLanguage} onChange={set('foreignLanguage')} placeholder="e.g. English B2, German A1" />
              </Field>
              <Field label="Military Status (Askerlik Durumu)">
                <select className={inp(errors, 'militaryStatus')} value={form.militaryStatus} onChange={set('militaryStatus')}>
                  <option value="">Select…</option>
                  {MILITARY_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <div className="col-span-2">
                <Field label="Certificates & Trainings (Sertifikalar)">
                  <textarea rows={3} className={inp(errors, 'certificates')} value={form.certificates} onChange={set('certificates')} placeholder="List certificates, courses, trainings…" />
                </Field>
              </div>
            </div>
          )}

          {/* ── Docs & System ── */}
          {tab === 'operational' && (
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <Divider label="Documents Received" />
              <div className="col-span-2 grid grid-cols-2 gap-2">
                {[
                  { key: 'docIdCopy',             label: 'ID Copy (Kimlik Fotokopisi)'         },
                  { key: 'docResidency',           label: 'Residency (İkametgah)'              },
                  { key: 'docDiploma',             label: 'Diploma'                            },
                  { key: 'docHealthReport',        label: 'Health Report (Sağlık Raporu)'      },
                  { key: 'docCriminalRecord',      label: 'Criminal Record (Sabıka Kaydı)'     },
                  { key: 'docEmploymentContract',  label: 'Employment Contract (İş Sözleşmesi)'},
                  { key: 'docSgkDeclaration',      label: 'SGK Declaration (SGK Bildirgesi)'   },
                ].map(({ key, label }) => (
                  <DocCheckbox
                    key={key}
                    label={label}
                    checked={form[key]}
                    onChange={setVal(key)}
                  />
                ))}
              </div>

              <Divider label="Operational" />
              <Field label="Shift (Vardiya)">
                <input className={inp(errors, 'shift')} value={form.shift} onChange={set('shift')} placeholder="e.g. Morning / Night / Rotating" />
              </Field>
              <Field label="Leave Rights (İzin Hakları)">
                <input className={inp(errors, 'leaveRights')} value={form.leaveRights} onChange={set('leaveRights')} placeholder="e.g. 14 days / year" />
              </Field>
              <div className="col-span-2">
                <Field label="Performance Notes (Performans Notları)">
                  <textarea rows={2} className={inp(errors, 'performanceNotes')} value={form.performanceNotes} onChange={set('performanceNotes')} placeholder="Notes…" />
                </Field>
              </div>

            </div>
          )}

          {/* ── Access & Role ── */}
          {/* ── Job Info ── */}
          {tab === 'job' && (
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <Field label="Personnel No.">
                <input className={inp(errors, 'personnelNo')} value={form.personnelNo} onChange={set('personnelNo')} placeholder="e.g. P-001" />
              </Field>
              <Field label="Department">
                <select className={inp(errors, 'department')} value={form.department} onChange={set('department')}>
                  <option value="">— Select Department —</option>
                  {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Position">
                <input className={inp(errors, 'position')} value={form.position} onChange={set('position')} placeholder="e.g. Engineer" />
              </Field>
              <Field label="Title (Ünvan)">
                <input className={inp(errors, 'title')} value={form.title} onChange={set('title')} placeholder="e.g. Senior, Director" />
              </Field>
              <Field label="Hire Date">
                <input type="date" className={inp(errors, 'hireDate')} value={form.hireDate} onChange={set('hireDate')} />
              </Field>
              <Field label="Exit Date">
                <input type="date" className={inp(errors, 'exitDate')} value={form.exitDate} onChange={set('exitDate')} />
              </Field>
              <Field label="Work Type">
                <select className={inp(errors, 'workType')} value={form.workType} onChange={set('workType')}>
                  <option value="">Select…</option>
                  {WORK_TYPES.map(wt => <option key={wt}>{wt}</option>)}
                </select>
              </Field>
              <Field label="Work Location">
                <input className={inp(errors, 'workLocation')} value={form.workLocation} onChange={set('workLocation')} placeholder="Office / Remote / Branch" />
              </Field>
            </div>
          )}

          {tab === 'access' && (
            <div className="space-y-5">
              {!employee?.id ? (
                <div className="flex flex-col items-center justify-center py-6 md:py-10 text-center text-text-muted px-4">
                  <span className="material-symbols-outlined text-3xl md:text-4xl mb-1.5 md:mb-2 opacity-30">shield_person</span>
                  <p className="text-[11px] md:text-sm leading-relaxed">Save the employee first to configure access and role settings.</p>
                </div>
              ) : (
                <>
                  {/* Manager checkbox */}
                  <div className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg md:rounded-xl border-2 transition cursor-pointer ${isManagerLocal ? 'border-amber-400 bg-amber-500/5' : 'border-theme-border bg-surface-container hover:bg-hover-bg'}`}
                    onClick={!managerSaving ? requestManagerToggle : undefined}
                  >
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 ${isManagerLocal ? 'bg-amber-500/15' : 'bg-surface-container-high'}`}>
                      {managerSaving
                        ? <span className="material-symbols-outlined text-[16px] md:text-xl text-text-muted animate-spin">progress_activity</span>
                        : <span className={`material-symbols-outlined text-[16px] md:text-xl ${isManagerLocal ? 'text-amber-600' : 'text-text-muted'}`}>manage_accounts</span>
                      }
                    </div>
                    <div className="flex-1">
                      <p className={`text-xs md:text-sm font-semibold ${isManagerLocal ? 'text-amber-700' : 'text-on-surface'}`}>
                        {dept
                          ? `This employee is "${dept}" department manager`
                          : 'This employee is a department manager'}
                      </p>
                      <p className="text-[10px] md:text-xs text-text-muted mt-0.5 md:mt-1">
                        {isManagerLocal ? 'Currently set as manager of this department' : 'Click to set as manager of their department'}
                      </p>
                    </div>
                    <span className={`material-symbols-outlined text-[16px] md:text-xl ${isManagerLocal ? 'text-amber-500' : 'text-text-muted'}`}>
                      {isManagerLocal ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                  </div>

                  {/* Manager confirmation dialog */}
                  {confirmManager && (
                    <div className="rounded-lg md:rounded-xl border-2 border-amber-400 bg-amber-500/5 p-3 md:p-4 space-y-2 md:space-y-3">
                      <div className="flex items-start gap-2.5 md:gap-3">
                        <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0 md:mt-0.5">
                          <span className="material-symbols-outlined text-[16px] md:text-xl text-amber-600">warning</span>
                        </div>
                        <div>
                          <p className="text-xs md:text-sm font-semibold text-on-surface">
                            {confirmManager.next ? 'Set as department manager?' : 'Remove manager role?'}
                          </p>
                          {confirmManager.next && confirmManager.existingManager ? (
                            <p className="text-[10px] md:text-xs text-text-muted mt-1 leading-relaxed">
                              <span className="font-semibold text-amber-700">{confirmManager.existingManager.name}</span> is currently the manager of <span className="font-semibold">{dept}</span>. They will be removed as manager when you confirm.
                            </p>
                          ) : (
                            <p className="text-[10px] md:text-xs text-text-muted mt-1 leading-relaxed">
                              Are you sure you want to {confirmManager.next ? `set this employee as manager of ${dept}` : 'remove this employee\'s manager role'}?
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmManager(null)}
                          className="flex-1 py-1.5 md:py-2 rounded-lg border border-theme-border text-[11px] md:text-sm text-text-muted hover:bg-hover-bg transition"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          onClick={confirmManagerToggle}
                          className="flex-1 py-1.5 md:py-2 rounded-lg bg-amber-500 text-white text-[11px] md:text-sm font-semibold hover:opacity-90 transition"
                        >
                          {t('common.confirm')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Page access */}
                  <div>
                    <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-text-muted mb-2 md:mb-3">Page Access {dept ? `— ${dept}` : ''}</p>
                    {!dept ? (
                      <p className="text-[11px] md:text-sm text-text-muted">Assign a department first to configure page access.</p>
                    ) : (
                      <div className="space-y-1 md:space-y-1.5">
                        {PAGES.map((page) => {
                          const enabled = (permissions[dept] || []).includes(page.key)
                          const saving = !!permSaving[page.key]
                          const ordersSubEnabled = page.key === 'orders' && enabled && (permissions[dept] || []).includes('orders-create')
                          const ordersSubSaving = !!permSaving['orders-create']
                          const purchasingSubEnabled = page.key === 'purchasing' && enabled && (permissions[dept] || []).includes('purchasing:create')
                          const purchasingSubSaving = !!permSaving['purchasing:create']
                          return (
                            <div key={page.key}>
                              <button
                                onClick={() => togglePermission(page.key)}
                                disabled={saving}
                                className={`w-full flex items-center gap-2 md:gap-3 px-2.5 md:px-3 py-1.5 md:py-2.5 rounded-lg md:rounded-xl border transition text-[11px] md:text-sm ${
                                  enabled
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'bg-surface-container border-theme-border text-text-muted hover:bg-hover-bg'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px] md:text-base">{page.icon}</span>
                                <span className="flex-1 text-left font-medium">{page.label}</span>
                                {saving
                                  ? <span className="material-symbols-outlined text-[12px] md:text-sm animate-spin">progress_activity</span>
                                  : <span className="material-symbols-outlined text-[12px] md:text-sm">{enabled ? 'check_circle' : 'radio_button_unchecked'}</span>
                                }
                              </button>
                              {page.key === 'orders' && enabled && (
                                <button
                                  onClick={() => togglePermission('orders-create')}
                                  disabled={ordersSubSaving}
                                  className={`w-full flex items-center gap-2 md:gap-3 pl-6 md:pl-8 pr-2.5 md:pr-3 py-1.5 md:py-2 rounded-lg md:rounded-xl border transition text-[10px] md:text-sm mt-1 ${
                                    ordersSubEnabled
                                      ? 'bg-primary/10 border-primary text-primary'
                                      : 'bg-surface-container border-theme-border text-text-muted hover:bg-hover-bg'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[14px] md:text-base">add_circle</span>
                                  <span className="flex-1 text-left font-medium">Can create &amp; edit orders</span>
                                  {ordersSubSaving
                                    ? <span className="material-symbols-outlined text-[12px] md:text-sm animate-spin">progress_activity</span>
                                    : <span className="material-symbols-outlined text-[12px] md:text-sm">{ordersSubEnabled ? 'check_circle' : 'radio_button_unchecked'}</span>
                                  }
                                </button>
                              )}
                              {page.key === 'purchasing' && enabled && (
                                <button
                                  onClick={() => togglePermission('purchasing:create')}
                                  disabled={purchasingSubSaving}
                                  className={`w-full flex items-center gap-2 md:gap-3 pl-6 md:pl-8 pr-2.5 md:pr-3 py-1.5 md:py-2 rounded-lg md:rounded-xl border transition text-[10px] md:text-sm mt-1 ${
                                    purchasingSubEnabled
                                      ? 'bg-primary/10 border-primary text-primary'
                                      : 'bg-surface-container border-theme-border text-text-muted hover:bg-hover-bg'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[14px] md:text-base">add_circle</span>
                                  <span className="flex-1 text-left font-medium">Can create &amp; edit purchase</span>
                                  {purchasingSubSaving
                                    ? <span className="material-symbols-outlined text-[12px] md:text-sm animate-spin">progress_activity</span>
                                    : <span className="material-symbols-outlined text-[12px] md:text-sm">{purchasingSubEnabled ? 'check_circle' : 'radio_button_unchecked'}</span>
                                  }
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-t border-theme-border shrink-0">
          {saveError && <p className="text-[10px] md:text-xs text-error mb-2 md:mb-3">{saveError}</p>}
          <div className="flex gap-2 md:gap-3">
            <button onClick={onClose} className="flex-1 border border-theme-border rounded-lg md:rounded-xl py-2 md:py-2.5 text-[11px] md:text-sm text-text-muted hover:bg-hover-bg transition">
              {t('common.cancel')}
            </button>
            <button onClick={onSave} className="flex-1 bg-primary text-white rounded-lg md:rounded-xl py-2 md:py-2.5 text-[11px] md:text-sm font-semibold hover:opacity-90 transition">
              {t('employees.saveEmployee')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Status styles ─────────────────────────────────────────────────────────────
const statusStyle = {
  Active:     'bg-primary-fixed text-on-primary-fixed-variant',
  'On Leave': 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  Inactive:   'bg-surface-container-high text-text-muted',
  Terminated: 'bg-error/10 text-error',
}

function formFromEmployee(emp) {
  const parts = (emp.name || '').trim().split(/\s+/)
  const firstName = emp.firstName || (parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0]) || ''
  const lastName  = emp.lastName  || (parts.length > 1 ? parts[parts.length - 1] : '') || ''
  return {
    firstName, lastName,
    tckn: emp.tckn || '', birthDate: emp.birthDate || '',
    birthPlace: emp.birthPlace || '', gender: emp.gender || '',
    maritalStatus: emp.maritalStatus || '', motherName: emp.motherName || '',
    fatherName: emp.fatherName || '', registryProvince: emp.registryProvince || '',
    registryDistrict: emp.registryDistrict || '',
    phone: emp.phone || '', email: emp.email || '', address: emp.address || '',
    emergencyContact: emp.emergencyContact || '', emergencyPhone: emp.emergencyPhone || '',
    personnelNo: emp.personnelNo || '', department: emp.department || '',
    position: emp.position || '', title: emp.title || '',
    hireDate: emp.hireDate || '', exitDate: emp.exitDate || '',
    workType: emp.workType || '', workLocation: emp.workLocation || '',
    status: emp.status || 'Active',
    salary: emp.salary || '', netSalary: emp.netSalary || '',
    salaryType: emp.salaryType || '', iban: emp.iban || '',
    bankName: emp.bankName || '', premium: emp.premium || '',
    bonus: emp.bonus || '', sideRights: emp.sideRights || '',
    sgkNo: emp.sgkNo || '', insuranceType: emp.insuranceType || '',
    occupationCode: emp.occupationCode || '', disabilityStatus: emp.disabilityStatus || '',
    retirementStatus: emp.retirementStatus || '',
    educationLevel: emp.educationLevel || '', graduationDept: emp.graduationDept || '',
    foreignLanguage: emp.foreignLanguage || '', certificates: emp.certificates || '',
    militaryStatus: emp.militaryStatus || '',
    docIdCopy: !!emp.docIdCopy, docResidency: !!emp.docResidency,
    docDiploma: !!emp.docDiploma, docHealthReport: !!emp.docHealthReport,
    docCriminalRecord: !!emp.docCriminalRecord, docEmploymentContract: !!emp.docEmploymentContract,
    docSgkDeclaration: !!emp.docSgkDeclaration,
    shift: emp.shift || '', leaveRights: emp.leaveRights || '',
    performanceNotes: emp.performanceNotes || '',
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Employees() {
  const { t } = useTranslation()
  const { employees, addEmployee, updateEmployee, deleteEmployee, isAdmin, uploadEmployeePhoto } = useData()

  const allEmployees = useMemo(() => {
    return employees || []
  }, [employees])

  const pendingPhotoFileRef = useRef(null)
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [viewEmployee, setViewEmployee] = useState(null)
  const [form, setForm]       = useState(emptyForm)
  const [errors, setErrors]   = useState({})
  const [saveError, setSaveError] = useState('')

  function validate(f) {
    const e = {}
    if (!f.firstName.trim() && !f.lastName.trim()) e.firstName = 'At least first or last name required'
    return e
  }

  function openAdd() { setForm(emptyForm); setErrors({}); setSaveError(''); setShowAdd(true) }

  function openEdit(emp) {
    setForm(formFromEmployee(emp))
    setErrors({})
    setSaveError('')
    setEditItem(emp)
  }

  function withName(f) {
    const name = [f.firstName, f.lastName].filter(Boolean).join(' ') || f.name || 'Unnamed'
    return { ...f, name }
  }

  async function handleAdd() {
    const e = validate(form)
    if (Object.keys(e).length) { setErrors(e); return }
    try {
      setSaveError('')
      const newEmployee = await addEmployee(withName(form))
      if (pendingPhotoFileRef.current && newEmployee?.id) {
        await uploadEmployeePhoto(newEmployee.id, pendingPhotoFileRef.current).catch(() => {})
        pendingPhotoFileRef.current = null
      }
      setShowAdd(false)
    } catch (err) {
      setSaveError(err.message)
    }
  }

  async function handleEdit() {
    const e = validate(form)
    if (Object.keys(e).length) { setErrors(e); return }
    try {
      setSaveError('')
      await updateEmployee(editItem.id, withName(form))
      setEditItem(null)
    } catch (err) {
      setSaveError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm(t('employees.deleteEmployee'))) return
    await deleteEmployee(id)
  }

  const filtered = allEmployees.filter(emp =>
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    (emp.department || '').toLowerCase().includes(search.toLowerCase()) ||
    (emp.position   || '').toLowerCase().includes(search.toLowerCase()) ||
    (emp.code || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated  = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  return (
    <div className="h-full flex flex-col xl:overflow-hidden overflow-y-auto px-2.5 sm:px-4 md:px-5 pt-2.5 sm:pt-4 pb-2 md:pb-3 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-3 xl:mb-4 shrink-0">
        <div>
          <h1 className="text-xl xl:text-2xl font-bold text-on-surface">{t('employees.title')}</h1>
          <p className="text-[11px] xl:text-sm text-text-muted mt-0.5">{t('employees.totalEmployees', { count: allEmployees.length })}</p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="flex items-center gap-1.5 xl:gap-2 primary-gradient text-white px-2.5 sm:px-4 py-2 xl:py-2.5 rounded-xl text-xs xl:text-sm font-bold shadow-xl shadow-primary/10 hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-[16px] xl:text-base">add</span>
            <span>{t('employees.addEmployee')}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-2 xl:mb-3 shrink-0">
        <div className="relative flex-1 min-w-44 max-w-sm">
          <span className="material-symbols-outlined absolute left-2.5 xl:left-3 top-1/2 -translate-y-1/2 text-text-muted text-[16px] xl:text-lg">search</span>
          <input
            className="w-full bg-surface-container-lowest border border-theme-border rounded-lg xl:rounded-xl pl-8 xl:pl-9 pr-3 py-1.5 xl:py-2 text-[11px] xl:text-sm text-on-surface outline-none focus:border-primary"
            placeholder={t('employees.searchPlaceholder')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      <div className="flex-1 xl:min-h-0 bg-surface-container-lowest xl:rounded-xl xl:border border-theme-border flex flex-col overflow-visible xl:overflow-hidden">
        
        {/* Mobile Cards */}
        <div className="xl:hidden flex flex-col gap-2 flex-none py-1">
          {paginated.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
              <span className="material-symbols-outlined text-xl opacity-40">badge</span>
              <span className="text-sm font-medium">{t('employees.noEmployees')}</span>
            </div>
          ) : (
            paginated.map(emp => (
              <div key={emp.id} onClick={() => setViewEmployee(emp)} className="bg-surface-container-lowest border border-theme-border rounded-xl p-3 hover:bg-hover-bg transition-colors cursor-pointer flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <InitialsAvatar initials={emp.initials} size="sm" />
                    <div>
                      <div className="font-semibold text-on-surface text-xs">{emp.name}</div>
                      <div className="text-[10px] text-text-muted font-mono">{emp.code}</div>
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyle[emp.status] || statusStyle.Inactive}`}>
                    {emp.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-text-muted truncate max-w-[50%]">{emp.department || '—'} · {emp.position || '—'}</span>
                  {emp.isManager && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600"><span className="material-symbols-outlined text-[12px]">manage_accounts</span>Manager</span>}
                </div>
                {isAdmin && (
                  <div className="flex justify-end pt-2 mt-1 border-t border-theme-border/50" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg hover:bg-hover-bg text-text-muted hover:text-primary transition">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button onClick={() => handleDelete(emp.id)} className="p-1.5 rounded-lg hover:bg-hover-bg text-text-muted hover:text-error transition">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden xl:block overflow-auto flex-1 custom-scrollbar pb-2">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-container-lowest z-10 shadow-sm">
              <tr className="border-b border-theme-border text-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-4 font-semibold">{t('employees.title')}</th>
                <th className="text-left px-6 py-4 font-semibold">{t('employees.department')}</th>
                <th className="text-left px-6 py-4 font-semibold">{t('employees.position')}</th>
                <th className="text-left px-6 py-4 font-semibold">Contact</th>
                <th className="text-left px-6 py-4 font-semibold">Supervisor</th>
                <th className="text-left px-6 py-4 font-semibold">{t('common.status')}</th>
                {isAdmin && <th className="text-right px-6 py-4 font-semibold">{t('common.actions')}</th>}
              </tr>
            </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="text-center py-16 text-text-muted">
                  <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">badge</span>
                  {t('employees.noEmployees')}
                </td>
              </tr>
            ) : (
              paginated.map(emp => (
                <tr key={emp.id} onClick={() => setViewEmployee(emp)} className="border-b border-theme-border last:border-0 hover:bg-hover-bg transition-colors cursor-pointer group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar initials={emp.initials} size="sm" />
                      <div>
                        <div className="font-semibold text-on-surface">{emp.name}</div>
                        <div className="text-xs text-text-muted font-mono">{emp.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-text-muted">{emp.department || '—'}</td>
                  <td className="px-6 py-4 text-text-muted">
                    <div>{emp.position || '—'}</div>
                    {emp.title && <div className="text-xs text-text-muted">{emp.title}</div>}
                  </td>
                  <td className="px-6 py-4 text-text-muted">
                    <div>{emp.phone || '—'}</div>
                    <div className="text-xs">{emp.email || ''}</div>
                  </td>
                  <td className="px-6 py-4">
                    {emp.isManager
                      ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600"><span className="material-symbols-outlined text-sm">manage_accounts</span>Manager</span>
                      : <span className="text-text-muted">{allEmployees.find(m => m.isManager && m.department === emp.department && m.id !== emp.id)?.name || '—'}</span>
                    }
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyle[emp.status] || statusStyle.Inactive}`}>
                      {emp.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg hover:bg-hover-bg text-text-muted hover:text-primary transition">
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button onClick={() => handleDelete(emp.id)} className="p-1.5 rounded-lg hover:bg-hover-bg text-text-muted hover:text-error transition">
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 md:mt-3 text-[11px] md:text-sm text-text-muted shrink-0">
          <span>{filtered.length} employees</span>
          <div className="flex gap-1 md:gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-theme-border disabled:opacity-40 hover:bg-hover-bg transition">{t('common.prev')}</button>
            <span className="px-2 md:px-3 py-1 md:py-1.5">{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-theme-border disabled:opacity-40 hover:bg-hover-bg transition">{t('common.next')}</button>
          </div>
        </div>
      )}

      {/* Employee Detail Modal */}
      {viewEmployee && (() => {
        const e = viewEmployee
        function Section({ label }) {
          return (
            <div className="col-span-2 flex items-center gap-2 md:gap-3 pt-1.5 md:pt-2">
              <div className="flex-1 h-px bg-surface-container-high" />
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-text-muted">{label}</span>
              <div className="flex-1 h-px bg-surface-container-high" />
            </div>
          )
        }
        function Row({ label, value, full }) {
          if (!value && value !== 0) return null
          return (
            <div className={full ? 'col-span-2' : ''}>
              <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-text-muted mb-0.5">{label}</p>
              <p className="text-xs md:text-sm text-on-surface">{value}</p>
            </div>
          )
        }
        function DocBadge({ label, checked }) {
          return (
            <span className={`inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md md:rounded-lg text-[10px] md:text-xs font-medium border ${checked ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container border-theme-border text-text-muted line-through'}`}>
              <span className="material-symbols-outlined text-[14px] md:text-sm">{checked ? 'check_circle' : 'cancel'}</span>
              {label}
            </span>
          )
        }
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 md:p-0" onClick={() => setViewEmployee(null)}>
            <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e2 => e2.stopPropagation()}>
              {/* Banner */}
              <div className="primary-gradient px-4 md:px-6 pt-4 md:pt-6 pb-5 md:pb-7 shrink-0 rounded-t-2xl">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <span className="text-[10px] md:text-xs font-bold text-white/60 uppercase tracking-widest">Employee Profile</span>
                  <div className="flex items-center gap-1 md:gap-2">
                    {isAdmin && (
                      <button
                        onClick={() => { setViewEmployee(null); openEdit(viewEmployee) }}
                        className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg bg-white/20 hover:bg-white/30 text-white text-[10px] md:text-xs font-semibold transition"
                      >
                        <span className="material-symbols-outlined text-[14px] md:text-sm">edit</span>{t('common.edit')}
                      </button>
                    )}
                    <button onClick={() => setViewEmployee(null)} className="p-1 md:p-1.5 rounded-lg md:rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px] md:text-lg">close</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl overflow-hidden shrink-0 bg-white/20 flex items-center justify-center">
                    {e.photo
                      ? <img src={`${API_URL.replace('/api', '')}${e.photo}`} alt={e.name} className="w-full h-full object-cover" />
                      : <span className="text-white text-base md:text-xl font-black">{e.initials}</span>
                    }
                  </div>
                  <div>
                    <h2 className="text-base md:text-xl font-extrabold text-white leading-tight">{e.name}</h2>
                    <p className="text-white/70 text-[10px] md:text-sm mt-0.5">{e.position || '—'}{e.title ? ` · ${e.title}` : ''}</p>
                    <div className="flex items-center gap-1.5 md:gap-2 mt-1.5 md:mt-2 flex-wrap">
                      <span className={`inline-flex px-2 md:px-2.5 py-0.5 rounded-md md:rounded-full text-[9px] md:text-xs font-semibold ${statusStyle[e.status] || statusStyle.Inactive}`}>{e.status}</span>
                      {e.isManager && <span className="inline-flex px-2 md:px-2.5 py-0.5 rounded-md md:rounded-full text-[9px] md:text-xs font-bold bg-amber-500/20 text-amber-200">Manager</span>}
                      {e.department && <span className="inline-flex px-2 md:px-2.5 py-0.5 rounded-md md:rounded-full text-[9px] md:text-xs font-bold bg-white/20 text-white">{e.department}</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5 custom-scrollbar">
                <div className="grid grid-cols-2 gap-x-4 md:gap-x-6 gap-y-3 md:gap-y-4">

                  <Section label="Identity" />
                  <Row label="Personnel No." value={e.personnelNo} />
                  <Row label="TCKN" value={e.tckn} />
                  <Row label="Date of Birth" value={e.birthDate} />
                  <Row label="Place of Birth" value={e.birthPlace} />
                  <Row label="Gender" value={e.gender} />
                  <Row label="Marital Status" value={e.maritalStatus} />
                  <Row label="Mother's Name" value={e.motherName} />
                  <Row label="Father's Name" value={e.fatherName} />
                  <Row label="Registry Province" value={e.registryProvince} />
                  <Row label="Registry District" value={e.registryDistrict} />

                  <Section label="Contact" />
                  <Row label="Phone" value={e.phone} />
                  <Row label="Email" value={e.email} />
                  <Row label="Address" value={e.address} full />
                  <Row label="Emergency Contact" value={e.emergencyContact} />
                  <Row label="Emergency Phone" value={e.emergencyPhone} />

                  <Section label="Job" />
                  <Row label="Hire Date" value={e.hireDate} />
                  <Row label="Exit Date" value={e.exitDate} />
                  <Row label="Work Type" value={e.workType} />
                  <Row label="Work Location" value={e.workLocation} />

                  <Section label="Salary & Finance" />
                  <Row label="Gross Salary" value={e.salary ? `$${parseFloat(e.salary).toLocaleString()}` : null} />
                  <Row label="Net Salary" value={e.netSalary ? `$${parseFloat(e.netSalary).toLocaleString()}` : null} />
                  <Row label="Salary Type" value={e.salaryType} />
                  <Row label="Premium" value={e.premium ? `$${parseFloat(e.premium).toLocaleString()}` : null} />
                  <Row label="Bonus" value={e.bonus ? `$${parseFloat(e.bonus).toLocaleString()}` : null} />
                  <Row label="Side Benefits" value={e.sideRights} full />
                  <Row label="Bank Name" value={e.bankName} />
                  <Row label="IBAN" value={e.iban} />

                  <Section label="SGK & Legal" />
                  <Row label="SGK Sicil No" value={e.sgkNo} />
                  <Row label="Insurance Type" value={e.insuranceType} />
                  <Row label="Occupation Code" value={e.occupationCode} />
                  <Row label="Disability Status" value={e.disabilityStatus} />
                  <Row label="Retirement Status" value={e.retirementStatus} />

                  <Section label="Education" />
                  <Row label="Education Level" value={e.educationLevel} />
                  <Row label="Graduation Dept." value={e.graduationDept} />
                  <Row label="Foreign Language" value={e.foreignLanguage} />
                  <Row label="Military Status" value={e.militaryStatus} />
                  <Row label="Certificates" value={e.certificates} full />

                  <Section label="Operational" />
                  <Row label="Shift" value={e.shift} />
                  <Row label="Leave Rights" value={e.leaveRights} />
                  <Row label="Performance Notes" value={e.performanceNotes} full />

                  <Section label="Documents" />
                  <div className="col-span-2 flex flex-wrap gap-2">
                    <DocBadge label="ID Copy" checked={e.docIdCopy} />
                    <DocBadge label="Residency" checked={e.docResidency} />
                    <DocBadge label="Diploma" checked={e.docDiploma} />
                    <DocBadge label="Health Report" checked={e.docHealthReport} />
                    <DocBadge label="Criminal Record" checked={e.docCriminalRecord} />
                    <DocBadge label="Employment Contract" checked={e.docEmploymentContract} />
                    <DocBadge label="SGK Declaration" checked={e.docSgkDeclaration} />
                  </div>

                </div>
              </div>

              {/* Footer */}
              <div className="px-4 md:px-6 py-3 md:py-4 border-t border-theme-border shrink-0">
                <button onClick={() => setViewEmployee(null)} className="w-full py-2 md:py-2.5 rounded-lg md:rounded-xl primary-gradient text-white text-[11px] md:text-sm font-bold hover:opacity-90 transition">
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {showAdd && (
        <EmployeeModal title={t('employees.addEmployee')} form={form} setForm={setForm} errors={errors} saveError={saveError}
          onClose={() => { setShowAdd(false); pendingPhotoFileRef.current = null }} onSave={handleAdd}
          employee={null} allEmployees={employees}
          onPhotoFileSelected={(file) => { pendingPhotoFileRef.current = file }} />
      )}
      {editItem && (
        <EmployeeModal title={t('employees.editEmployee')} form={form} setForm={setForm} errors={errors} saveError={saveError}
          onClose={() => setEditItem(null)} onSave={handleEdit} employee={editItem} allEmployees={employees} />
      )}
    </div>
  )
}

import React, { useState, useEffect, useCallback } from 'react';
import apiService from '../../services/api';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const formatGHS = (pesewas) => {
  const amount = Number(pesewas || 0) / 100;
  return `GHS ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const GHS_CATEGORIES = [
  'TUITION','ADMISSION','REGISTRATION','PTA_LEVY','ICT','EXAMINATION',
  'BECE_REGISTRATION','WASSCE_REGISTRATION','TRANSPORT','FEEDING','BOARDING',
  'LIBRARY','UNIFORM','FRIDAY_WEAR','BOOKS_STATIONERY','GRADUATION',
  'VACATION_CLASSES','EXTRA_CLASSES','SPORTS_LEVY','SPORTS','MUSIC_ARTS',
  'MEDICAL','EXCURSION','AFTERCARE','DEVELOPMENT_LEVY','CAUTION_DEPOSIT',
  'MISCELLANEOUS','CUSTOM','EXTRACURRICULAR','OTHER',
];

// Generate a component code from the name, e.g. "Tuition Fees" -> "TUITION_FEES"
const generateComponentCode = (name) => {
  const cleaned = String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'FEE_COMPONENT';
};

const BILLING_CYCLES = ['PER_TERM', 'PER_YEAR', 'ONE_TIME', 'DAILY', 'MONTHLY'];

const TABS = [
  { id: 'components', label: '🏷️ Fee Components' },
  { id: 'schedules', label: '📅 Class Schedules' },
];

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13,
};
const labelStyle = {
  color: '#94a3b8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5, letterSpacing: '0.4px',
};
const btnPrimary = {
  padding: '9px 18px', background: 'linear-gradient(135deg,#6366f1,#818cf8)',
  color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
const btnGhost = {
  padding: '9px 16px', background: 'rgba(255,255,255,0.06)',
  color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
};

// ─── Fee Components Tab ────────────────────────────────────────────────────────
const emptyComponent = { name: '', code: '', category: 'TUITION', description: '', applicableClasses: [], billingCycle: 'PER_TERM', isOptional: false, isRefundable: false, isBoardingOnly: false, isDayStudentOnly: false };

const ComponentsTab = () => {
  const [components, setComponents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyComponent);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, classesRes] = await Promise.all([
        apiService.get('/api/admin/fees/components'),
        apiService.get('/api/school-setup/classes').catch(() => []),
      ]);
      setComponents(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
      const rawClasses = Array.isArray(classesRes) ? classesRes : (classesRes?.classes || []);
      setClasses(rawClasses);
    } catch (_) { setComponents([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(emptyComponent); setError(''); setShowForm(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, code: c.code, category: c.category, description: c.description || '', applicableClasses: c.applicableClasses || [], billingCycle: c.billingCycle, isOptional: !!c.isOptional, isRefundable: !!c.isRefundable, isBoardingOnly: !!c.isBoardingOnly, isDayStudentOnly: !!c.isDayStudentOnly });
    setError(''); setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.category || !form.billingCycle) { setError('Name, category, and billing cycle are required'); return; }
    const payload = { ...form, code: (form.code || '').trim() || generateComponentCode(form.name) };
    setSubmitting(true); setError('');
    try {
      if (editing) {
        await apiService.patch(`/api/admin/fees/components/${editing._id}`, payload);
      } else {
        await apiService.post('/api/admin/fees/components', payload);
      }
      setShowForm(false); load();
    } catch (err) {
      const msg = err?.message || err?.data?.message || (err?.data?.errors ? err.data.errors.map(e => e.msg).join(', ') : '') || 'Save failed';
      setError(msg);
    }
    setSubmitting(false);
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this fee component?')) return;
    try { await apiService.delete(`/api/admin/fees/components/${id}`); load(); } catch (err) { alert(err?.message || 'Failed'); }
  };

  const toggleClass = (cls) => {
    setForm(prev => ({
      ...prev,
      applicableClasses: prev.applicableClasses.includes(cls)
        ? prev.applicableClasses.filter(c => c !== cls)
        : [...prev.applicableClasses, cls],
    }));
  };

  const filtered = filterCategory ? components.filter(c => c.category === filterCategory) : components;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="">All Categories</option>
          {GHS_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 13 }}>{filtered.length} component(s)</span>
        <button onClick={openNew} style={btnPrimary}>+ New Component</button>
      </div>

      {/* Form Drawer */}
      {showForm && (
        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <h3 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15, marginBottom: 20 }}>
            {editing ? '✏️ Edit Fee Component' : '➕ New Fee Component'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>COMPONENT NAME*</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Tuition Fees" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>CODE (auto-generated if blank)</label>
              <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g., TUITION" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>CATEGORY*</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                {GHS_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>BILLING CYCLE*</label>
              <select value={form.billingCycle} onChange={e => setForm(p => ({ ...p, billingCycle: e.target.value }))} style={inputStyle}>
                {BILLING_CYCLES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>DESCRIPTION</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
              style={{ ...inputStyle, resize: 'vertical' }} placeholder="Optional description…" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ ...labelStyle, marginBottom: 8 }}>APPLICABLE CLASSES (leave empty = all classes)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {classes.map(c => (
                <button key={c._id} onClick={() => toggleClass(c.level)} type="button"
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid', cursor: 'pointer',
                    background: form.applicableClasses.includes(c.level) ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                    borderColor: form.applicableClasses.includes(c.level) ? '#6366f1' : 'rgba(255,255,255,0.1)',
                    color: form.applicableClasses.includes(c.level) ? '#818cf8' : '#64748b',
                  }}>{c.name} ({c.level})</button>
              ))}
              {classes.length === 0 && <span style={{ color: '#475569', fontSize: 12 }}>No classes created yet</span>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, marginBottom: 18 }}>
            {[
              { key: 'isOptional', label: 'Optional fee' },
              { key: 'isRefundable', label: 'Refundable' },
              { key: 'isBoardingOnly', label: 'Boarding only' },
              { key: 'isDayStudentOnly', label: 'Day students only' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>
                <input type="checkbox" checked={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))}
                  style={{ width: 15, height: 15, accentColor: '#6366f1' }} />
                {label}
              </label>
            ))}
          </div>

          {error && <div style={{ background: 'rgba(239,68,68,0.12)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSubmit} disabled={submitting} style={btnPrimary}>
              {submitting ? 'Saving…' : (editing ? 'Save Changes' : 'Create Component')}
            </button>
            <button onClick={() => setShowForm(false)} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? <div style={{ textAlign: 'center', padding: 50, color: '#64748b' }}>Loading components…</div> : (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                {['Name', 'Code', 'Category', 'Cycle', 'Classes', 'Flags', 'Active', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#475569' }}>No fee components yet. Click "New Component" to create one.</td></tr>
              )}
              {filtered.map((c, i) => (
                <tr key={c._id || i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 14px', color: '#e2e8f0', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '10px 14px', color: '#818cf8', fontFamily: 'monospace', fontSize: 12 }}>{c.code}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontWeight: 600 }}>
                      {c.category?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>{c.billingCycle?.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>
                    {c.applicableClasses?.length === 0 ? 'All' : c.applicableClasses?.slice(0, 3).join(', ') + (c.applicableClasses?.length > 3 ? '…' : '')}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }}>
                    {c.isOptional && <span style={{ color: '#f59e0b' }}>OPT </span>}
                    {c.isRefundable && <span style={{ color: '#34d399' }}>REF </span>}
                    {c.isBoardingOnly && <span style={{ color: '#818cf8' }}>BRD </span>}
                    {c.isDayStudentOnly && <span style={{ color: '#38bdf8' }}>DAY </span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.isActive !== false ? '#34d399' : '#f87171' }}>
                      {c.isActive !== false ? '● ACTIVE' : '● OFF'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => openEdit(c)} style={{ color: '#818cf8', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', marginRight: 10, fontWeight: 600 }}>Edit</button>
                    {c.isActive !== false && (
                      <button onClick={() => handleDeactivate(c._id)} style={{ color: '#f87171', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Deactivate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Class Schedules Tab ───────────────────────────────────────────────────────
const emptySchedule = { academicYear: '', term: 1, classCode: '', studentType: 'ALL', fees: [] };

const SchedulesTab = () => {
  const [schedules, setSchedules] = useState([]);
  const [components, setComponents] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptySchedule);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(null);

  // Load fee components separately — must succeed even if other data fails
  const loadComponents = useCallback(async () => {
    try {
      const res = await apiService.get('/api/admin/fees/components');
      const compList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setComponents(compList.filter(c => c.isActive !== false));
    } catch (err) {
      console.warn('Fee components load failed:', err);
      setComponents([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [schedulesRes, yearsRes, termsRes, classesRes] = await Promise.all([
        apiService.get('/api/admin/fees/schedules').catch(e => { console.warn('schedules load failed:', e); return []; }),
        apiService.get('/api/academic-years').catch(() => []),
        apiService.get('/api/terms').catch(() => []),
        apiService.get('/api/school-setup/classes').catch(() => []),
      ]);
      setSchedules(Array.isArray(schedulesRes) ? schedulesRes : []);
      const yearsList = Array.isArray(yearsRes) ? yearsRes : [];
      setAcademicYears(yearsList);
      setTerms(Array.isArray(termsRes) ? termsRes : []);
      const rawClasses = Array.isArray(classesRes) ? classesRes : (classesRes?.classes || []);
      setClasses(rawClasses);

      // Auto-select active academic year
      if (!form.academicYear) {
        const active = yearsList.find(y => y.isActive) || yearsList[0];
        if (active) setForm(p => ({ ...p, academicYear: active.name }));
      }
    } catch (e) {
      console.warn('Fee schedule load error:', e);
      setError('Failed to load data. Check console for details.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadComponents(); load(); }, [loadComponents, load]);

  const addFeeRow = () => {
    setForm(prev => ({
      ...prev,
      fees: [...prev.fees, { feeComponentId: '', amountPesewas: '', dueDate: '', notes: '' }],
    }));
  };

  const updateFeeRow = (i, field, val) => {
    setForm(prev => {
      const fees = [...prev.fees];
      fees[i] = { ...fees[i], [field]: val };
      return { ...prev, fees };
    });
  };

  const removeFeeRow = (i) => {
    setForm(prev => ({ ...prev, fees: prev.fees.filter((_, idx) => idx !== i) }));
  };

  const handleSubmit = async () => {
    if (!form.academicYear) { setError('Please select an academic year'); return; }
    if (!form.term) { setError('Please select a term'); return; }
    if (!form.classCode) { setError('Please select a class'); return; }
    if (form.fees.length === 0) { setError('At least one fee line item is required'); return; }
    for (const fee of form.fees) {
      if (!fee.feeComponentId || !fee.amountPesewas || !fee.dueDate) { setError('Each fee row must have a component, amount, and due date'); return; }
    }
    setSubmitting(true); setError('');
    try {
      await apiService.post('/api/admin/fees/schedules', form);
      setShowForm(false); setForm(emptySchedule); load();
    } catch (err) { setError(err?.message || 'Save failed'); }
    setSubmitting(false);
  };

  const handlePublish = async (id) => {
    if (!window.confirm('Publish this schedule? This will generate bills for all active students in the class.')) return;
    setPublishing(id);
    try {
      await apiService.post(`/api/admin/fees/schedules/${id}/publish`, {});
      load();
    } catch (err) { alert(err?.message || 'Publish failed'); }
    setPublishing(null);
  };

  const totalPesewas = form.fees.reduce((s, f) => s + (parseInt(f.amountPesewas) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <span style={{ color: '#64748b', fontSize: 13 }}>{schedules.length} schedule(s)</span>
        <button onClick={() => { setShowForm(true); setForm(emptySchedule); setError(''); }} style={{ ...btnPrimary, marginLeft: 'auto' }}>+ New Schedule</button>
      </div>

      {/* Schedule Creation Form */}
      {showForm && (
        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <h3 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15, marginBottom: 20 }}>📅 New Class Fee Schedule</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>ACADEMIC YEAR*</label>
              <select value={form.academicYear} onChange={e => setForm(p => ({ ...p, academicYear: e.target.value }))} style={inputStyle}>
                <option value="">Select year...</option>
                {academicYears.map(y => (
                  <option key={y._id} value={y.name}>{y.name}{y.isActive ? ' (Active)' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>TERM*</label>
              <select value={form.term} onChange={e => setForm(p => ({ ...p, term: parseInt(e.target.value) }))} style={inputStyle}>
                <option value="">Select term...</option>
                {terms.map(t => (
                  <option key={t._id} value={t.order || t.termNumber || 1}>{t.name || `Term ${t.order}`}{t.isActive ? ' (Active)' : ''}</option>
                ))}
                {terms.length === 0 && <>
                  <option value={1}>Term 1</option>
                  <option value={2}>Term 2</option>
                  <option value={3}>Term 3</option>
                </>}
              </select>
            </div>
            <div>
              <label style={labelStyle}>CLASS*</label>
              <select value={form.classCode} onChange={e => setForm(p => ({ ...p, classCode: e.target.value }))} style={inputStyle}>
                <option value="">Select class...</option>
                {classes.map(c => (
                  <option key={c._id} value={c.level}>{c.name} ({c.level})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>STUDENT TYPE</label>
              <select value={form.studentType} onChange={e => setForm(p => ({ ...p, studentType: e.target.value }))} style={inputStyle}>
                <option value="ALL">All Students</option>
                <option value="DAY">Day Students</option>
                <option value="BOARDING">Boarding Students</option>
              </select>
            </div>
          </div>

          {/* Fee Line Items */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>FEE LINE ITEMS*</label>
              <button onClick={addFeeRow} style={{ ...btnGhost, padding: '5px 12px', fontSize: 12 }}>+ Add Fee</button>
            </div>

            {form.fees.length === 0 && (
              <p style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Click "+ Add Fee" to add fee line items</p>
            )}

            {form.fees.map((fee, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                <select value={fee.feeComponentId} onChange={e => updateFeeRow(i, 'feeComponentId', e.target.value)} style={inputStyle}>
                  <option value="">Select component…</option>
                  {components.length === 0 && <option value="" disabled>No fee components found — create them in the Fee Components tab first</option>}
                  {components.map(c => <option key={c._id} value={c._id}>{c.name} ({c.category})</option>)}
                </select>
                <input value={fee.amountPesewas} onChange={e => updateFeeRow(i, 'amountPesewas', e.target.value)}
                  placeholder="Amount (pesewas)" style={inputStyle} type="number" min="0" />
                <input type="date" value={fee.dueDate} onChange={e => updateFeeRow(i, 'dueDate', e.target.value)} style={inputStyle} />
                <input value={fee.notes} onChange={e => updateFeeRow(i, 'notes', e.target.value)} placeholder="Notes" style={inputStyle} />
                <button onClick={() => removeFeeRow(i)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
              </div>
            ))}

            {form.fees.length > 0 && (
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Schedule Total: </span>
                <span style={{ color: '#34d399', fontWeight: 700, fontSize: 15 }}>{formatGHS(totalPesewas)}</span>
              </div>
            )}
          </div>

          {error && <div style={{ background: 'rgba(239,68,68,0.12)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 14 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSubmit} disabled={submitting} style={btnPrimary}>{submitting ? 'Creating…' : 'Create Schedule (Draft)'}</button>
            <button onClick={() => { setShowForm(false); setForm(emptySchedule); }} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Schedules Table */}
      {loading ? <div style={{ textAlign: 'center', padding: 50, color: '#64748b' }}>Loading schedules…</div> : (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                {['Ref', 'Year', 'Term', 'Class', 'Type', 'Total Fees', 'Fee Items', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#475569' }}>No schedules yet. Create one to start billing students.</td></tr>
              )}
              {schedules.map((s, i) => (
                <tr key={s._id || i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 14px', color: '#818cf8', fontFamily: 'monospace', fontSize: 11 }}>{s.scheduleRef || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>{s.academicYear}</td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8' }}>Term {s.term}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{s.classCode}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{s.studentType}</td>
                  <td style={{ padding: '10px 14px', color: '#34d399', fontWeight: 700 }}>{formatGHS(s.totalScheduledPesewas)}</td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>{s.fees?.length || 0} item(s)</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700,
                      color: s.status === 'PUBLISHED' ? '#34d399' : s.status === 'ARCHIVED' ? '#64748b' : '#f59e0b' }}>
                      ● {s.status}
                    </span>
                    {s.publishedAt && <span style={{ display: 'block', fontSize: 10, color: '#475569' }}>{new Date(s.publishedAt).toLocaleDateString('en-GH')}</span>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {s.status === 'DRAFT' && (
                      <button onClick={() => handlePublish(s._id)} disabled={publishing === s._id}
                        style={{ color: '#34d399', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                        {publishing === s._id ? 'Publishing…' : '▶ Publish'}
                      </button>
                    )}
                    {s.status === 'PUBLISHED' && (
                      <span style={{ color: '#475569', fontSize: 12 }}>Published ✓</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────
const FeeManagementAdmin = () => {
  const [activeTab, setActiveTab] = useState('components');

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0f172a 0%,#1a1a2e 50%,#0f172a 100%)', padding: '24px 20px', fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💳</div>
          <div>
            <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>Fee Management</h1>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Configure fee types and class billing schedules</p>
          </div>
        </div>

        {/* Info Banner */}
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16 }}>ℹ️</span>
          <div style={{ fontSize: 13, color: '#fbbf24' }}>
            <strong>Workflow:</strong> Create Fee Components → Build a Class Schedule → Publish to auto-generate student bills.
            Bills are created for all <strong>Active</strong> students in the class when a schedule is published.
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, border: '1px solid rgba(255,255,255,0.07)', width: 'fit-content' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: '9px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                background: activeTab === tab.id ? 'linear-gradient(135deg,#f59e0b,#fbbf24)' : 'transparent',
                color: activeTab === tab.id ? '#1a1a2e' : '#64748b',
                transition: 'all 0.15s',
              }}>{tab.label}</button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'components' ? <ComponentsTab /> : <SchedulesTab />}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        select option { background: #1e293b; color: #e2e8f0; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); }
      `}</style>
    </div>
  );
};

export default FeeManagementAdmin;

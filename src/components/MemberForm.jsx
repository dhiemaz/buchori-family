import { useState, useEffect, useRef } from 'react'
import { useFamily } from '../context/FamilyContext'

// Resize + compress an image file to a JPEG base64 string (max 280px side)
function compressImage(file, maxPx = 280) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(1, maxPx / Math.max(img.width, img.height))
        const w = Math.round(img.width * ratio)
        const h = Math.round(img.height * ratio)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

const EMPTY_FORM = {
  fullName: '',
  birthdate: '',
  gender: 'male',
  isAlive: true,
  passedDate: '',
  phone: '',
  whatsapp: '',
  photo: '',
  maritalStatus: '',
}

export default function MemberForm() {
  const { modal, closeModal, saveMember, members } = useFamily()
  const { open, mode, relation, relatedToId, editingMember } = modal

  const [form, setForm] = useState(EMPTY_FORM)
  const [photoPreview, setPhotoPreview] = useState('')
  const [waSameAsPhone, setWaSameAsPhone] = useState(false)
  const [formRelation, setFormRelation] = useState('')
  const [formRelatedToId, setFormRelatedToId] = useState('')
  const [errors, setErrors] = useState({})

  const fileRef = useRef(null)

  useEffect(() => {
    if (open) {
      setErrors({})
      setWaSameAsPhone(false)
      if (mode === 'edit' && editingMember) {
        setForm({
          id: editingMember.id,
          fullName: editingMember.fullName || '',
          birthdate: editingMember.birthdate || '',
          gender: editingMember.gender || 'male',
          isAlive: editingMember.isAlive !== false,
          passedDate: editingMember.passedDate || '',
          phone: editingMember.phone || '',
          whatsapp: editingMember.whatsapp || '',
          photo: editingMember.photo || '',
          maritalStatus: editingMember.maritalStatus || '',
        })
        setPhotoPreview(editingMember.photo || '')
        if (editingMember.whatsapp && editingMember.whatsapp === editingMember.phone) {
          setWaSameAsPhone(true)
        }
      } else {
        setForm(EMPTY_FORM)
        setPhotoPreview('')
        setFormRelation(relation !== 'root' ? relation : '')
        setFormRelatedToId(relatedToId || '')
      }
    }
  }, [open, mode, editingMember, relation, relatedToId])

  if (!open) return null

  const hasMembers = members.length > 0
  const showRelationSelector = mode === 'add' && hasMembers

  const eligibleMembers = members.filter(m => {
    if (formRelation === 'spouse') {
      const alreadyHasSpouse = members.some(s => s.spouseOfId === m.id || m.spouseOfId === s.id)
      return !alreadyHasSpouse
    }
    return true
  })

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file, 280)
    setPhotoPreview(compressed)
    setForm(prev => ({ ...prev, photo: compressed }))
  }

  function removePhoto() {
    setPhotoPreview('')
    setForm(prev => ({ ...prev, photo: '' }))
    if (fileRef.current) fileRef.current.value = ''
  }

  function validate() {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.birthdate) e.birthdate = 'Birthdate is required'
    if (!form.isAlive && !form.passedDate) e.passedDate = 'Please enter date/time of passing'
    if (showRelationSelector) {
      if (!formRelation) e.relation = 'Please select a relation (Spouse or Kid)'
      if (!formRelatedToId) e.relatedToId = 'Please select a family member'
    }
    return e
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    saveMember({
      ...form,
      whatsapp: waSameAsPhone ? form.phone : form.whatsapp,
      relation: showRelationSelector ? formRelation : (relation || 'root'),
      relatedToId: showRelationSelector ? formRelatedToId : (relatedToId || null),
    })
  }

  function getTitle() {
    if (mode === 'edit') return `Editing — ${editingMember?.fullName}`
    if (!hasMembers) return '🌱 Plant Your Family\'s First Seed'
    return '🎉 Welcome to the Family!'
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{getTitle()}</h2>
          <button className="modal-close" onClick={closeModal}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="member-form" noValidate>

          {/* ── Profile Photo ── */}
          <div className="photo-upload-area">
            <div
              className={`photo-upload-circle ${form.gender}`}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="photo-preview-img" />
              ) : (
                <div className="photo-placeholder">
                  <span className="photo-ph-icon">📷</span>
                  <span className="photo-ph-text">Add Photo</span>
                </div>
              )}
              <div className="photo-hover-overlay">
                <span>{photoPreview ? '✏️ Change' : '📷 Upload'}</span>
              </div>
            </div>

            <div className="photo-actions">
              {photoPreview && (
                <button type="button" className="photo-remove-btn" onClick={removePhoto}>
                  ✕ Remove
                </button>
              )}
              <span className="form-hint">JPEG · PNG · Auto-compressed</span>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
              onClick={e => { e.target.value = '' }}
            />
          </div>

          {/* ── Family Connection ── */}
          {showRelationSelector && (
            <div className="form-section relation-section">
              <div className="form-section-title">Family Connection</div>

              <div className="form-group">
                <label>This person is a <span className="required">*</span></label>
                <div className="toggle-group">
                  <button
                    type="button"
                    className={`toggle-btn ${formRelation === 'spouse' ? 'active spouse-active' : ''}`}
                    onClick={() => { setFormRelation('spouse'); setErrors(p => ({ ...p, relation: undefined })) }}
                  >
                    💑 Spouse
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${formRelation === 'kid' ? 'active kid-active' : ''}`}
                    onClick={() => { setFormRelation('kid'); setErrors(p => ({ ...p, relation: undefined })) }}
                  >
                    👶 Child
                  </button>
                </div>
                {errors.relation && <span className="error-msg">{errors.relation}</span>}
              </div>

              <div className="form-group">
                <label>
                  {formRelation === 'spouse' ? 'Spouse of' : formRelation === 'kid' ? 'Child of' : 'Related to'}
                  {' '}<span className="required">*</span>
                </label>
                <select
                  className={`form-input ${errors.relatedToId ? 'error' : ''}`}
                  value={formRelatedToId}
                  onChange={e => { setFormRelatedToId(e.target.value); setErrors(p => ({ ...p, relatedToId: undefined })) }}
                >
                  <option value="">— Select family member —</option>
                  {eligibleMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.gender === 'male' ? '♂' : '♀'})
                    </option>
                  ))}
                </select>
                {errors.relatedToId && <span className="error-msg">{errors.relatedToId}</span>}
              </div>
            </div>
          )}

          {/* ── About Them ── */}
          <div className="form-section">
            <div className="form-section-title">About Them</div>

            <div className="form-group">
              <label>Full Name <span className="required">*</span></label>
              <input
                type="text"
                className={`form-input ${errors.fullName ? 'error' : ''}`}
                placeholder="Enter full name"
                value={form.fullName}
                onChange={e => handleChange('fullName', e.target.value)}
              />
              {errors.fullName && <span className="error-msg">{errors.fullName}</span>}
            </div>

            <div className="form-group">
              <label>Date of Birth <span className="required">*</span></label>
              <input
                type="date"
                className={`form-input ${errors.birthdate ? 'error' : ''}`}
                value={form.birthdate}
                onChange={e => handleChange('birthdate', e.target.value)}
              />
              {errors.birthdate && <span className="error-msg">{errors.birthdate}</span>}
            </div>

            <div className="form-group">
              <label>Gender <span className="required">*</span></label>
              <div className="radio-group">
                {['male', 'female'].map(g => (
                  <label key={g} className={`radio-option ${form.gender === g ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={form.gender === g}
                      onChange={() => handleChange('gender', g)}
                    />
                    <span className="radio-icon">
                      {g === 'male' ? '♂ Male' : '♀ Female'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Status ── */}
          <div className="form-section">
            <div className="form-section-title">Are They Still With Us?</div>

            <div className="form-group">
              <label>Status <span className="required">*</span></label>
              <div className="toggle-group">
                <button
                  type="button"
                  className={`toggle-btn ${form.isAlive ? 'active alive' : ''}`}
                  onClick={() => handleChange('isAlive', true)}
                >
                  💚 Still With Us
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${!form.isAlive ? 'active deceased' : ''}`}
                  onClick={() => handleChange('isAlive', false)}
                >
                  🕊️ In Our Hearts
                </button>
              </div>
            </div>

            {!form.isAlive && (
              <div className="form-group">
                <label>When Did They Leave Us? <span className="required">*</span></label>
                <input
                  type="datetime-local"
                  className={`form-input ${errors.passedDate ? 'error' : ''}`}
                  value={form.passedDate}
                  onChange={e => handleChange('passedDate', e.target.value)}
                />
                {errors.passedDate && <span className="error-msg">{errors.passedDate}</span>}
              </div>
            )}
          </div>

          {/* ── Status Pernikahan ── */}
          <div className="form-section">
            <div className="form-section-title">Status Pernikahan</div>
            <div className="form-group">
              <select
                className="form-input"
                value={form.maritalStatus}
                onChange={e => handleChange('maritalStatus', e.target.value)}
              >
                <option value="">— Pilih Status —</option>
                <option value="Belum Kawin">Belum Kawin</option>
                <option value="Kawin">Kawin</option>
                <option value="Cerai">Cerai</option>
              </select>
            </div>
          </div>

          {/* ── Contact ── */}
          <div className="form-section">
            <div className="form-section-title">Stay in Touch</div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+62 812 3456 7890"
                value={form.phone}
                onChange={e => handleChange('phone', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>WhatsApp Number</label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={waSameAsPhone}
                  onChange={e => setWaSameAsPhone(e.target.checked)}
                />
                <span>Same as phone number</span>
              </label>
              {!waSameAsPhone && (
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+62 812 3456 7890"
                  value={form.whatsapp}
                  onChange={e => handleChange('whatsapp', e.target.value)}
                />
              )}
              {waSameAsPhone && form.phone && (
                <p className="form-hint wa-preview">💬 Will use: {form.phone}</p>
              )}
              <span className="form-hint">Include country code, e.g. +62 for Indonesia</span>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {mode === 'edit' ? '💾 Save Their Story' : '🌿 Add to Our Family'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

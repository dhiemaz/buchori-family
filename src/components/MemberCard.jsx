import { useFamily } from '../context/FamilyContext'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function calcAge(birthdate, passedDate) {
  if (!birthdate) return null
  const end = passedDate ? new Date(passedDate) : new Date()
  const birth = new Date(birthdate)
  let age = end.getFullYear() - birth.getFullYear()
  const m = end.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) age--
  return age
}

export default function MemberCard({ member }) {
  const { openEdit, openAddSpouse, openAddKid, deleteMember, getSpouse } = useFamily()

  const age = calcAge(member.birthdate, member.passedDate)
  const hasSpouse = !!getSpouse(member)
  const isSpouse = !!member.spouseOfId

  const genderIcon = member.gender === 'male' ? '♂' : '♀'
  const genderClass = member.gender === 'male' ? 'male' : 'female'

  return (
    <div className={`member-card ${genderClass} ${!member.isAlive ? 'deceased' : ''}`}>
      {!member.isAlive && <div className="deceased-ribbon">Innalillahi</div>}

      <div className="card-header">
        {/* Avatar: photo when available, otherwise gender badge */}
        {member.photo ? (
          <div className={`card-avatar ${genderClass}`}>
            <img src={member.photo} alt={member.fullName} className="card-avatar-img" />
            <span className={`avatar-gender-pip ${genderClass}`}>{genderIcon}</span>
          </div>
        ) : (
          <div className={`gender-badge ${genderClass}`}>{genderIcon}</div>
        )}
        <div className="card-name-block">
          <h3 className="card-name">{member.fullName}</h3>
          <span className={`status-dot ${member.isAlive ? 'alive' : 'deceased'}`}>
            {member.isAlive ? '● Still with us' : '● In our hearts'}
          </span>
        </div>
      </div>

      <div className="card-info">
        <div className="info-row">
          <span className="info-icon">🎂</span>
          <span>{formatDate(member.birthdate)}{age !== null ? ` (${age} yrs)` : ''}</span>
        </div>

        {!member.isAlive && member.passedDate && (
          <div className="info-row">
            <span className="info-icon">🕊️</span>
            <span>{formatDate(member.passedDate)}</span>
          </div>
        )}

        {member.maritalStatus && (
          <div className="info-row">
            <span className="info-icon">💍</span>
            <span>{member.maritalStatus}</span>
          </div>
        )}

        {member.phone && (
          <div className="info-row">
            <span className="info-icon">📞</span>
            <span>{member.phone}</span>
          </div>
        )}

        {member.whatsapp && (
          <div className="info-row">
            <span className="info-icon">💬</span>
            <a
              href={`https://wa.me/${member.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="wa-link"
            >
              {member.whatsapp}
            </a>
          </div>
        )}
      </div>

      <div className="card-actions">
        <button className="action-btn edit" onClick={() => openEdit(member)} title="Edit">
          ✏️
        </button>
        {!isSpouse && !hasSpouse && (
          <button className="action-btn spouse" onClick={() => openAddSpouse(member.id)} title="Add Spouse">
            💑 Spouse
          </button>
        )}
        <button className="action-btn kid" onClick={() => openAddKid(member.id)} title="Add Kid">
          👶 Kid
        </button>
        <button
          className="action-btn delete"
          onClick={() => {
            if (window.confirm(`Delete ${member.fullName} and all their descendants?`)) {
              deleteMember(member.id)
            }
          }}
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

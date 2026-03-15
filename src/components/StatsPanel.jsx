import { useFamily } from '../context/FamilyContext'

export default function StatsPanel() {
  const { members } = useFamily()

  const total = members.length
  const alive = members.filter(m => m.isAlive).length
  const deceased = members.filter(m => !m.isAlive).length
  const males = members.filter(m => m.gender === 'male').length
  const females = members.filter(m => m.gender === 'female').length
  const generations = calcGenerations(members)

  return (
    <div className="stats-panel">
      <StatCard icon="👨‍👩‍👧‍👦" label="Anggota Keluarga" value={total} color="blue" />
      <StatCard icon="💚" label="Masih Hidup" value={alive} color="green" />
      <StatCard icon="🪦" label="Sudah Wafat" value={deceased} color="gray" />
      <StatCard icon="♂" label="Pria" value={males} color="blue" />
      <StatCard icon="♀" label="Wanita" value={females} color="pink" />
      <StatCard icon="🌳" label="Generasi" value={generations} color="brown" />
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function calcGenerations(members) {
  if (members.length === 0) return 0
  const roots = members.filter(m => !m.parentId && !m.spouseOfId)
  if (roots.length === 0) return 1

  function depth(memberId, visited = new Set()) {
    if (visited.has(memberId)) return 0
    visited.add(memberId)
    const children = members.filter(m => m.parentId === memberId)
    if (children.length === 0) return 1
    return 1 + Math.max(...children.map(c => depth(c.id, new Set(visited))))
  }

  return Math.max(...roots.map(r => depth(r.id)))
}

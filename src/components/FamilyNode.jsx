import { useState } from 'react'
import MemberCard from './MemberCard'
import { useFamily } from '../context/FamilyContext'

export default function FamilyNode({ member }) {
  const { getSpouse, getChildren, openAddKid } = useFamily()
  const [collapsed, setCollapsed] = useState(false)

  // Spouses are rendered inside their partner's node — skip solo rendering
  if (member.spouseOfId) return null

  const spouse = getSpouse(member)
  const children = getChildren(member)

  // Count all descendants (for the collapsed badge)
  function countDescendants(m) {
    const kids = getChildren(m)
    return kids.reduce((acc, k) => acc + 1 + countDescendants(k), 0)
  }
  const descendantCount = countDescendants(member)

  return (
    <div className="fn-wrapper">

      {/* ── Couple row ── */}
      <div className="fn-couple">
        <MemberCard member={member} />
        {spouse && (
          <>
            <div className="fn-couple-connector">
              <div className="fn-couple-line" />
              <span className="fn-heart">♥</span>
              <div className="fn-couple-line" />
            </div>
            <MemberCard member={spouse} />
          </>
        )}
      </div>

      {/* ── No children yet — invite button ── */}
      {children.length === 0 && (
        <div className="fn-add-child">
          <button className="btn-add-child" onClick={() => openAddKid(member.id)}>
            + Add Child
          </button>
        </div>
      )}

      {/* ── Children section ── */}
      {children.length > 0 && (
        <div className="fn-children-section">

          {/* Collapsible vertical connector */}
          <div className="fn-vline-toggle-wrap">
            <div className="fn-vline-seg" />
            <button
              className={`fn-toggle-btn ${collapsed ? 'is-collapsed' : ''}`}
              onClick={() => setCollapsed(v => !v)}
              title={collapsed
                ? `Expand — ${descendantCount} descendant${descendantCount !== 1 ? 's' : ''}`
                : 'Collapse branch'}
            >
              {collapsed ? descendantCount || children.length : '−'}
            </button>
            {!collapsed && <div className="fn-vline-seg" />}
          </div>

          {/* Children row — animated expand */}
          {!collapsed && (
            <div className="fn-children-row fn-expand">
              {children.map(child => (
                <div key={child.id} className="fn-child-col">
                  <FamilyNode member={child} />
                </div>
              ))}
              {/* Inline add button at the end of siblings */}
              <div className="fn-child-col fn-child-add-col">
                <div className="fn-child-add-stub" />
                <button
                  className="btn-add-child-inline"
                  onClick={() => openAddKid(member.id)}
                >
                  + Child
                </button>
              </div>
            </div>
          )}

          {/* Collapsed summary badge */}
          {collapsed && (
            <div className="fn-collapsed-badge">
              {children.length} child{children.length !== 1 ? 'ren' : ''}
              {descendantCount > children.length
                ? ` · ${descendantCount} total`
                : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

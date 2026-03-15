import { createContext, useContext, useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'

const FamilyContext = createContext(null)

const STORAGE_KEY = 'family-tree-data'

export function FamilyProvider({ children }) {
  const [members, setMembers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [modal, setModal] = useState({
    open: false,
    mode: 'add',          // 'add' | 'edit'
    relation: 'root',     // 'root' | 'spouse' | 'kid'
    relatedToId: null,    // id of the person this new member relates to
    editingMember: null,  // member object when editing
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(members))
  }, [members])

  function openAddRoot() {
    setModal({ open: true, mode: 'add', relation: 'root', relatedToId: null, editingMember: null })
  }

  function openAddSpouse(personId) {
    setModal({ open: true, mode: 'add', relation: 'spouse', relatedToId: personId, editingMember: null })
  }

  function openAddKid(personId) {
    setModal({ open: true, mode: 'add', relation: 'kid', relatedToId: personId, editingMember: null })
  }

  function openEdit(member) {
    setModal({ open: true, mode: 'edit', relation: member.relation, relatedToId: null, editingMember: member })
  }

  function closeModal() {
    setModal(prev => ({ ...prev, open: false }))
  }

  function saveMember(formData) {
    if (modal.mode === 'edit') {
      setMembers(prev =>
        prev.map(m => m.id === formData.id ? { ...m, ...formData } : m)
      )
    } else {
      // relation and relatedToId come from the form (editable) or fall back to modal
      const rel = formData.relation || modal.relation || 'root'
      const relId = formData.relatedToId || modal.relatedToId || null
      const newMember = {
        id: uuidv4(),
        fullName: formData.fullName,
        birthdate: formData.birthdate,
        gender: formData.gender,
        relation: rel,
        parentId: rel === 'kid' ? relId : null,
        spouseOfId: rel === 'spouse' ? relId : null,
        isAlive: formData.isAlive,
        passedDate: formData.isAlive ? null : formData.passedDate,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        maritalStatus: formData.maritalStatus || '',
        createdAt: new Date().toISOString(),
      }
      setMembers(prev => [...prev, newMember])
    }
    closeModal()
  }

  function deleteMember(id) {
    // Also remove any members that are spouses or kids of this person
    setMembers(prev => {
      const idsToRemove = new Set()
      function collectDescendants(memberId) {
        idsToRemove.add(memberId)
        prev.forEach(m => {
          if (m.parentId === memberId || m.spouseOfId === memberId) {
            if (!idsToRemove.has(m.id)) collectDescendants(m.id)
          }
        })
      }
      collectDescendants(id)
      return prev.filter(m => !idsToRemove.has(m.id))
    })
  }

  function getSpouse(member) {
    return members.find(m => m.spouseOfId === member.id || member.spouseOfId === m.id) || null
  }

  function getChildren(member) {
    const spouse = getSpouse(member)
    return members.filter(m =>
      m.parentId === member.id ||
      (spouse && m.parentId === spouse.id)
    )
  }

  function getRoots() {
    return members.filter(m => !m.parentId && !m.spouseOfId)
  }

  function importMembers(newMembers, mode) {
    if (mode === 'replace') {
      setMembers(newMembers)
    } else {
      // merge: skip members whose fullName already exists (case-insensitive)
      setMembers(prev => {
        const existingNames = new Set(prev.map(m => m.fullName.toLowerCase()))
        const toAdd = newMembers.filter(m => !existingNames.has(m.fullName.toLowerCase()))
        return [...prev, ...toAdd]
      })
    }
  }

  return (
    <FamilyContext.Provider value={{
      members,
      modal,
      openAddRoot,
      openAddSpouse,
      openAddKid,
      openEdit,
      closeModal,
      saveMember,
      deleteMember,
      getSpouse,
      getChildren,
      getRoots,
      importMembers,
    }}>
      {children}
    </FamilyContext.Provider>
  )
}

export function useFamily() {
  const ctx = useContext(FamilyContext)
  if (!ctx) throw new Error('useFamily must be used within FamilyProvider')
  return ctx
}

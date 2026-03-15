import { useFamily } from '../context/FamilyContext'
import FamilyNode from './FamilyNode'
import TreeCanvas from './TreeCanvas'
import ImportExport from './ImportExport'
import GoogleSheetsSync from './GoogleSheetsSync'

export default function FamilyTree() {
  const { members, getRoots, openAddRoot } = useFamily()

  if (members.length === 0) {
    return (
      <div className="tree-empty">
        <div className="tree-empty-icon">🌱</div>
        <h2>Every great story has a first chapter</h2>
        <p>Plant the first seed of your family's story.</p>
        <button className="btn btn-primary" onClick={openAddRoot}>
          ✨ Begin Our Story
        </button>
        <div className="tree-empty-or">or restore from a backup</div>
        <div className="tree-empty-sync">
          <ImportExport />
          <GoogleSheetsSync />
        </div>
      </div>
    )
  }

  const roots = getRoots()

  return (
    <TreeCanvas>
      <div className="tc-tree-canvas">
        {roots.map(root => (
          <FamilyNode key={root.id} member={root} />
        ))}
      </div>
    </TreeCanvas>
  )
}

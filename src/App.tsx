import { Stage } from './scene/Stage'
import { Panel, ViewBar } from './ui/Panel'
import { JewelryEditor } from './ui/JewelryEditor'
import { AccessoryEditor } from './ui/AccessoryEditor'
import { ProjectBar } from './ui/ProjectBar'
import { useApp } from './store'
import { isRingZone } from './jewelry/types'
import { isAccZone } from './jewelry/accessory'

export function App() {
  const editing = useApp((s) => isRingZone(s.zone) || isAccZone(s.zone))
  return (
    <div className={`app ${editing ? 'editing' : ''}`}>
      <Panel />
      <main className="viewport">
        <Stage />
        <ViewBar />
        <ProjectBar />
      </main>
      <JewelryEditor />
      <AccessoryEditor />
    </div>
  )
}

import { DriveMusicLibrary } from '../components/DriveMusicLibrary'
import { PageHeader } from '../components/ui'
export default function GoogleDrivePage() {
  return <div><PageHeader title="Google Drive" description="Conecte sua conta e escolha suas pastas para usar nos vídeos." /><DriveMusicLibrary onImported={() => {}} /></div>
}

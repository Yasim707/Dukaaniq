import { BarChart3 } from 'lucide-react'
import { PageShell } from '../../components/PageShell'
import { EmptyState } from '../../components/EmptyState'
import { useSettingsContext } from '../../app/SettingsContext'
import { useT } from '../../i18n'

export function InsightsPage() {
  const { settings } = useSettingsContext()
  const tr = useT(settings.language)

  return (
    <PageShell>
      <EmptyState
        icon={BarChart3}
        title={tr('insights.title')}
        description="Charts and analytics will appear here once you record some sales."
      />
    </PageShell>
  )
}

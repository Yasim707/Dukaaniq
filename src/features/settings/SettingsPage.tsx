import { Settings, Download, Upload, FileJson, FileSpreadsheet, AlertTriangle } from 'lucide-react'
import { useState, useRef } from 'react'
import { PageShell } from '../../components/PageShell'
import { useSettingsContext } from '../../app/SettingsContext'
import { useT } from '../../i18n'
import type { Language } from '../../types'
import { exportToJSON, downloadJSON, validateBackup, importFromJSON, exportInventoryToCSV, exportSalesToCSV, downloadCSV } from '../../lib/backup'

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'اردو (Urdu)' },
  { value: 'roman', label: 'Roman Urdu' },
]

export function SettingsPage() {
  const { settings, updateSettings } = useSettingsContext()
  const tr = useT(settings.language)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace')
  const [confirmReplace, setConfirmReplace] = useState(false)

  async function handleExportJSON() {
    setExporting(true)
    try {
      const json = await exportToJSON()
      downloadJSON(json)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportInventoryCSV() {
    setExporting(true)
    try {
      const csv = await exportInventoryToCSV()
      downloadCSV(csv, `dukaaniq-inventory-${Date.now()}.csv`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportSalesCSV() {
    setExporting(true)
    try {
      const csv = await exportSalesToCSV()
      downloadCSV(csv, `dukaaniq-sales-${Date.now()}.csv`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true)
    setImportError(null)
    try {
      const text = await file.text()
      const result = await validateBackup(text)
      
      if (!result.valid) {
        setImportError(result.error || 'Invalid backup file')
        return
      }

      if (importMode === 'replace' && !confirmReplace) {
        setConfirmReplace(true)
        return
      }

      await importFromJSON(result.data!, importMode)
      alert('Data imported successfully. Refreshing page...')
      window.location.reload()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <PageShell>
      <div className="max-w-2xl">
        {/* Shop Settings */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Settings size={16} className="text-brand-700" />
            <h2 className="text-sm font-semibold text-ink">{tr('settings.title')}</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="shopName" className="block text-xs font-medium text-ink-light mb-1">
                {tr('settings.shopName')}
              </label>
              <input
                id="shopName"
                type="text"
                value={settings.shopName}
                onChange={e => updateSettings({ shopName: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            <div>
              <label htmlFor="language" className="block text-xs font-medium text-ink-light mb-1">
                {tr('settings.language')}
              </label>
              <select
                id="language"
                value={settings.language}
                onChange={e => updateSettings({ language: e.target.value as Language })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                {LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted mt-1">RTL layout applied for Urdu</p>
            </div>

            <div>
              <label htmlFor="threshold" className="block text-xs font-medium text-ink-light mb-1">
                Low Stock Threshold
              </label>
              <input
                id="threshold"
                type="number"
                min={0}
                value={settings.lowStockThreshold}
                onChange={e => updateSettings({ lowStockThreshold: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="demoData" className="text-xs font-medium text-ink-light">
                {tr('settings.demoData')}
              </label>
              <button
                id="demoData"
                role="switch"
                aria-checked={settings.showDemoData}
                onClick={() => updateSettings({ showDemoData: !settings.showDemoData })}
                className={[
                  'relative inline-flex h-5 w-9 cursor-pointer rounded-full transition-colors duration-200',
                  settings.showDemoData ? 'bg-brand-600' : 'bg-stone-200',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                    settings.showDemoData ? 'translate-x-4' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Backup & Export */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Download size={16} className="text-brand-700" />
            <h2 className="text-sm font-semibold text-ink">Backup & Export</h2>
          </div>
          <div className="p-5 space-y-3">
            <button
              onClick={handleExportJSON}
              disabled={exporting}
              className="w-full flex items-center gap-3 px-4 py-3 border border-border rounded-lg hover:bg-surface transition-colors text-left disabled:opacity-50"
            >
              <FileJson size={18} className="text-brand-700 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">Export All Data (JSON)</p>
                <p className="text-xs text-muted">Complete backup with all records</p>
              </div>
            </button>

            <button
              onClick={handleExportInventoryCSV}
              disabled={exporting}
              className="w-full flex items-center gap-3 px-4 py-3 border border-border rounded-lg hover:bg-surface transition-colors text-left disabled:opacity-50"
            >
              <FileSpreadsheet size={18} className="text-brand-700 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">Export Inventory (CSV)</p>
                <p className="text-xs text-muted">Products list for spreadsheets</p>
              </div>
            </button>

            <button
              onClick={handleExportSalesCSV}
              disabled={exporting}
              className="w-full flex items-center gap-3 px-4 py-3 border border-border rounded-lg hover:bg-surface transition-colors text-left disabled:opacity-50"
            >
              <FileSpreadsheet size={18} className="text-brand-700 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">Export Sales (CSV)</p>
                <p className="text-xs text-muted">Transaction history for analysis</p>
              </div>
            </button>
          </div>
        </div>

        {/* Import */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Upload size={16} className="text-brand-700" />
            <h2 className="text-sm font-semibold text-ink">Import Data</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-800 mb-1">Important</p>
                <p className="text-xs text-amber-700">
                  Importing will {importMode === 'replace' ? 'REPLACE all existing data' : 'merge with existing data'}. 
                  Export a backup first to avoid data loss.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-light mb-2">Import Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => { setImportMode('replace'); setConfirmReplace(false) }}
                  className={`flex-1 px-3 py-2 text-xs font-medium border rounded-lg transition-colors ${importMode === 'replace' ? 'bg-brand-700 text-white border-brand-700' : 'border-border text-ink-light hover:bg-surface'}`}
                >
                  Replace All
                </button>
                <button
                  onClick={() => { setImportMode('merge'); setConfirmReplace(false) }}
                  className={`flex-1 px-3 py-2 text-xs font-medium border rounded-lg transition-colors ${importMode === 'merge' ? 'bg-brand-700 text-white border-brand-700' : 'border-border text-ink-light hover:bg-surface'}`}
                >
                  Merge
                </button>
              </div>
            </div>

            {confirmReplace && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-medium text-red-800 mb-2">Are you sure?</p>
                <p className="text-xs text-red-700 mb-3">
                  This will permanently delete all current products, sales, customers, and udhaar records.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmReplace(false)}
                    className="flex-1 px-3 py-2 text-xs font-medium border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 px-3 py-2 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Proceed
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleImportFile(file)
                e.target.value = ''
              }}
              className="hidden"
            />

            {!confirmReplace && (
              <button
                onClick={() => {
                  if (importMode === 'replace') {
                    setConfirmReplace(true)
                  } else {
                    fileInputRef.current?.click()
                  }
                }}
                disabled={importing}
                className="w-full px-4 py-3 bg-brand-700 text-white text-sm font-medium rounded-lg hover:bg-brand-800 disabled:opacity-50 transition-colors"
              >
                {importing ? 'Importing...' : 'Choose Backup File'}
              </button>
            )}

            {importError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {importError}
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-muted text-center mt-6">
          DukaanIQ · Offline-first · Data stored locally in your browser
        </p>
      </div>
    </PageShell>
  )
}

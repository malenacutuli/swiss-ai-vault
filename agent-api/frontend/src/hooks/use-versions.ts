import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useToast } from './use-toast'

export interface PromptVersion {
  prompt_id: string
  version: number
  content: string
  system_prompt: string
  status: 'draft' | 'active' | 'archived' | 'deprecated'
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export function useVersions(promptId: string | null) {
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const loadVersions = async () => {
    if (!promptId) return

    setLoading(true)
    setError(null)

    try {
      const data = await api.listVersions(promptId) as PromptVersion[]
      setVersions(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load versions'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const createVersion = async (data: {
    content: string
    system_prompt: string
    metadata?: Record<string, any>
  }) => {
    if (!promptId) return

    try {
      const newVersion = await api.createVersion({
        prompt_id: promptId,
        ...data,
      })
      toast.success('Version created successfully')
      await loadVersions()
      return newVersion
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create version'
      toast.error(message)
      throw err
    }
  }

  const activateVersion = async (version: number) => {
    if (!promptId) return

    try {
      await api.activateVersion(promptId, version)
      toast.success(`Version ${version} activated`)
      await loadVersions()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to activate version'
      toast.error(message)
      throw err
    }
  }

  const rollbackVersion = async (version: number) => {
    if (!promptId) return

    try {
      await api.rollbackVersion(promptId, version)
      toast.success(`Rolled back to version ${version}`)
      await loadVersions()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rollback'
      toast.error(message)
      throw err
    }
  }

  useEffect(() => {
    loadVersions()
  }, [promptId])

  return {
    versions,
    loading,
    error,
    loadVersions,
    createVersion,
    activateVersion,
    rollbackVersion,
  }
}

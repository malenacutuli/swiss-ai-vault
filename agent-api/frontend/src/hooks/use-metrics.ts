import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useToast } from './use-toast'

export interface PromptMetrics {
  prompt_id: string
  version?: number
  total_executions: number
  avg_latency_ms: number
  success_rate: number
  avg_tokens: number
  cost_usd: number
  period_start: string
  period_end: string
}

export function useMetrics(promptId: string | null, days: number = 30) {
  const [metrics, setMetrics] = useState<PromptMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const loadMetrics = async () => {
    if (!promptId) return

    setLoading(true)
    setError(null)

    try {
      const data = await api.getMetrics(promptId, undefined, days) as PromptMetrics
      setMetrics(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load metrics'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const recordMetric = async (data: {
    version: number
    latency_ms: number
    tokens_used: number
    success: boolean
    error_message?: string
  }) => {
    if (!promptId) return

    try {
      await api.recordMetric({
        prompt_id: promptId,
        ...data,
      })
      await loadMetrics()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record metric'
      toast.error(message)
      throw err
    }
  }

  useEffect(() => {
    loadMetrics()
  }, [promptId, days])

  return {
    metrics,
    loading,
    error,
    loadMetrics,
    recordMetric,
  }
}

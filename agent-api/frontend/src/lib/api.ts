/**
 * API Client for Prompt Management System
 *
 * Communicates with the FastAPI backend at /api/prompts/*
 */

const API_BASE = '/api/prompts'

class ApiClient {
  private token: string | null = null

  setToken(token: string) {
    this.token = token
    localStorage.setItem('auth_token', token)
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token')
    }
    return this.token
  }

  clearToken() {
    this.token = null
    localStorage.removeItem('auth_token')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken()
        window.location.href = '/login'
      }
      const error = await response.json().catch(() => ({ detail: 'Request failed' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Version Management
  async createVersion(data: {
    prompt_id: string
    content: string
    system_prompt: string
    metadata?: Record<string, any>
  }) {
    return this.request('/versions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async listVersions(promptId: string) {
    return this.request(`/versions/${promptId}`)
  }

  async getVersion(promptId: string, version: number) {
    return this.request(`/versions/${promptId}/${version}`)
  }

  async getActiveVersion(promptId: string) {
    return this.request(`/versions/${promptId}/active`)
  }

  async activateVersion(promptId: string, version: number) {
    return this.request('/versions/activate', {
      method: 'POST',
      body: JSON.stringify({ prompt_id: promptId, version }),
    })
  }

  async rollbackVersion(promptId: string, version: number) {
    return this.request('/versions/rollback', {
      method: 'POST',
      body: JSON.stringify({ prompt_id: promptId, version }),
    })
  }

  // Template Management
  async createTemplate(data: {
    template_id: string
    name: string
    template: string
    description?: string
  }) {
    return this.request('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async listTemplates() {
    return this.request('/templates')
  }

  async getTemplate(templateId: string) {
    return this.request(`/templates/${templateId}`)
  }

  async updateTemplate(templateId: string, data: {
    name?: string
    template?: string
    description?: string
  }) {
    return this.request(`/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteTemplate(templateId: string) {
    return this.request(`/templates/${templateId}`, {
      method: 'DELETE',
    })
  }

  async renderTemplate(templateId: string, values: Record<string, any>) {
    return this.request('/templates/render', {
      method: 'POST',
      body: JSON.stringify({ template_id: templateId, values }),
    })
  }

  // A/B Testing
  async createABTest(data: {
    test_id: string
    prompt_a_id: string
    prompt_b_id: string
    split?: number
  }) {
    return this.request('/ab-tests', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async listABTests(status?: string) {
    const query = status ? `?status=${status}` : ''
    return this.request(`/ab-tests${query}`)
  }

  async getABTest(testId: string) {
    return this.request(`/ab-tests/${testId}`)
  }

  async getABTestResults(testId: string) {
    return this.request(`/ab-tests/${testId}/results`)
  }

  async completeABTest(testId: string) {
    return this.request(`/ab-tests/${testId}/complete`, {
      method: 'POST',
    })
  }

  // Metrics
  async recordExecution(data: {
    prompt_id: string
    success: boolean
    latency: number
    version?: number
    execution_id?: string
    score?: number
    metadata?: Record<string, any>
  }) {
    return this.request('/metrics/record', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async recordMetric(data: {
    prompt_id: string
    version: number
    latency_ms: number
    tokens_used: number
    success: boolean
    error_message?: string
  }) {
    return this.request('/metrics/record', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getMetrics(promptId: string, version?: number, days: number = 30) {
    const params = new URLSearchParams({ days: days.toString() })
    if (version) params.append('version', version.toString())
    return this.request(`/metrics/${promptId}?${params}`)
  }

  async getMetricsHistory(
    promptId: string,
    version?: number,
    days: number = 30,
    granularity: 'hourly' | 'daily' = 'daily'
  ) {
    const params = new URLSearchParams({
      days: days.toString(),
      granularity,
    })
    if (version) params.append('version', version.toString())
    return this.request(`/metrics/${promptId}/history?${params}`)
  }

  async getTopPrompts(
    limit: number = 10,
    days: number = 30,
    orderBy: 'success_rate' | 'avg_latency' | 'avg_score' = 'success_rate'
  ) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      days: days.toString(),
      order_by: orderBy,
    })
    return this.request(`/metrics/top?${params}`)
  }

  // Optimization
  async analyzePerformance(promptId: string, days: number = 30) {
    return this.request(`/optimize/${promptId}/analyze?days=${days}`)
  }

  async getRecommendations(promptId: string, days: number = 30) {
    return this.request(`/optimize/${promptId}/recommendations?days=${days}`)
  }

  async autoOptimize(promptId: string, autoActivate: boolean = false) {
    return this.request('/optimize', {
      method: 'POST',
      body: JSON.stringify({ prompt_id: promptId, auto_activate: autoActivate }),
    })
  }

  async getOptimalPrompt(promptId: string) {
    return this.request(`/optimize/${promptId}/optimal`)
  }
}

export const api = new ApiClient()

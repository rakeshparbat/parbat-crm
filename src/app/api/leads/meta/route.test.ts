import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

const h = vi.hoisted(() => ({
  ingestLead: vi.fn(),
  decrypt: vi.fn((val: string) => `decrypted-${val}`),
  state: {
    afterCallbacks: [] as (() => Promise<void> | void)[],
    configs: [] as { id: string; page_id?: string; account_id?: string; verify_token?: string; page_access_token?: string }[],
    fetchResponses: new Map<string, unknown>(),
  },
}))

vi.mock('next/server', () => ({
  after: (cb: () => Promise<void> | void) => {
    h.state.afterCallbacks.push(cb)
  },
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (_table: string) => ({
      select: (_cols?: string) => ({
        eq: (_field: string, val: string) => ({
          data: h.state.configs.filter((c) => c.page_id === val),
          error: null,
        }),
        data: h.state.configs,
        error: null,
      }),
    }),
  }),
}))

vi.mock('@/lib/whatsapp/encryption', () => ({
  decrypt: (val: string) => h.decrypt(val),
}))

vi.mock('@/lib/leads/ingest', () => ({
  ingestLead: (...args: unknown[]) => h.ingestLead(...args),
}))

// Mock global fetch for Graph API calls
global.fetch = vi.fn(async (url: string | URL | Request) => {
  const urlStr = url.toString()
  const res = h.state.fetchResponses.get(urlStr)
  if (res) {
    return {
      ok: true,
      json: async () => res,
      text: async () => JSON.stringify(res),
    } as Response
  }
  return {
    ok: false,
    text: async () => 'Not found',
  } as Response
})

import { GET, POST } from './route'

const TEST_SECRET = 'test-meta-secret'

function signBody(body: string, secret = TEST_SECRET): string {
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return `sha256=${hmac}`
}

describe('Meta Leads Webhook (/api/leads/meta)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.state.afterCallbacks = []
    h.state.configs = []
    h.state.fetchResponses.clear()
    process.env.META_APP_SECRET = TEST_SECRET
    delete process.env.WHATSAPP_VERIFY_TOKEN
    delete process.env.META_VERIFY_TOKEN
  })

  describe('GET verification handshake', () => {
    it('returns 400 when verification parameters are missing', async () => {
      const req = new Request('https://crm.example.com/api/leads/meta')
      const res = await GET(req)
      expect(res.status).toBe(400)
    })

    it('verifies successfully via env verify token fallback', async () => {
      process.env.META_VERIFY_TOKEN = 'secret-token-123'
      const req = new Request(
        'https://crm.example.com/api/leads/meta?hub.mode=subscribe&hub.challenge=testchallenge&hub.verify_token=secret-token-123'
      )
      const res = await GET(req)
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe('testchallenge')
    })

    it('verifies successfully via db config verify token', async () => {
      h.decrypt.mockReturnValue('db-token-abc')
      h.state.configs = [{ id: 'cfg-1', verify_token: 'enc-token' }]

      const req = new Request(
        'https://crm.example.com/api/leads/meta?hub.mode=subscribe&hub.challenge=challenge456&hub.verify_token=db-token-abc'
      )
      const res = await GET(req)
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe('challenge456')
    })

    it('returns 403 on verify token mismatch', async () => {
      h.decrypt.mockReturnValue('other-token')
      h.state.configs = [{ id: 'cfg-1', verify_token: 'enc-token' }]

      const req = new Request(
        'https://crm.example.com/api/leads/meta?hub.mode=subscribe&hub.challenge=ch&hub.verify_token=wrong-token'
      )
      const res = await GET(req)
      expect(res.status).toBe(403)
    })
  })

  describe('POST leadgen event', () => {
    it('rejects requests with missing or invalid signature', async () => {
      const body = JSON.stringify({ object: 'page' })
      const req = new Request('https://crm.example.com/api/leads/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    it('accepts validly signed webhook, fetches lead, and ingests contact', async () => {
      h.decrypt.mockReturnValue('decrypted-access-token')
      h.ingestLead.mockResolvedValue({ contactId: 'contact-999', created: true })

      h.state.configs = [
        {
          id: 'cfg-1',
          page_id: '123456789',
          account_id: 'acc-1',
          page_access_token: 'enc-token',
        },
      ]

      const leadId = 'leadgen-777'
      const graphUrl = `https://graph.facebook.com/v21.0/${leadId}?fields=field_data,created_time&access_token=decrypted-access-token`
      h.state.fetchResponses.set(graphUrl, {
        id: leadId,
        created_time: '2026-10-10T07:00:00+0000',
        field_data: [
          { name: 'full_name', values: ['Alice Smith'] },
          { name: 'phone_number', values: ['+14155552671'] },
          { name: 'email', values: ['alice@example.com'] },
          { name: 'company_name', values: ['Acme Corp'] },
          { name: 'budget', values: ['$5,000'] },
        ],
      })

      const payload = {
        object: 'page',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                field: 'leadgen',
                value: {
                  leadgen_id: leadId,
                  page_id: '123456789',
                  form_id: 'form-99',
                  created_time: 1728540000,
                },
              },
            ],
          },
        ],
      }

      const rawBody = JSON.stringify(payload)
      const sig = signBody(rawBody)

      const req = new Request('https://crm.example.com/api/leads/meta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': sig,
        },
        body: rawBody,
      })

      const res = await POST(req)
      expect(res.status).toBe(200)

      // Execute after() callback
      expect(h.state.afterCallbacks.length).toBe(1)
      await h.state.afterCallbacks[0]()

      expect(h.ingestLead).toHaveBeenCalledTimes(1)
      expect(h.ingestLead).toHaveBeenCalledWith(
        expect.anything(),
        'acc-1',
        'meta',
        expect.objectContaining({
          phone: '+14155552671',
          name: 'Alice Smith',
          email: 'alice@example.com',
          company: 'Acme Corp',
          note: 'budget: $5,000',
          extraTags: ['form-form-99'],
        })
      )
    })
  })
})

import http2 from 'http2'
import { z } from 'zod'

export type InstagramProfile = {
  username: string
  full_name: string
  biography: string
  profile_pic_url: string
  follower_count: number
  is_private?: boolean
}

export type InstagramResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

const INSTAGRAM_BASE_URL = 'https://www.instagram.com'
const INSTAGRAM_API_ENDPOINT = '/api/v1/users/web_profile_info/'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const X_IG_APP_ID = '936619743392459'
const REQUEST_TIMEOUT = 10000
const RATE_LIMIT_DELAY = 1500

const instagramAPIResponseSchema = z.object({
  data: z.object({
    user: z.object({
      username: z.string(),
      full_name: z.string(),
      biography: z.string(),
      profile_pic_url_hd: z.string().url().optional(),
      profile_pic_url: z.string().url(),
      edge_followed_by: z.object({ count: z.number().int().nonnegative() }),
      is_private: z.boolean(),
    }),
  }),
})

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cleanHandle(handle: string): string {
  return handle.toLowerCase().replace('@', '').trim()
}

function http2Get(
  url: string,
  headers: Record<string, string>
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const client = http2.connect(`https://${parsed.hostname}`)

    const timeoutId = setTimeout(() => {
      client.close()
      reject(new Error('Timeout'))
    }, REQUEST_TIMEOUT)

    client.on('error', (err) => {
      clearTimeout(timeoutId)
      client.close()
      reject(err)
    })

    const req = client.request({
      ':method': 'GET',
      ':path': `${parsed.pathname}${parsed.search}`,
      ...headers,
    })

    let data = ''
    let status = 0

    req.on('response', (h) => { status = h[':status'] as number })
    req.on('data', (chunk: Buffer) => { data += chunk })
    req.on('end', () => {
      clearTimeout(timeoutId)
      client.close()
      resolve({ status, body: data })
    })
    req.on('error', (err) => {
      clearTimeout(timeoutId)
      client.close()
      reject(err)
    })
    req.end()
  })
}

export async function getInstagramProfile(
  handle: string
): Promise<InstagramResult<InstagramProfile>> {
  try {
    const cleanedHandle = cleanHandle(handle)
    if (!cleanedHandle) {
      return { success: false, error: 'Username de Instagram inválido' }
    }

    const url = new URL(INSTAGRAM_API_ENDPOINT, INSTAGRAM_BASE_URL)
    url.searchParams.append('username', cleanedHandle)

    const headers = {
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      Referer: `${INSTAGRAM_BASE_URL}/${cleanedHandle}/`,
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent': USER_AGENT,
      'X-ASBD-ID': '129477',
      'X-IG-App-ID': X_IG_APP_ID,
      'X-IG-WWW-Claim': '0',
      'X-Requested-With': 'XMLHttpRequest',
    }

    const response = await http2Get(url.toString(), headers)

    if (response.status === 404) {
      await delay(RATE_LIMIT_DELAY)
      return { success: false, error: 'Usuario de Instagram no encontrado' }
    }
    if (response.status === 429) {
      await delay(RATE_LIMIT_DELAY)
      return { success: false, error: 'Rate limit excedido. Intentá nuevamente en unos minutos' }
    }
    if (response.status === 401 || response.status === 403) {
      console.error(`[Instagram] HTTP ${response.status} for @${cleanedHandle}`)
      await delay(RATE_LIMIT_DELAY)
      return { success: false, error: 'No se pudo obtener la imagen. Intentá de nuevo o subila manualmente.' }
    }
    if (response.status < 200 || response.status >= 300) {
      console.error(`[Instagram] HTTP ${response.status} for @${cleanedHandle}:`, response.body.slice(0, 200))
      await delay(RATE_LIMIT_DELAY)
      return { success: false, error: `Error de Instagram: ${response.status}` }
    }

    const jsonData = JSON.parse(response.body)
    const validated = instagramAPIResponseSchema.parse(jsonData)
    const user = validated.data.user

    const profile: InstagramProfile = {
      username: user.username,
      full_name: user.full_name,
      biography: user.biography || '',
      profile_pic_url: user.profile_pic_url_hd || user.profile_pic_url,
      follower_count: user.edge_followed_by.count,
      is_private: user.is_private,
    }

    await delay(RATE_LIMIT_DELAY)
    return { success: true, data: profile }
  } catch (error) {
    await delay(RATE_LIMIT_DELAY)

    if (error instanceof Error && error.message === 'Timeout') {
      return { success: false, error: 'Timeout al conectar con Instagram' }
    }
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Instagram cambió el formato de respuesta' }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

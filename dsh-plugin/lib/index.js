/**
 * wechatauto DSH 桥接插件
 *
 * 把本地跑着的 wechatauto 服务（默认 http://127.0.0.1:8010）包装成 DSH 原生工具：
 *   wechatauto_status      服务与账号状态
 *   wechatauto_send_text   发文本（群/私聊）
 *   wechatauto_send_file   发文件
 *   wechatauto_send_image  发图片/表情
 *   wechatauto_groups      列出群
 *
 * 只调用上游 HTTP 接口，不包含上游代码。上游 wechatauto-replica 为 Apache-2.0。
 */
import { pathToFileURL } from 'node:url'

const runtimeRoot = process.env.QUNBAN_DSH_RUNTIME_ROOT || ''
if (!runtimeRoot) {
  throw new Error('QUNBAN_DSH_RUNTIME_ROOT is required to load this plugin')
}
const { defineTool } = await import(
  pathToFileURL(`${runtimeRoot}/node_modules/@deepseek-ai/dsh-tools/lib/index.js`).href
)

export const name = 'wechatauto-bridge'
export const inject = ['tools']

const BASE = (process.env.QUNBAN_WECHATAUTO_BASE || 'http://127.0.0.1:8010').replace(/\/+$/, '')
const TIMEOUT_MS = Number(process.env.QUNBAN_WECHATAUTO_TIMEOUT_MS || 60000)

async function call(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    })
    const text = await res.text()
    let data
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { raw: text.slice(0, 400) }
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.detail || data.error || text.slice(0, 300) }
    }
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: `${error?.name || 'Error'}: ${error?.message || error}` }
  } finally {
    clearTimeout(timer)
  }
}

const roomParam = {
  type: 'string',
  description: '会话 id：群聊传 xxx@chatroom，私聊传对方 wxid',
}

function tool(toolName, description, parameters, handler) {
  return defineTool({
    name: toolName,
    description,
    parameters,
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args, exec) {
      try {
        const result = await handler(args || {}, exec || {})
        return JSON.stringify(result)
      } catch (error) {
        return JSON.stringify({ ok: false, error: String(error?.message || error) })
      }
    },
  })
}

export function apply(ctx) {
  ctx.tools.register(tool(
    'wechatauto_status',
    '查看本地 wechatauto 服务是否在线、当前登录账号（wxid/昵称）与版本。发送前先用它确认在线状态。',
    { type: 'object', properties: {}, additionalProperties: false },
    async () => call('/v1/status'),
  ))

  ctx.tools.register(tool(
    'wechatauto_send_text',
    '通过本地 wechatauto 服务发送文本消息（群聊或私聊）。发送由客户端自动化完成，服务会校验是否落库。',
    {
      type: 'object',
      properties: {
        room_id: roomParam,
        text: { type: 'string', description: '消息正文，建议简短自然' },
        reuse_chat: { type: 'boolean', description: '是否复用已打开的会话窗口（更快，默认 false）' },
      },
      required: ['room_id', 'text'],
      additionalProperties: false,
    },
    async (args) => call('/v1/send_text', {
      method: 'POST',
      body: JSON.stringify({ room_id: args.room_id, text: args.text, reuse_chat: !!args.reuse_chat }),
    }),
  ))

  ctx.tools.register(tool(
    'wechatauto_send_file',
    '通过本地服务发送文件（PDF/Word/Excel/压缩包/视频等，单个 <1GB）。',
    {
      type: 'object',
      properties: {
        room_id: roomParam,
        path: { type: 'string', description: '本地文件绝对路径' },
      },
      required: ['room_id', 'path'],
      additionalProperties: false,
    },
    async (args) => call('/v1/send_file', {
      method: 'POST',
      body: JSON.stringify({ room_id: args.room_id, path: args.path }),
    }),
  ))

  ctx.tools.register(tool(
    'wechatauto_send_image',
    '通过本地服务发送图片或表情包（PNG/JPG/GIF，走 sticker 通道）。',
    {
      type: 'object',
      properties: {
        room_id: roomParam,
        path: { type: 'string', description: '图片绝对路径' },
      },
      required: ['room_id', 'path'],
      additionalProperties: false,
    },
    async (args) => call('/v1/send_sticker', {
      method: 'POST',
      body: JSON.stringify({ room_id: args.room_id, path: args.path }),
    }),
  ))

  ctx.tools.register(tool(
    'wechatauto_groups',
    '列出服务已知的群（含群 id 与群名），用于发送前确认 room_id。',
    { type: 'object', properties: {}, additionalProperties: false },
    async () => call('/v1/groups'),
  ))
}

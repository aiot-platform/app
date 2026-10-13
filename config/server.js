/**
 * 后端服务器地址统一配置（HTTP 接口与 WebSocket 共用）。
 *
 * 优先级：
 *   1. 用户在 App 内填写的地址（登录页 / 我的 → 服务器地址），保存在本地存储 serverAddress
 *   2. 构建时环境变量 VITE_SERVER_URL（在 app/.env 中配置，修改后需重新编译）
 *   3. 官方演示服务器 https://demo.thingspanel.cn
 *
 * WebSocket 地址由 HTTP 地址自动推导：http → ws，https → wss。
 * 地址填写 nginx 入口即可（如 http://192.168.1.10:8080），末尾带不带 /api/v1 都可以。
 */
const FALLBACK_SERVER_URL = 'https://demo.thingspanel.cn'

function readServerUrlFromEnv() {
  try {
    return import.meta.env?.VITE_SERVER_URL || ''
  } catch (error) {
    return ''
  }
}

/** 默认服务器地址（未在 App 内填写时使用） */
export const DEFAULT_SERVER_URL = String(readServerUrlFromEnv() || FALLBACK_SERVER_URL).trim().replace(/\/+$/, '')

/** 当前生效的服务器地址（原样，可能带 /api/v1） */
export function getServerAddress(storage) {
  const source = storage || uni
  return String(source.getStorageSync('serverAddress') || DEFAULT_SERVER_URL)
}

/** 服务器根地址（去掉末尾斜杠和 /api/v1），用于拼接 /api/v1/...、/files/... 等 */
export function getServerBase(storage) {
  return getServerAddress(storage).replace(/\/+$/, '').replace(/\/api\/v1$/i, '')
}

/** WebSocket 根地址：http → ws，https → wss */
export function getWsBase(storage) {
  return getServerBase(storage).replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://')
}

import httpClient from '../../api/client'
import { clearSessionStorage } from './session'

const LOGIN_PAGE = '/pages/login/index'
const PUBLIC_PAGES = new Set(['pages/login/index', 'pages/login/register', 'pages/web-view/legal'])
const PUBLIC_APIS = new Set(['/api/v1/login', '/api/v1/verification/code', '/api/v1/tenant/email/register'])
let loginNavigation = null

export function miniSessionSnapshot() {
  return {
    token: uni.getStorageSync('access_token'),
    server: uni.getStorageSync('serverAddress') || 'https://cloud.thingspanel.cn'
  }
}

export function isCurrentMiniSession(session) {
  const current = miniSessionSnapshot()
  return session.token === current.token && session.server === current.server
}

export function isPublicMiniApi(url) {
  return PUBLIC_APIS.has(String(url).replace(/^https?:\/\/[^/]+/i, '').split('?')[0])
}

export function openMiniLogin() {
  if (loginNavigation) return loginNavigation
  const pages = getCurrentPages()
  if (pages[pages.length - 1]?.route === 'pages/login/index') return Promise.resolve(true)
  loginNavigation = new Promise(resolve => {
    uni.reLaunch({
      url: LOGIN_PAGE,
      success: () => resolve(true),
      fail: () => uni.redirectTo({ url: LOGIN_PAGE, success: () => resolve(true), fail: () => resolve(false) })
    })
  }).then(success => {
    if (!success) uni.showToast({ title: '无法打开登录页，请重新进入小程序', icon: 'none' })
    return success
  }).finally(() => { loginNavigation = null })
  return loginNavigation
}

export function requireMiniSession(route = '') {
  if (PUBLIC_PAGES.has(route.replace(/^\//, '').split('?')[0]) || miniSessionSnapshot().token) return true
  openMiniLogin()
  return false
}

export function expireMiniSession(session) {
  // A delayed response from the previous account must not log out the new one.
  if (!session.token || !isCurrentMiniSession(session)) return
  clearSessionStorage()
  openMiniLogin()
}

export function logoutMiniSession() {
  const session = miniSessionSnapshot()
  clearSessionStorage()
  uni.removeStorageSync('ywId')
  // Local logout and navigation never wait for the server or require a valid token.
  const navigation = openMiniLogin()
  if (session.token) {
    const base = String(session.server).replace(/\/+$/, '').replace(/\/api\/v1$/i, '')
    httpClient.request({ url: base + '/api/v1/user/logout', method: 'GET', header: { 'x-token': session.token }, timeout: 5000 })
      .catch(() => { /* Local credentials are already removed, including when offline. */ })
  }
  return navigation
}

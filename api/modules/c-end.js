// C 端（宠物家长）接口封装。
//
// 与后台 B 端体系完全隔离：使用 C 端独立令牌（登录响应里的 token，落库键 access_token），
// 通过 x-token 头携带；服务地址统一读取 serverAddress。鉴权失效（HTTP 401）时清空令牌并回到
// C 端登录页，不复用后台 request.js 的跳转逻辑，避免误把家长送去 B 端登录页。
import httpClient from '@/api/client'

const C_PREFIX = '/api/v1/c'
const DEFAULT_SERVER = 'https://cloud.thingspanel.cn'
// 注册时默认带入的方案编码，与后端 model.SolutionCodePetMedical 保持一致。
export const PET_SOLUTION_CODE = 'pet_medical'

export function getServerAddress() {
  try {
    return String(uni.getStorageSync('serverAddress') || DEFAULT_SERVER).replace(/\/+$/, '')
  } catch (error) {
    console.warn('[c-end] 读取服务地址失败', error)
    return DEFAULT_SERVER
  }
}

export function saveServerAddress(server) {
  try { uni.setStorageSync('serverAddress', String(server || DEFAULT_SERVER).replace(/\/+$/, '')) } catch (error) { console.warn('[c-end] 写入服务地址失败', error) }
}

export function getCAccessToken() {
  try { return String(uni.getStorageSync('access_token') || '') } catch { return '' }
}

export function saveCAccessToken(token) {
  try { uni.setStorageSync('access_token', String(token || '')) } catch (error) { console.warn('[c-end] 写入令牌失败', error) }
}

export function clearCAccessToken() {
  try { uni.removeStorageSync('access_token') } catch { /* 存储不可用时忽略 */ }
}

export function isCLoggedIn() {
  return !!getCAccessToken()
}

let redirecting = false
function redirectToLogin() {
  if (redirecting) return
  redirecting = true
  clearCAccessToken()
  uni.reLaunch({ url: '/pages/c/login/index', complete() { redirecting = false } })
}

async function cRequest(path, data, method = 'GET', options = {}) {
  const auth = options.auth !== false
  const token = getCAccessToken()
  if (auth && !token) {
    redirectToLogin()
    throw new Error('请先登录')
  }
  let response
  try {
    response = await httpClient.request({
      url: `${getServerAddress()}${C_PREFIX}${path}`,
      method: method.toUpperCase(),
      data: data || {},
      header: token ? { 'x-token': token } : {}
    })
  } catch (error) {
    // client.js 在非 2xx 时以原始响应作为 rejection（含 statusCode 与 data）。
    const status = Number(error?.statusCode || 0)
    if (auth && status === 401) {
      redirectToLogin()
      throw new Error(error?.data?.message || '登录状态已过期，请重新登录')
    }
    throw new Error(error?.data?.message || error?.errMsg || '网络异常，请稍后重试')
  }
  const body = response?.data || {}
  if (Number(body.code) !== 200) throw new Error(body.message || '请求失败')
  return body.data
}

/** C 端注册（不返回令牌，注册后需再调用 cLogin 登录） */
export function cRegister({ phone, password, nickname, solutionCode } = {}) {
  return cRequest('/register', { phone, password, nickname: nickname || '', solution_code: solutionCode || PET_SOLUTION_CODE }, 'POST', { auth: false })
}

/** C 端登录，返回 { token, expires_in, user } */
export function cLogin({ phone, password } = {}) {
  return cRequest('/login', { phone, password }, 'POST', { auth: false })
}

/** C 端宠物列表（宠物档案 + 设备 + 门店） */
export function cListPets() {
  return cRequest('/pets', null, 'GET')
}

/** C 端已绑定设备列表 */
export function cListDevices() {
  return cRequest('/devices', null, 'GET')
}

/** C 端凭绑定码绑定设备 */
export function cBindDevice(code) {
  return cRequest('/devices/bind', { code }, 'POST')
}

/** C 端解绑设备 */
export function cUnbindDevice(deviceId) {
  return cRequest(`/devices/${encodeURIComponent(deviceId)}`, null, 'DELETE')
}

export function cGetProfile(deviceId) {
  return cRequest(`/pets/${encodeURIComponent(deviceId)}/profile`, null, 'GET')
}

export function cGetDailyReport(deviceId, date) {
  return cRequest(`/pets/${encodeURIComponent(deviceId)}/daily-report`, date ? { date } : null, 'GET')
}

export function cGetStaffNotes(deviceId) {
  return cRequest(`/pets/${encodeURIComponent(deviceId)}/staff-notes`, null, 'GET')
}

export function cGetTimeline(deviceId, limit) {
  return cRequest(`/pets/${encodeURIComponent(deviceId)}/timeline`, limit ? { limit } : null, 'GET')
}

export function cGetAlbum(deviceId, limit) {
  return cRequest(`/pets/${encodeURIComponent(deviceId)}/album`, limit ? { limit } : null, 'GET')
}

/** C 端实时音视频入会凭证 */
export function cGetRtcToken(deviceId) {
  return cRequest(`/pets/${encodeURIComponent(deviceId)}/rtc/token`, null, 'POST')
}

export default {
  PET_SOLUTION_CODE,
  getServerAddress,
  saveServerAddress,
  getCAccessToken,
  saveCAccessToken,
  clearCAccessToken,
  isCLoggedIn,
  cRegister,
  cLogin,
  cListPets,
  cListDevices,
  cBindDevice,
  cUnbindDevice,
  cGetProfile,
  cGetDailyReport,
  cGetStaffNotes,
  cGetTimeline,
  cGetAlbum,
  cGetRtcToken
}

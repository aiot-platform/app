// C 端（宠物家长）接口封装（微信小程序原生）。
//
// 与后台 B 端体系隔离：使用 C 端独立令牌（登录响应里的 token，存储键 access_token），通过 x-token 头携带；
// 服务地址读取 serverAddress。鉴权失效（HTTP 401）时清空令牌并回到 C 端登录页。
import { serverBase, accessToken } from './request.js'

const C_PREFIX = '/api/v1/c'
const DEFAULT_SERVER = 'https://cloud.thingspanel.cn'
// 注册默认带入的方案编码，与后端 model.SolutionCodePetMedical 一致。
export const PET_SOLUTION_CODE = 'pet_medical'

export function getServerAddress() {
  return serverBase()
}

export function saveServerAddress(server) {
  try {
    const value = String(server || DEFAULT_SERVER).trim() || DEFAULT_SERVER
    wx.setStorageSync('serverAddress', value)
  } catch (error) {
    console.warn('[c-end] 写入服务地址失败', error)
  }
}

export function saveCAccessToken(token) {
  try { wx.setStorageSync('access_token', String(token || '')) } catch (error) { console.warn('[c-end] 写入令牌失败', error) }
}

export function clearCAccessToken() {
  try { wx.removeStorageSync('access_token') } catch (error) { /* 存储不可用时忽略 */ }
}

export function isCLoggedIn() {
  return !!accessToken()
}

let redirecting = false
function redirectToLogin() {
  if (redirecting) return
  redirecting = true
  clearCAccessToken()
  wx.reLaunch({ url: '/pages/c/login/index', complete() { redirecting = false } })
}

function cRequest(path, data, method = 'GET', options = {}) {
  const auth = options.auth !== false
  const token = accessToken()
  if (auth && !token) {
    redirectToLogin()
    return Promise.reject(new Error('请先登录'))
  }
  const header = { 'content-type': 'application/json' }
  if (token) header['x-token'] = token
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${serverBase()}${C_PREFIX}${path}`,
      method: String(method || 'GET').toUpperCase(),
      data: data || {},
      header,
      success(res) {
        const body = res.data || {}
        if (auth && Number(res.statusCode) === 401) {
          redirectToLogin()
          reject(new Error(body.message || '登录状态已过期，请重新登录'))
          return
        }
        if (Number(body.code) !== 200) {
          reject(new Error(body.message || '请求失败'))
          return
        }
        resolve(body.data)
      },
      fail(error) {
        reject(new Error(error && error.errMsg ? error.errMsg : '网络请求失败'))
      }
    })
  })
}

/** C 端注册（不返回令牌，注册后需再调用 cLogin 登录） */
export function cRegister(payload = {}) {
  return cRequest('/register', {
    phone: payload.phone,
    password: payload.password,
    nickname: payload.nickname || '',
    solution_code: payload.solutionCode || PET_SOLUTION_CODE
  }, 'POST', { auth: false })
}

/** C 端登录，返回 { token, expires_in, user } */
export function cLogin(payload = {}) {
  return cRequest('/login', { phone: payload.phone, password: payload.password }, 'POST', { auth: false })
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

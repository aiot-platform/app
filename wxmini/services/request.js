// 后端请求封装：与 uni-app 侧 requestDeviceApi 保持同一约定。
// 登录态读取 access_token / serverAddress；服务器地址允许带 /api/v1 后缀。
const DEFAULT_SERVER = 'https://cloud.thingspanel.cn'

export function serverBase() {
  return String(wx.getStorageSync('serverAddress') || DEFAULT_SERVER)
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/i, '')
}

export function wsBase() {
  return serverBase().replace(/^http/i, 'ws')
}

export function accessToken() {
  return wx.getStorageSync('access_token') || ''
}

/**
 * @param {string} path 形如 device/detail/xxx（无需前置 /api/v1）
 * @param {Object} data 请求体 / 查询参数
 * @param {string} method GET | POST | PUT
 */
export function request(path, data, method = 'GET') {
  const token = accessToken()
  const header = { 'content-type': 'application/json' }
  if (token) header['x-token'] = token
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${serverBase()}/api/v1/${String(path).replace(/^\/+/, '')}`,
      method: String(method || 'GET').toUpperCase(),
      data: data || {},
      header,
      success(res) {
        const body = res.data
        if (!body || body.code !== 200) {
          reject(new Error((body && (body.message || body.msg)) || `请求失败（${res.statusCode}）`))
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

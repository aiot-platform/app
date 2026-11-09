import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
function mini(source) {
  const enabled = [true]
  return source.split(/\r?\n/).filter(line => {
    const match = line.match(/\/\/\s*#(ifdef|ifndef|endif)\s*(.*)/)
    if (!match) return enabled.at(-1)
    if (match[1] === 'endif') enabled.pop()
    else enabled.push(enabled.at(-1) && (match[1] === 'ifdef' ? match[2].trim() === 'MP-WEIXIN' : match[2].trim() !== 'MP-WEIXIN'))
    return false
  }).join('\n')
}
let values, route, calls, requestImpl, pendingNavigation, rejectNavigation
const uni = {
  getStorageSync: key => values[key],
  removeStorageSync: key => delete values[key],
  reLaunch(options) { calls.push(['reLaunch', options.url]); pendingNavigation = options; if (rejectNavigation) options.fail(); },
  redirectTo(options) { calls.push(['redirectTo', options.url]); route = 'pages/login/index'; options.success() },
  showToast() {},
  showModal() { throw Error('mini auth must not wait for a modal') }
}
const scope = { uni, getCurrentPages: () => [{ route }], httpClient: { request: options => requestImpl(options) } }
const context = vm.createContext(scope)
vm.runInContext(read('features/auth/session.js').replaceAll('export ', ''), context)
const authNames = ['miniSessionSnapshot', 'isCurrentMiniSession', 'isPublicMiniApi', 'requireMiniSession', 'expireMiniSession', 'logoutMiniSession', 'openMiniLogin']
const auth = vm.runInContext(read('features/auth/mini-session.js').replace(/^import .*$/gm, '').replaceAll('export ', '') + '; ({' + authNames.join(',') + '})', context)
const api = vm.runInContext(mini(read('api/request.js')).replace(/^import .*$/gm, '').replace('export async function', 'async function').replace('export default { apiRequest }', 'apiRequest'), context)
function reset() {
  values = { access_token: 'old', userWxInfo: { id: 'old-user' }, isAuth: true, push_id: 'push', push_binding: {}, ywId: 'old', email: 'test@example.test', serverAddress: 'https://example.test', language: 'zh-CN' }
  route = 'pages/account/index'; calls = []; pendingNavigation = null; rejectNavigation = false
}
async function finishNavigation() {
  route = 'pages/login/index'; pendingNavigation?.success()
  await auth.openMiniLogin()
}
reset()
let finishLogout
requestImpl = options => {
  assert.equal(options.url, 'https://example.test/api/v1/user/logout')
  assert.equal(options.header['x-token'], 'old')
  return new Promise(resolve => { finishLogout = resolve })
}
const logout = auth.logoutMiniSession()
assert.equal(values.access_token, undefined, 'local logout must not wait for the server')
assert.equal(values.userWxInfo, undefined)
assert.equal(values.push_binding, undefined)
assert.equal(values.ywId, undefined)
assert.equal(values.email, 'test@example.test')
assert.equal(values.serverAddress, 'https://example.test')
assert.equal(values.language, 'zh-CN')
assert.deepEqual(calls, [['reLaunch', '/pages/login/index']])
await finishNavigation(); await logout
values.access_token = 'new'
finishLogout({ statusCode: 401 }); await Promise.resolve()
assert.equal(values.access_token, 'new', 'late logout response cannot destroy a new login')

reset(); requestImpl = async () => { throw Error('offline') }; rejectNavigation = true
await auth.logoutMiniSession()
assert.deepEqual(calls.map(c => c[0]), ['reLaunch', 'redirectTo'])
assert.equal(values.access_token, undefined)

for (const response of [{ statusCode: 401 }, { statusCode: 401, data: { message: 'expired' } }, { statusCode: 200, data: { code: 40102 } }]) {
  reset()
  requestImpl = async () => { if (response.statusCode === 401) throw response; return response }
  await api('/api/v1/device').catch(() => {})
  assert.equal(values.access_token, undefined)
  assert.equal(calls.length, 1)
  await finishNavigation()
}
reset(); let late
requestImpl = () => new Promise(resolve => { late = resolve })
const oldRequest = api('/api/v1/device')
values.access_token = 'new'
late({ data: { code: 401 } })
await assert.rejects(oldRequest, /登录状态已变更/)
assert.equal(values.access_token, 'new'); assert.equal(calls.length, 0)

reset(); values.access_token = ''
requestImpl = () => { throw Error('unauthenticated request was sent') }
assert.equal(auth.requireMiniSession('pages/dashboard/index'), false)
assert.equal(auth.requireMiniSession('pages/account/index'), false)
await assert.rejects(api('/api/v1/device'), /请先登录/)
assert.equal(calls.length, 1, 'concurrent expired requests share one navigation')
await finishNavigation()
assert.equal(auth.requireMiniSession('pages/login/index'), true)
assert.equal(auth.requireMiniSession('pages/login/register'), true)
assert.equal(auth.requireMiniSession('pages/web-view/legal'), true)
requestImpl = async () => ({ data: { code: 401, message: 'bad password' } })
assert.equal((await api('/api/v1/login')).code, 401)
assert.equal(calls.length, 1, 'login failure does not redirect recursively')

reset(); requestImpl = async () => ({ data: { code: 403 } })
await api('/api/v1/device')
assert.equal(values.access_token, 'old'); assert.equal(calls.length, 0)
console.log('PASS: immediate/offline logout, absolute navigation/fallback, HTTP and business expiry, stale responses, missing-session guards, public pages and login failures.')

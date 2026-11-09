import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { withMiniAlarmCompatibility } from '../services/mini-alarm-compat.js'
import { loadMiniDeviceOverview } from '../services/mini-device-overview.js'
import { readAlarmDeviceCount, scopedAlarmRequest } from '../services/alarm-reading.js'

const device = () => ({ code: 200, data: { device_total: 7, device_on: 2, device_offline: 5 } })
let finishAlarm, deviceValue, alarmValue
const pending = loadMiniDeviceOverview({ device, alarm: () => new Promise(resolve => { finishAlarm = resolve }), onDevice: v => { deviceValue = v }, onAlarm: v => { alarmValue = v } })
await new Promise(resolve => setImmediate(resolve))
assert.deepEqual(deviceValue, { total: 7, online: 2, offline: 5 })
assert.equal(alarmValue, undefined)
finishAlarm({ code: 500 })
await pending
assert.equal(alarmValue, null)
assert.equal(deviceValue.online, 2)
await loadMiniDeviceOverview({ device: () => { throw Error('offline') }, alarm: () => ({ code: 200, data: { alarm_device_total: 0 } }), onDevice: v => { deviceValue = v }, onAlarm: v => { alarmValue = v } })
assert.equal(deviceValue, null)
assert.equal(alarmValue, 0)

const calls = []
const old = withMiniAlarmCompatibility(async path => {
  calls.push(path)
  if (path.endsWith('/runtime')) throw { statusCode: 404 }
  return { code: 200, data: { alarm_device_total: 11 } }
})
assert.equal((await readAlarmDeviceCount(old)).data.alarm_device_total, 11)
assert.deepEqual(calls, ['/api/v1/automation/runtime', '/api/v1/alarm/device/counts'])
for (const statusCode of [401, 403, 500, 503]) {
  let count = 0
  await assert.rejects(readAlarmDeviceCount(withMiniAlarmCompatibility(async () => { count++; throw { statusCode } })))
  assert.equal(count, 1)
}
let legacy = false
await assert.rejects(readAlarmDeviceCount(withMiniAlarmCompatibility(async path => {
  if (path.endsWith('/runtime')) return { code: 200, data: { mode: 'native' } }
  if (path.startsWith('/api/v1/alarm')) legacy = true
  throw { statusCode: 404 }
})))
assert.equal(legacy, false)
let scope = 'a'
const guarded = scopedAlarmRequest(withMiniAlarmCompatibility(async () => { scope = 'b'; throw { statusCode: 404 } }), () => scope)
await assert.rejects(readAlarmDeviceCount(guarded), /已切换/)

function preprocess(source, platform) {
  const stack = [true]
  return source.split(/\r?\n/).filter(line => {
    const directive = line.match(/\/\/\s*#(ifdef|ifndef|endif)\s*(.*)$/)
    if (!directive) return stack.at(-1)
    if (directive[1] === 'endif') { stack.pop(); return false }
    stack.push(stack.at(-1) && (directive[1] === 'ifdef' ? directive[2].trim() === platform : directive[2].trim() !== platform))
    return false
  }).join('\n')
}
for (const platform of ['APP-PLUS', 'H5']) {
  const before = execFileSync('git', ['show', 'HEAD:api/modules/alarm.js'], { encoding: 'utf8' })
  assert.equal(preprocess(fs.readFileSync('api/modules/alarm.js', 'utf8'), platform), preprocess(before, platform))
  const page = preprocess(fs.readFileSync('pages/devices/index.vue', 'utf8'), platform)
  assert.ok(!page.includes('loadMiniDeviceOverview'))
  assert.match(page, /deviceStatsState\(\)\s*{\s*return this.overviewState\s*}/)
  assert.match(page, /alarmStatsState\(\)\s*{\s*return this.overviewState\s*}/)
  const previous = preprocess(execFileSync('git', ['show', 'HEAD:pages/devices/index.vue'], { encoding: 'utf8' }), platform)
  const method = s => s.slice(s.indexOf('\t\tgetOverviewStats() {'), s.indexOf('\t\tgetFilteredDeviceStats() {')).replace(/\s+/g, '')
  assert.equal(method(page), method(previous))
}
console.log('PASS independent cards, zero/error handling, old server compatibility, native failure isolation, account switching, App/H5 unchanged request logic')

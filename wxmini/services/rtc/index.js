// 实时音视频适配层入口（小程序端）。
// demo 模式由页面直接使用 createDemoRtcSession，这里只负责真实链路：阿里云小程序 RTC SDK。
import { createWxSession, unsupportedSession } from './rtc-wx.js'

export { fetchRtcAuth } from './token.js'

export function createRtcSession({ page, AliRtcEngine, onState, onRemote }) {
  if (!AliRtcEngine) return unsupportedSession()
  return createWxSession({ page, AliRtcEngine, onState, onRemote })
}

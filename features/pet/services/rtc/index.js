// 实时音视频适配层入口（PRD 4.1 播放器 / 4.7 对讲）。
// H5：阿里云 ARTC Web SDK 本地渲染（rtc-h5.js）。
// Android / iOS：默认 web-view 内嵌同一套 H5 页面，或绑定原生插件后走原生管线（rtc-app.js）。
// 小程序：不支持，返回 unsupported，由页面给出降级文案。
// #ifdef H5
import { createH5Session } from './rtc-h5.js'
// #endif
// #ifdef APP-PLUS
import { createAppSession, buildEmbedPlayerUrl } from './rtc-app.js'
// #endif

export function createRtcSession({ deviceId, containerId, token, onState, onRemote }) {
  // #ifdef H5
  return createH5Session({ containerId, onState, onRemote })
  // #endif
  // #ifdef APP-PLUS
  logUnused(token)
  return createAppSession({ deviceId, onState })
  // #endif
  // #ifndef H5
  // #ifndef APP-PLUS
  logUnused(token)
  return {
    mode: 'unsupported',
    needsWebview: false,
    supported: false,
    async join() { throw new Error('当前运行环境不支持实时音视频') },
    async leave() {},
    setMuted() {},
    async startTalk() {},
    async stopTalk() {}
  }
  // #endif
  // #endif
}

/** App 端内嵌播放地址；其他端返回空串。 */
export function buildEmbedUrl({ deviceId, token }) {
  // #ifdef APP-PLUS
  return buildEmbedPlayerUrl({ deviceId, token })
  // #endif
  // #ifndef APP-PLUS
  logUnused(deviceId, token)
  return ''
  // #endif
}

// 条件编译会裁掉未用到的参数，保留一个空实现避免 eslint 类告警。
function logUnused() {}

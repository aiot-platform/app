// H5 端实时音视频：阿里云 ARTC Web SDK。
// 观看端为主（订阅远端画面与声音），对讲时再推本地麦克风。
// 兼容两种 SDK 形态：新版 dingrtc（DingRTC.createClient）与旧版 aliyun-rtc-sdk（AliRtcEngine），
// 控制台产品不同时下载到的 SDK 会不一样，这里按全局对象自动选择。
const DEFAULT_SDK_URL = 'https://g.alicdn.com/apsara-media-box/imp-web-rtc/7.3.4/aliyun-rtc-sdk.js'

let scriptLoading = null

function loadScript(url) {
  if (scriptLoading) return scriptLoading
  scriptLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => { scriptLoading = null; reject(new Error('实时音视频 SDK 加载失败')) }
    document.head.appendChild(script)
  })
  return scriptLoading
}

const call = (target, name, ...args) => (typeof target?.[name] === 'function' ? target[name](...args) : undefined)

export function createH5Session({ containerId, onState, onRemote }) {
  let client = null
  let flavor = ''
  let muted = false
  let talking = false

  async function ensureSdk() {
    if (window.DingRTC || window.AliRtcEngine) return
    // 允许部署方覆盖 SDK 地址（例如换成自建 CDN 或指定版本）。
    await loadScript(window.__petRtcSdkUrl || DEFAULT_SDK_URL)
  }

  async function joinWithDingRtc(auth) {
    const engine = window.DingRTC.default || window.DingRTC
    client = engine.createClient()
    client.on('user-published', async (user, mediaType) => {
      await call(client, 'subscribe', user, mediaType)
      if (mediaType === 'video') {
        call(user.videoTrack, 'play', containerId)
        onRemote?.(user)
      }
      if (mediaType === 'audio') call(user.audioTrack, 'play')
    })
    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video') call(user.videoTrack, 'stop')
    })
    client.on('connection-state-changed', state => onState?.({ status: 'live', state }))
    await client.join({ appId: auth.appId, channel: auth.channelId, token: auth.token, userId: auth.userId, userName: auth.userName })
  }

  async function joinWithEngine(auth) {
    client = window.AliRtcEngine.getInstance()
    client.on('remoteUserOnLineNotify', userId => {
      // 观看端订阅远端视频：不同小版本参数名有差异，全部做成可选调用。
      call(client, 'subscribeRemoteVideoStream', userId, true)
      call(client, 'setRemoteViewConfig', containerId, userId, 0)
      onRemote?.({ userId })
    })
    client.on('remoteUserOffLineNotify', () => {})
    client.on('bye', code => onState?.({ status: 'ended', code }))
    await client.joinChannel({ userId: auth.userId, channelId: auth.channelId, token: auth.token }, auth.userName || '')
  }

  return {
    mode: 'h5',
    needsWebview: false,
    supported: true,
    async join(auth) {
      await ensureSdk()
      if (window.DingRTC) { flavor = 'dingrtc'; await joinWithDingRtc(auth) }
      else if (window.AliRtcEngine) { flavor = 'aliengine'; await joinWithEngine(auth) }
      else throw new Error('实时音视频 SDK 不可用')
    },
    setMuted(value) {
      muted = value
      if (flavor === 'dingrtc') {
        const users = client?.remoteUsers || []
        users.forEach(user => call(user.audioTrack, value ? 'stop' : 'play'))
      } else if (flavor === 'aliengine') {
        call(client, 'muteAllRemoteAudio', value)
      }
    },
    async startTalk() {
      if (talking) return
      if (flavor === 'dingrtc') {
        const engine = window.DingRTC.default || window.DingRTC
        const track = await engine.createMicrophoneAudioTrack?.()
        if (track) { await call(client, 'publish', track); talking = true }
      } else if (flavor === 'aliengine') {
        call(client, 'publishLocalAudioStream', true, true)
        talking = true
      }
    },
    async stopTalk() {
      if (!talking) return
      if (flavor === 'aliengine') call(client, 'publishLocalAudioStream', false, true)
      talking = false
    },
    async leave() {
      try {
        if (flavor === 'dingrtc') await call(client, 'leave')
        else if (flavor === 'aliengine') { call(client, 'leaveChannel'); call(client, 'destroy') }
      } catch (error) {
        console.warn('[pet] 退出实时频道失败', error)
      }
      client = null
      flavor = ''
      talking = false
      muted = false
    }
  }
}

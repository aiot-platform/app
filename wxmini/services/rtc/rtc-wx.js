// 微信小程序端实时音视频：阿里云小程序 RTC SDK（aliyun-rtc-wx-sdk）。
//
// 前置条件（缺一不可，工具里无法真机预览）：
//   1. 小程序为企业主体，且已开通「实时播放音视频流 / 实时录制音视频流」接口权限；
//   2. 后台配置 live-pusher / live-player 对应类目（IT科技-音视频设备 或 智能家居-控制摄像头）；
//   3. 配置 request 合法域名（后端）与 socket 合法域名（如使用信令）；
//   4. 微信开发者工具不支持 live-pusher/live-player，必须真机调试，且测试号不可用。
//
// 启用步骤（三步）：
//   1) 在项目根执行：npm i aliyun-rtc-wx-sdk
//   2) 开发者工具「工具 > 构建 npm」
//   3) 打开 app.js 中 require('aliyun-rtc-wx-sdk') 的注释，SDK 会写入 globalData.AliRtcEngine
//      （也可改用 DingRTC 小程序 SDK 的 UMD 文件，放到 libs/ 后 require 相对路径，同样注入 AliRtcEngine）
//
// SDK 依赖页面 data 中的以下字段来承载原生组件，调用方（页面）必须声明：
//   pusher: { url: '' }        // 本地推流（对讲时才有 url）
//   playerList: []             // 远端播放列表，元素形如 { userId, url }
export function createWxSession({ page, AliRtcEngine, onState, onRemote }) {
  if (!AliRtcEngine) return unsupportedSession()
  let engine = null
  let muted = false
  let talking = false
  const call = (target, name, ...args) => (target && typeof target[name] === 'function' ? target[name](...args) : undefined)

  return {
    mode: 'wx',
    supported: true,
    async join(auth) {
      // SDK 需要页面实例来绑定 live-pusher / live-player，首次入会时创建引擎并挂载事件。
      engine = typeof AliRtcEngine.getInstance === 'function' ? AliRtcEngine.getInstance(page) : new AliRtcEngine(page)
      engine.on && engine.on('remoteUserOnLineNotify', userId => {
        // 观看端自动订阅远端音视频；不同小版本回调参数略有差异，全部做成可选调用。
        call(engine, 'subscribeRemoteVideoStream', userId, true)
        onRemote && onRemote({ userId })
        syncPlayers()
      })
      engine.on && engine.on('remoteUserOffLineNotify', () => syncPlayers())
      engine.on && engine.on('remoteTrackAvailableNotify', () => syncPlayers())
      engine.on && engine.on('bye', code => onState && onState({ status: 'ended', code }))
      await call(engine, 'joinChannel', auth.token, auth.userName || '')
      onState && onState({ status: 'live' })
    },
    setMuted(value) {
      muted = value
      call(engine, 'muteAllRemoteAudio', value)
    },
    async startTalk() {
      if (talking) return
      call(engine, 'publishLocalAudioStream', true, true)
      call(engine, 'muteLocalAudioStream', false)
      talking = true
    },
    async stopTalk() {
      if (!talking) return
      call(engine, 'publishLocalAudioStream', false, true)
      talking = false
    },
    async leave() {
      try {
        call(engine, 'leaveChannel')
        call(engine, 'destroy')
      } catch (error) {
        console.warn('[pet] 退出实时频道失败', error)
      }
      engine = null
      talking = false
      muted = false
    }
  }

  // 远端人数变化时，优先使用 SDK 维护的播放列表；缺失时由页面按占位处理。
  function syncPlayers() {
    if (!onRemote) return
    const users = engine && (engine.getRemoteUsers ? engine.getRemoteUsers() : engine.remoteUsers)
    if (Array.isArray(users)) onRemote({ users })
  }
}

/** SDK 未注入时的降级会话：页面会展示「需配置实时音视频」的提示，不影响其他功能。 */
export function unsupportedSession() {
  return {
    mode: 'unsupported',
    supported: false,
    async join() { throw new Error('未配置实时音视频 SDK') },
    async leave() {},
    setMuted() {},
    async startTalk() {},
    async stopTalk() {}
  }
}

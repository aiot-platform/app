// 图标：把原型里的内联 SVG 路径编译成小程序可用的 data-uri 图片。
// 小程序 <image> 无法继承 CSS 颜色，因此按「图标 + 颜色」预生成变体，颜色对齐原型 :root 变量。
const PATHS = {
  cam: '<path d="M15 10l5-3v10l-5-3z"/><rect x="3" y="6" width="12" height="12" rx="2"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  vol: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>',
  mute: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  snap: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  exit: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  live: '<path d="M15 10l5-3v10l-5-3z"/><rect x="3" y="6" width="12" height="12" rx="2"/>',
  feed: '<path d="M4 6h16M6 6l1 13h10l1-13"/><path d="M9 11h6"/>',
  album: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  off: '<path d="M2 2l20 20"/><path d="M15 10l5-3v10M3 6h9a3 3 0 013 3v5M3 6v11a2 2 0 002 2h8"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bone: '<path d="M7 9a2.5 2.5 0 11-1.5-4.2A2.5 2.5 0 0110 4.5L14 9l-1 1 4 4a2.5 2.5 0 114 1.5A2.5 2.5 0 1118 21.5L14 17l1-1-4-4"/>',
  bell: '<path d="M6 17V11a6 6 0 1112 0v6l2 2H4z"/><path d="M10 21h4"/>',
  temp: '<path d="M14 14.8V5a2 2 0 10-4 0v9.8a4 4 0 104 0z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
  sleep: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
  rest: '<path d="M3 17c0-3 2-5 5-5h8c3 0 5 2 5 5M7 12V9a2 2 0 014 0v3"/>',
  run: '<circle cx="14" cy="4.5" r="1.8"/><path d="M6 20l3-5 3 2 2-5-3-2-3 1M14 12l3 3 3-1"/>',
  eat: '<path d="M5 12h14a7 7 0 01-14 0zM9 5v4M12 4v5M15 5v4"/>',
  water: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
  none: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  unk: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17h.01"/>'
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// 仅处理 ASCII 字符（图标路径与犬脸 SVG 均为 ASCII，无需 UTF-8 编码）。
function base64(input) {
  let output = ''
  for (let index = 0; index < input.length; index += 3) {
    const a = input.charCodeAt(index)
    const b = input.charCodeAt(index + 1)
    const c = input.charCodeAt(index + 2)
    const e1 = a >> 2
    const e2 = ((a & 3) << 4) | (Number.isNaN(b) ? 0 : b >> 4)
    const e3 = Number.isNaN(b) ? 64 : ((b & 15) << 2) | (Number.isNaN(c) ? 0 : c >> 6)
    const e4 = Number.isNaN(c) ? 64 : c & 63
    output += B64[e1] + B64[e2] + (e3 === 64 ? '=' : B64[e3]) + (e4 === 64 ? '=' : B64[e4])
  }
  return output
}

function stroke(paths, color) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + color +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>'
  return 'data:image/svg+xml;base64,' + base64(svg)
}

const DOG_FACE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">' +
  '<ellipse cx="9" cy="22" rx="6.5" ry="12" fill="#c98f3c" transform="rotate(12 9 22)"/>' +
  '<ellipse cx="39" cy="22" rx="6.5" ry="12" fill="#c98f3c" transform="rotate(-12 39 22)"/>' +
  '<circle cx="24" cy="25" r="15" fill="#f0bd68"/>' +
  '<ellipse cx="24" cy="31" rx="8" ry="6" fill="#fbe3b5"/>' +
  '<circle cx="18" cy="23" r="2.2" fill="#3a2f2a"/>' +
  '<circle cx="30" cy="23" r="2.2" fill="#3a2f2a"/>' +
  '<ellipse cx="24" cy="28.5" rx="3" ry="2.2" fill="#3a2f2a"/>' +
  '<path d="M21 33q3 3 6 0" stroke="#3a2f2a" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>'

const WHITE = '#ffffff'
const DEEP = '#f0691f'
const SUB = '#a39690'
const INK = '#3a2f2a'
const DANGER = '#f15f5f'
const WARN = '#d9741f'
const INFO = '#2f72d6'
const BLUE = '#4f9bff'
const PURPLE = '#7d6bff'
const GREEN = '#25b283'
const GOLD = '#e2a21c'
const SKY = '#3b8ef0'

// 面板用到的全部图标变体（键名语义化，供 WXML 直接绑定）。
export const ICON = {
  dog: 'data:image/svg+xml;base64,' + base64(DOG_FACE),

  back: stroke(PATHS.back, INK),
  dots: stroke(PATHS.more, INK),

  tabLive: stroke(PATHS.live, SUB),
  tabLiveOn: stroke(PATHS.live, DEEP),
  tabFeed: stroke(PATHS.feed, SUB),
  tabFeedOn: stroke(PATHS.feed, DEEP),
  tabAlbum: stroke(PATHS.album, SUB),
  tabAlbumOn: stroke(PATHS.album, DEEP),
  tabMore: stroke(PATHS.more, SUB),
  tabMoreOn: stroke(PATHS.more, DEEP),

  alertDanger: stroke(PATHS.warn, DANGER),
  alertWarn: stroke(PATHS.warn, WARN),
  alertInfo: stroke(PATHS.bell, INFO),
  closeDanger: stroke(PATHS.x, DANGER),
  closeWarn: stroke(PATHS.x, WARN),
  closeInfo: stroke(PATHS.x, INFO),

  posterOff: stroke(PATHS.off, WHITE),
  posterMoon: stroke(PATHS.moon, WHITE),
  posterWarn: stroke(PATHS.warn, WHITE),
  posterCam: stroke(PATHS.cam, WHITE),
  playDeep: stroke(PATHS.play, DEEP),
  playSoft: stroke(PATHS.play, WHITE),

  barVol: stroke(PATHS.vol, WHITE),
  barMute: stroke(PATHS.mute, WHITE),
  barMic: stroke(PATHS.mic, WHITE),
  barFull: stroke(PATHS.full, WHITE),
  barExit: stroke(PATHS.exit, WHITE),
  barStop: stroke(PATHS.stop, WHITE),

  moodNone: stroke(PATHS.none, SUB),
  moodRest: stroke(PATHS.rest, BLUE),
  moodSleep: stroke(PATHS.sleep, PURPLE),
  moodRun: stroke(PATHS.run, GREEN),
  moodEat: stroke(PATHS.eat, GOLD),
  moodWater: stroke(PATHS.water, SKY),
  unk: stroke(PATHS.unk, SUB),

  quickSnap: stroke(PATHS.snap, DEEP),
  quickBone: stroke(PATHS.bone, '#d89a10'),
  quickMic: stroke(PATHS.mic, GREEN),

  chev: stroke(PATHS.chev, SUB),
  close: stroke(PATHS.close, INK),
  minus: stroke(PATHS.minus, INK),
  plus: stroke(PATHS.plus, INK),
  temp: stroke(PATHS.temp, SUB),
  drop: stroke(PATHS.drop, SUB)
}

// 播放器封面上的爪印底纹（原型 .poster .paws）。
export const PAWS = (() => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice"><g fill="#ffffff">' +
    '<circle cx="30" cy="30" r="6"/><circle cx="45" cy="22" r="5"/><circle cx="60" cy="30" r="6"/><ellipse cx="45" cy="45" rx="12" ry="9"/>' +
    '<g transform="translate(110 60) rotate(20)"><circle cx="30" cy="30" r="6"/><circle cx="45" cy="22" r="5"/><circle cx="60" cy="30" r="6"/><ellipse cx="45" cy="45" rx="12" ry="9"/></g>' +
    '</g></svg>'
  return 'data:image/svg+xml;base64,' + base64(svg)
})()

/** 活跃度圆环：按百分比生成内联 SVG（避免新增静态资源）。 */
export function ringSource(percent, color = '#ff8a4c') {
  const value = Math.max(0, Math.min(100, Number(percent) || 0))
  const radius = 22
  const circumference = 138.2
  const dash = (circumference * value) / 100
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">' +
    '<circle cx="30" cy="30" r="22" fill="none" stroke="#f6ece6" stroke-width="7"/>' +
    '<circle cx="30" cy="30" r="22" fill="none" stroke="' + color + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + circumference + '" transform="rotate(-90 30 30)"/>' +
    '</svg>'
  return 'data:image/svg+xml;base64,' + base64(svg)
}

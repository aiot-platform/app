// 能力探测：把平台设备模型（telemetry/attribute/event/command）与 PRD 物模型对齐，
// 产出「哪些属性/服务/事件存在」，供 UI 做字段缺失降级与级联隐藏（PRD 3.2、4.8、4.9、4.12）。
import { PROPERTIES, PROPERTY_BY_CODE, SERVICES, EVENTS, MORE_GROUPS, REQUIRED_CODES, REQUIRED_SERVICES } from './tsl.js'

/**
 * @param {Array} fields 平台设备模型字段：{ id, name, type, dataType(telemetry|attribute|event|command) }
 * @param {Object} values 当前回报值（用于模型缺失时按回报判断字段是否存在）
 * @param {Object} models 各类型模型原始行，用于读取被裁剪后的枚举选项
 */
export function buildCapabilities(fields = [], values = {}, models = {}) {
  const model = new Map()
  for (const field of fields) if (field?.id) model.set(field.id, field)
  const hasModel = model.size > 0

  // 平台模型里的枚举选项（specs / data_specs 可能是 JSON 字符串），用于「枚举裁剪」降级。
  const rawByCode = new Map()
  Object.values(models || {}).flat().forEach(row => {
    const id = row?.key || row?.data_identifier || row?.identifier || row?.id
    if (typeof id === 'string' && id) rawByCode.set(id, row)
  })
  const enumCache = new Map()
  function enumValues(code) {
    if (enumCache.has(code)) return enumCache.get(code)
    const fallback = PROPERTY_BY_CODE[code]?.values || []
    let values = fallback
    const raw = rawByCode.get(code)?.specs ?? rawByCode.get(code)?.data_specs ?? rawByCode.get(code)?.define
    if (raw) {
      let specs = raw
      if (typeof specs === 'string') {
        try { specs = JSON.parse(specs) } catch { specs = null }
      }
      if (specs && typeof specs === 'object' && !Array.isArray(specs)) {
        const keys = Object.keys(specs).filter(key => /^-?\d+$/.test(key))
        if (keys.length) values = keys.map(Number).sort((a, b) => a - b)
      }
    }
    enumCache.set(code, values)
    return values
  }

  // 模型不可用时：必选能力强制存在，其余靠当前回报值判断；避免整块 UI 被误隐藏。
  const propertyExists = code => hasModel ? model.has(code) : (REQUIRED_CODES.includes(code) || values[code] !== undefined)
  const serviceExists = code => hasModel ? model.has(code) : REQUIRED_SERVICES.includes(code)
  const eventExists = code => hasModel ? model.has(code) : false

  // 同一属性在不同部署里可能落在遥测或属性表里，写入类型以模型为准，否则用默认约定。
  const writeKind = code => {
    const kind = model.get(code)?.dataType
    return kind === 'attribute' || kind === 'telemetry' || kind === 'command' ? kind : ''
  }

  const properties = PROPERTIES.filter(item => propertyExists(item.code))
  const services = SERVICES.filter(item => serviceExists(item.code))
  const events = EVENTS.filter(item => eventExists(item.code))
  const groups = Object.fromEntries(Object.entries(MORE_GROUPS)
    .map(([name, codes]) => [name, codes.filter(propertyExists)]))

  return {
    hasModel,
    properties,
    services,
    events,
    groups,
    hasProperty: propertyExists,
    hasService: serviceExists,
    hasEvent: eventExists,
    writeKind,
    enumValues,
    // 相册 Tab 依赖抓拍服务（PRD 4.5）；更多 Tab 三个分组全空时隐藏（PRD 3.2）。
    hasAlbum: serviceExists('snapshot'),
    hasMore: Object.values(groups).some(codes => codes.length > 0)
  }
}

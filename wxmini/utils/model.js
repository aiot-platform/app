// 能力探测：把平台设备模型（telemetry/attribute/event/command）与物模型对齐，
// 产出「哪些属性/服务存在」，供 UI 做字段缺失降级与级联隐藏（PRD 3.2、4.8、4.9、4.12）。
import { PROPERTIES, PROPERTY_BY_CODE, SERVICES, MORE_GROUPS, REQUIRED_CODES, REQUIRED_SERVICES } from './tsl.js'

/**
 * @param {Array} fields 平台设备模型字段：{ id, name, type, dataType(telemetry|attribute|event|command) }
 * @param {Object} values 当前回报值（模型缺失时按回报判断字段是否存在）
 * @param {Object} models 各类型模型原始行，用于读取被裁剪后的枚举选项
 */
export function buildCapabilities(fields = [], values = {}, models = {}) {
  const model = new Map()
  fields.forEach(field => { if (field && field.id) model.set(field.id, field) })
  const hasModel = model.size > 0

  const rawByCode = new Map()
  Object.values(models || {}).flat().forEach(row => {
    const id = row && (row.key || row.data_identifier || row.identifier || row.id)
    if (typeof id === 'string' && id) rawByCode.set(id, row)
  })
  const enumCache = new Map()
  function enumValues(code) {
    if (enumCache.has(code)) return enumCache.get(code)
    const fallback = (PROPERTY_BY_CODE[code] && PROPERTY_BY_CODE[code].values) || []
    let values2 = fallback
    const rawRow = rawByCode.get(code) || {}
    let specs = rawRow.specs !== undefined ? rawRow.specs : rawRow.data_specs !== undefined ? rawRow.data_specs : rawRow.define
    if (specs) {
      if (typeof specs === 'string') {
        try { specs = JSON.parse(specs) } catch (error) { specs = null }
      }
      if (specs && typeof specs === 'object' && !Array.isArray(specs)) {
        const keys = Object.keys(specs).filter(key => /^-?\d+$/.test(key))
        if (keys.length) values2 = keys.map(Number).sort((a, b) => a - b)
      }
    }
    enumCache.set(code, values2)
    return values2
  }

  const propertyExists = code => hasModel ? model.has(code) : (REQUIRED_CODES.indexOf(code) >= 0 || values[code] !== undefined)
  const serviceExists = code => hasModel ? model.has(code) : REQUIRED_SERVICES.indexOf(code) >= 0

  const groups = {}
  Object.keys(MORE_GROUPS).forEach(name => { groups[name] = MORE_GROUPS[name].filter(propertyExists) })

  return {
    hasModel,
    properties: PROPERTIES.filter(item => propertyExists(item.code)),
    services: SERVICES.filter(item => serviceExists(item.code)),
    groups,
    hasProperty: propertyExists,
    hasService: serviceExists,
    enumValues,
    hasAlbum: serviceExists('snapshot'),
    hasMore: Object.keys(groups).some(name => groups[name].length > 0)
  }
}

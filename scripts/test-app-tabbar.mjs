import assert from 'node:assert/strict'
import fs from 'node:fs'

const pages = JSON.parse(fs.readFileSync(new URL('../pages.json', import.meta.url), 'utf8'))
const source = fs.readFileSync(new URL('../components/app-tabbar.vue', import.meta.url), 'utf8')
const { TAB_BAR_ITEMS } = await import(new URL('../utils/tab-bar-items.js', import.meta.url))
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace("import pages from '@/pages.json'", '')
  .replace("import { TAB_BAR_ITEMS } from '@/utils/tab-bar-items'", '')
  .replace('export default', 'return')
const calls = []
const component = new Function('pages', 'TAB_BAR_ITEMS', 'uni', script)(pages, TAB_BAR_ITEMS, {
  switchTab: options => calls.push(options), showToast: () => {}
})
const keyOf = item => TAB_BAR_ITEMS.find(tab => tab.pagePath === item.pagePath)?.key
assert.equal(component.data().config, pages.tabBar)
for (const item of pages.tabBar.list) {
  component.methods.open(item)
  assert.equal(calls.at(-1).url, '/' + item.pagePath)
  // pages.json 只带 %占位符% 文案，组件必须按 pagePath 从 tab-bar-items 取语言包 key
  assert.ok(keyOf(item), `tab-bar-items 缺少 ${item.pagePath}`)
  assert.equal(component.methods.label.call({ $t: key => 'translated:' + key }, item), 'translated:' + keyOf(item))
}
const detail = fs.readFileSync(new URL('../pages/devices/detail.vue', import.meta.url), 'utf8')
assert.ok(detail.includes('<app-tabbar active-path="pages/devices/index" />'))
assert.ok(!detail.includes('navigationItems'))
assert.ok(!detail.includes('bottom-navigation'))
console.log('Shared TabBar checks passed: global config, tab routes, translations and detail integration')

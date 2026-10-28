import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const web = join(dirname(fileURLToPath(import.meta.url)), '../../../apps/web/src')

describe('upload is regional-only', () => {
  test('global/desk chrome never mounts an ungated upload control', () => {
    const rail = readFileSync(join(web, 'components/LayerRail.vue'), 'utf8')
    const nav = readFileSync(join(web, 'components/TopNav.vue'), 'utf8')
    const app = readFileSync(join(web, 'App.vue'), 'utf8')
    assert.match(rail, /v-if="ui\.page === 'regional'"/)
    assert.match(rail, /t\.upload/)
    assert.equal(/uploadOpen = true/.test(nav), false)
    assert.match(app, /page === 'regional'/)
    assert.match(app, /UploadModal|RegionalChrome/)
  })
})

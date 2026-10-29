#!/usr/bin/env node
import { ensureLivePack, statusPayload } from './ensure.mjs'

const cmd = process.argv[2] || 'status'
if (cmd === 'status') {
  console.log(JSON.stringify(statusPayload(), null, 2))
  process.exit(0)
}
if (cmd === 'ensure') {
  const pack = process.argv[3] || 'global/ocean'
  const r = await ensureLivePack(pack)
  console.log(JSON.stringify(r, null, 2))
  process.exit(r.ok ? 0 : 2)
}
console.error('usage: cli.mjs status | ensure [packId]')
process.exit(1)

import { expect, test } from 'vitest'
import { classifyRequest } from './requests.ts'

const o = 'http://localhost:4291'

test('classifyRequest', () => {
  expect(classifyRequest(`${o}/games/slot-3d/assets/a.js`, 'slot-3d', o)).toBe('ok')
  expect(classifyRequest(`${o}/models/x.glb`, 'slot-3d', o)).toBe('outside')
  expect(classifyRequest(`${o}/games/crash-3d/assets/a.js`, 'slot-3d', o)).toBe('outside')
  expect(classifyRequest(`${o}/favicon.ico`, 'slot-3d', o)).toBe('ok')
  expect(classifyRequest('https://cdn.example.com/x.js', 'slot-3d', o)).toBe('external')
  expect(classifyRequest('data:image/png;base64,AA', 'slot-3d', o)).toBe('ok')
  expect(classifyRequest(`blob:${o}/uuid`, 'slot-3d', o)).toBe('ok')
})

test('the lobby page itself may load anything on its origin', () => {
  expect(classifyRequest(`${o}/assets/index.js`, null, o)).toBe('ok')
  expect(classifyRequest('https://fonts.example.com/a.woff2', null, o)).toBe('external')
})

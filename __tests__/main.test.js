/**
 * Unit tests for the action's main functionality, src/main.js
 */
import { jest } from '@jest/globals'

const { _run } = await import('../src/main.js')

describe('main.js', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })
  it('Works', async () => {
    // await _run()
  })
})

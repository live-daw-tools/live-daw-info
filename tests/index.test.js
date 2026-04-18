import { expect, test, vi } from 'vitest'
import { AbletonInfoMacOS } from '../lib/ableton-info-macos.js'
import { AbletonInfoWin64, AbletonPrefs } from '../index.js'
import os from 'os'

test('index.js exports AbletonInfoMacOS', () => {
	expect(typeof AbletonInfoMacOS).toBe('function')
})

test('index.js exports AbletonInfoWin64', () => {
	expect(typeof AbletonInfoWin64).toBe('function')
})

test('index.js exports AbletonPrefs', () => {
	expect(typeof AbletonPrefs).toBe('function')
})

test('anything at all', async () => {
	expect(1 + 1).toBe(2)
})

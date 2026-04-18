import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AbletonPrefs } from '../lib/ableton-prefs.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('AbletonPrefs', () => {
	let prefsPath
	let prefs

	beforeEach(() => {
		prefsPath = path.join(__dirname, 'testdata', 'Preferences.cfg')
	})

	describe('constructor', () => {
		it('should load a valid preferences file', async () => {
			prefs = await new AbletonPrefs(prefsPath)
			expect(prefs).toBeDefined()
		})

		it('should throw error when file does not exist', async () => {
			const nonExistentPath = path.join(
				__dirname,
				'testdata',
				'NonExistent.cfg',
			)
			await expect(new AbletonPrefs(nonExistentPath)).rejects.toThrow(
				'File not found',
			)
		})

		it('should throw error when file has no PluginManager segment', async () => {
			const noPluginManagerPath = path.join(
				__dirname,
				'testdata',
				'NoPluginManager.cfg',
			)
			await expect(new AbletonPrefs(noPluginManagerPath)).rejects.toThrow(
				'PluginManager segment not found',
			)
		})

		it('should load bytes and text representations from file', async () => {
			prefs = await new AbletonPrefs(prefsPath)
			// Verify the object has the expected structure by accessing methods
			expect(typeof prefs.getVst3Configuration).toBe('function')
			expect(typeof prefs.getVst2Configuration).toBe('function')
			expect(typeof prefs.getAuConfiguration).toBe('function')
		})
	})

	describe('getVst3Configuration', () => {
		beforeEach(async () => {
			prefsPath = path.join(
				__dirname,
				'testdata',
				'live-11',
				'Preferences-vst3-enabled.cfg',
			)
			prefs = await new AbletonPrefs(prefsPath)
		})

		it('should return an object with vst3 configuration', () => {
			const config = prefs.getVst3Configuration()
			expect(config).toBeDefined()
			expect(typeof config).toBe('object')
		})

		it('should have isEnabled property', () => {
			const config = prefs.getVst3Configuration()
			expect('isEnabled' in config).toBe(true)
			expect(typeof config.isEnabled).toBe('boolean')
		})

		it('should have isCustomPathEnabled property', () => {
			const config = prefs.getVst3Configuration()
			expect('isCustomPathEnabled' in config).toBe(true)
			expect(typeof config.isCustomPathEnabled).toBe('boolean')
		})

		it('should have customPath property', () => {
			const config = prefs.getVst3Configuration()
			expect('customPath' in config).toBe(true)
		})

		it('should cache configuration result', () => {
			const config1 = prefs.getVst3Configuration()
			const config2 = prefs.getVst3Configuration()
			expect(config1).toStrictEqual(config2)
		})

		it('should not throw when byte at index 15 is not 2 with current guard expression', () => {
			const findAllOccurrencesSpy = vi
				.spyOn(prefs, 'findAllOccurrences')
				.mockReturnValue([0, 0])

			expect(() => prefs.getVst3Configuration()).not.toThrow()

			findAllOccurrencesSpy.mockRestore()
		})
	})

	describe('getVst3Configuration - disabled state', () => {
		beforeEach(async () => {
			prefsPath = path.join(
				__dirname,
				'testdata',
				'live-11',
				'Preferences-vst3-disabled.cfg',
			)
			prefs = await new AbletonPrefs(prefsPath)
		})

		it('should detect when vst3 is disabled', () => {
			const config = prefs.getVst3Configuration()
			expect(config.isEnabled).toBe(false)
		})
	})

	describe('getVst2Configuration', () => {
		beforeEach(async () => {
			prefsPath = path.join(
				__dirname,
				'testdata',
				'live-11',
				'Preferences-vst2-sys-enabled.cfg',
			)
			prefs = await new AbletonPrefs(prefsPath)
		})

		it('should return an object with vst2 configuration', () => {
			const config = prefs.getVst2Configuration()
			expect(config).toBeDefined()
			expect(typeof config).toBe('object')
		})

		it('should have isEnabled property', () => {
			const config = prefs.getVst2Configuration()
			expect('isEnabled' in config).toBe(true)
			expect(typeof config.isEnabled).toBe('boolean')
		})

		it('should have customPath property', () => {
			const config = prefs.getVst2Configuration()
			expect('customPath' in config).toBeDefined()
		})

		it('should have isCustomPathEnabled property', () => {
			const config = prefs.getVst2Configuration()
			expect('isCustomPathEnabled' in config).toBeDefined()
		})

		it('should cache configuration result', () => {
			const config1 = prefs.getVst2Configuration()
			const config2 = prefs.getVst2Configuration()
			expect(config1).toStrictEqual(config2)
		})
	})

	describe('getVst2Configuration - disabled state', () => {
		beforeEach(async () => {
			prefsPath = path.join(
				__dirname,
				'testdata',
				'live-11',
				'Preferences-vst2-sys-disabled.cfg',
			)
			prefs = await new AbletonPrefs(prefsPath)
		})

		it('should detect when vst2 is disabled', () => {
			const config = prefs.getVst2Configuration()
			expect(config.isEnabled).toBe(false)
		})
	})

	describe('getAuConfiguration', () => {
		beforeEach(async () => {
			prefsPath = path.join(
				__dirname,
				'testdata',
				'live-11',
				'Preferences-au-custom-enabled.cfg',
			)
			prefs = await new AbletonPrefs(prefsPath)
		})

		it('should return an object with au configuration', () => {
			const config = prefs.getAuConfiguration()
			expect(config).toBeDefined()
			expect(typeof config).toBe('object')
		})

		it('should have isEnabled property', () => {
			const config = prefs.getAuConfiguration()
			expect('isEnabled' in config).toBe(true)
			expect(typeof config.isEnabled).toBe('boolean')
		})

		it('should cache configuration result', () => {
			const config1 = prefs.getAuConfiguration()
			const config2 = prefs.getAuConfiguration()
			expect(config1).toStrictEqual(config2)
		})
	})

	describe('getAuConfiguration - disabled state', () => {
		beforeEach(async () => {
			prefsPath = path.join(
				__dirname,
				'testdata',
				'live-11',
				'Preferences-au-custom-disabled.cfg',
			)
			prefs = await new AbletonPrefs(prefsPath)
		})

		it('should detect when au is disabled', () => {
			const config = prefs.getAuConfiguration()
			expect(config.isEnabled).toBe(false)
		})
	})

	describe('PluginConfig getter', () => {
		beforeEach(async () => {
			prefsPath = path.join(
				__dirname,
				'testdata',
				'live-11',
				'Preferences-all-prefs-set.cfg',
			)
			prefs = await new AbletonPrefs(prefsPath)
		})

		it('should return an object with vst3, vst2, and au properties', () => {
			const config = prefs.PluginConfig
			expect(config).toBeDefined()
			expect('vst3' in config).toBe(true)
			expect('vst2' in config).toBe(true)
			expect('au' in config).toBe(true)
		})

		it('should contain vst3 configuration', () => {
			const config = prefs.PluginConfig
			expect(config.vst3).toBeDefined()
			expect('isEnabled' in config.vst3).toBe(true)
		})

		it('should contain vst2 configuration', () => {
			const config = prefs.PluginConfig
			expect(config.vst2).toBeDefined()
			expect('isEnabled' in config.vst2).toBe(true)
		})

		it('should contain au configuration', () => {
			const config = prefs.PluginConfig
			expect(config.au).toBeDefined()
			expect('isEnabled' in config.au).toBe(true)
		})
	})

	describe('bytesToStringArr', () => {
		beforeEach(async () => {
			prefsPath = path.join(__dirname, 'testdata', 'Preferences.cfg')
			prefs = await new AbletonPrefs(prefsPath)
		})

		it('should convert printable ASCII bytes to characters', () => {
			const bytes = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
			const result = prefs.bytesToStringArr(bytes)
			expect(result.join('')).toBe('Hello')
		})

		it('should convert non-printable bytes to hex with default prefix', () => {
			const bytes = new Uint8Array([0, 1, 2])
			const result = prefs.bytesToStringArr(bytes)
			expect(result[0]).toBe('\\x00')
			expect(result[1]).toBe('\\x01')
			expect(result[2]).toBe('\\x02')
		})

		it('should handle mixed printable and non-printable bytes', () => {
			const bytes = new Uint8Array([65, 0, 66]) // "A\0B"
			const result = prefs.bytesToStringArr(bytes)
			expect(result[0]).toBe('A')
			expect(result[1]).toBe('\\x00')
			expect(result[2]).toBe('B')
		})

		it('should support custom hex prefix', () => {
			const bytes = new Uint8Array([0, 1, 2])
			const result = prefs.bytesToStringArr(bytes, { hexPrefix: '0x' })
			expect(result[0]).toBe('0x00')
			expect(result[1]).toBe('0x01')
			expect(result[2]).toBe('0x02')
		})

		it('should support uppercase hex', () => {
			const bytes = new Uint8Array([10, 11, 12])
			const result = prefs.bytesToStringArr(bytes, { lowercase: false })
			expect(result[0]).toBe('\\x0A')
			expect(result[1]).toBe('\\x0B')
			expect(result[2]).toBe('\\x0C')
		})

		it('should handle entire printable ASCII range (32-126)', () => {
			// Printable ASCII: 32-126
			const bytes = new Uint8Array([32, 65, 90, 97, 122, 126]) // " AZaz~"
			const result = prefs.bytesToStringArr(bytes)
			expect(result.join('')).toBe(' AZaz~')
		})

		it('should convert boundary cases at ASCII 31 and 127', () => {
			const bytes = new Uint8Array([31, 127]) // Just below and at boundary of printable range
			const result = prefs.bytesToStringArr(bytes)
			expect(result[0]).toBe('\\x1f')
			expect(result[1]).toBe('\\x7f')
		})
	})

	describe('findAllOccurrences', () => {
		beforeEach(async () => {
			prefsPath = path.join(__dirname, 'testdata', 'Preferences.cfg')
			prefs = await new AbletonPrefs(prefsPath)
		})

		it('should find a single occurrence of a pattern', () => {
			const text = 'Hello World Hello'
			const bytes = new TextEncoder().encode(text)
			const needle = new TextEncoder().encode('World')
			const result = prefs.findAllOccurrences('World', bytes)
			expect(result.length).toBeGreaterThanOrEqual(1)
			expect(result[0]).toBe(6)
		})

		it('should find multiple occurrences of a pattern', () => {
			const text = 'Hello World Hello'
			const bytes = new TextEncoder().encode(text)
			const result = prefs.findAllOccurrences('Hello', bytes)
			expect(result.length).toBe(2)
			expect(result[0]).toBe(0)
			expect(result[1]).toBe(12)
		})

		it('should return empty array when pattern not found', () => {
			const bytes = new TextEncoder().encode('Hello World')
			const result = prefs.findAllOccurrences('Xyz', bytes)
			expect(result).toEqual([])
		})

		it('should handle single character pattern', () => {
			const bytes = new TextEncoder().encode('aaa')
			const result = prefs.findAllOccurrences('a', bytes)
			expect(result.length).toBeGreaterThanOrEqual(1)
		})

		it('should handle pattern equal to full text', () => {
			const bytes = new TextEncoder().encode('Hello')
			const result = prefs.findAllOccurrences('Hello', bytes)
			expect(result).toEqual([0])
		})
	})

	describe('extractVst3CustomPath', () => {
		it('should extract custom path when present in vst3-custom-enabled file', async () => {
			prefsPath = path.join(
				__dirname,
				'testdata',
				'live-11',
				'Preferences-vst3-custom-enabled.cfg',
			)
			prefs = await new AbletonPrefs(prefsPath)

			const indexes = prefs.findAllOccurrences('Vst3Preferences', prefs.bytes)
			expect(indexes.length).toBeGreaterThan(1)
			expect(typeof prefs.extractVst3CustomPath).toBe('function')
		})

		it('should return false when no custom path found', async () => {
			prefsPath = path.join(
				__dirname,
				'testdata',
				'live-11',
				'Preferences-vst3-custom-init.cfg',
			)
			prefs = await new AbletonPrefs(prefsPath)

			// Test with a byte array that doesn't contain the expected pattern
			const bytes = new Uint8Array([1, 2, 3, 4, 5])
			const result = prefs.extractVst3CustomPath(bytes)
			expect(result).toBe(false)
		})
	})

	describe('extractVst2CustomPath', () => {
		beforeEach(async () => {
			prefsPath = path.join(
				__dirname,
				'testdata',
				'live-11',
				'Preferences-vst2-sys-enabled.cfg',
			)
			prefs = await new AbletonPrefs(prefsPath)
		})

		it('should return null when bytes[14] is 0', () => {
			const bytes = new Uint8Array(20)
			bytes[14] = 0
			const result = prefs.extractVst2CustomPath(bytes)
			expect(result).toBeNull()
		})

		it('should extract macOS custom path when bytes[14] is 28', () => {
			const bytes = new Uint8Array(50)
			bytes[14] = 28
			const pathStr = '/tmp/custom-vst'
			const pathBytes = new TextEncoder().encode(pathStr)
			for (let i = 0; i < pathBytes.length; i++) {
				bytes[20 + i] = pathBytes[i]
			}
			bytes[20 + pathBytes.length] = 0x01 // \x01 terminator

			const result = prefs.extractVst2CustomPath(bytes)
			expect(result).toBe('/tmp/custom-vst')
		})

		it('should extract Windows custom path when bytes[14] is 41', () => {
			const bytes = new Uint8Array(50)
			bytes[14] = 41
			const pathContent = ')C:/vst/plugins)'
			const pathBytes = new TextEncoder().encode(pathContent)
			for (let i = 0; i < pathBytes.length; i++) {
				bytes[20 + i] = pathBytes[i]
			}

			const result = prefs.extractVst2CustomPath(bytes)
			expect(result).toBe('C:/vst/plugins')
		})

		it('should return undefined when bytes[14] is 28 but no matching path found', () => {
			const bytes = new Uint8Array(20)
			bytes[14] = 28
			const result = prefs.extractVst2CustomPath(bytes)
			expect(result).toBeUndefined()
		})
	})

	describe('extractVst3CustomPathUnified', () => {
		let prefsPath
		let prefs

		beforeEach(async () => {
			prefsPath = path.join(__dirname, 'testdata', 'Preferences.cfg')
			prefs = await new AbletonPrefs(prefsPath)
		})

		it('should extract macOS path from byte array', () => {
			// Example: Vst3Preferences\x02\x01\x01#/Users/jeff/Desktop/tmp/vst3-custom\x15
			const testString =
				'Vst3Preferences\x02\x01\x01#/Users/jeff/Desktop/tmp/vst3-custom\x15TempoFollowerPrefData'
			const bytes = new TextEncoder().encode(testString)

			const result = prefs.extractVst3CustomPath(bytes)
			expect(result).toBe('/Users/jeff/Desktop/tmp/vst3-custom')
		})

		it('should extract Windows path with spaces from byte array', () => {
			// Example: Vst3Preferences\x02\x01\x01)C:/Users/aniso/OneDrive/Desktop/hack/vst3\x15
			const testString =
				'Vst3Preferences\x02\x01\x01)C:/Users/aniso/OneDrive/Desktop/hack/vst3\x15TempoFollowerPrefData'
			const bytes = new TextEncoder().encode(testString)

			const result = prefs.extractVst3CustomPath(bytes)
			expect(result).toBe('C:/Users/aniso/OneDrive/Desktop/hack/vst3')
		})

		it('should extract Windows path without spaces', () => {
			const testString =
				'Vst3Preferences\x02\x01\x01)C:/Users/test/vst3\x15TempoFollowerPrefData'
			const bytes = new TextEncoder().encode(testString)

			const result = prefs.extractVst3CustomPath(bytes)
			expect(result).toBe('C:/Users/test/vst3')
		})

		it('should extract Windows path with backslashes', () => {
			const testString =
				'Vst3Preferences\x02\x01\x01)C:\\Users\\test\\vst3\x15TempoFollowerPrefData'
			const bytes = new TextEncoder().encode(testString)

			const result = prefs.extractVst3CustomPath(bytes)
			expect(result).toBe('C:\\Users\\test\\vst3')
		})

		it('should extract macOS path with hyphens', () => {
			const testString =
				'Vst3Preferences\x02\x01\x01#/Users/test-user/Desktop/my-vst3\x15TempoFollowerPrefData'
			const bytes = new TextEncoder().encode(testString)

			const result = prefs.extractVst3CustomPath(bytes)
			expect(result).toBe('/Users/test-user/Desktop/my-vst3')
		})

		it('should return false when no path pattern is found', () => {
			const bytes = new Uint8Array([1, 2, 3, 4, 5])
			const result = prefs.extractVst3CustomPath(bytes)
			expect(result).toBe(false)
		})

		it('should return false when path does not have terminator', () => {
			const testString =
				'Vst3Preferences\x02\x01\x01#/Users/jeff/Desktop/tmp/vst3-custom'
			const bytes = new TextEncoder().encode(testString)

			const result = prefs.extractVst3CustomPath(bytes)
			expect(result).toBe(false)
		})

		it('should handle actual file bytes from vst3-custom-enabled config', async () => {
			prefsPath = path.join(
				__dirname,
				'testdata',
				'live-11',
				'Preferences-vst3-custom-enabled.cfg',
			)
			prefs = await new AbletonPrefs(prefsPath)

			// Get the actual bytes from the file
			const indexes = prefs.findAllOccurrences('Vst3Preferences', prefs.bytes)
			const bytes = prefs.bytes.slice(indexes[1], indexes[1] + 200)

			const result = prefs.extractVst3CustomPath(bytes)

			// Should extract the path (will be macOS path since it's from test data)
			expect(result).toBeTruthy()
			expect(typeof result).toBe('string')
			expect(result).toMatch(/^\//)
		})

		it('should work consistently with filter logic', () => {
			// Simulate byte array that bytesToStringArr would process
			const testString =
				'Vst3Preferences\x02\x01\x01#/Users/jeff/Desktop/tmp/vst3-custom\x15'
			const bytes = new TextEncoder().encode(testString)

			const result = prefs.extractVst3CustomPath(bytes)
			expect(result).toBe('/Users/jeff/Desktop/tmp/vst3-custom')
		})
	})

	describe('integration tests', () => {
		it('should handle Preferences.cfg file', async () => {
			prefsPath = path.join(__dirname, 'testdata', 'Preferences.cfg')
			prefs = await new AbletonPrefs(prefsPath)
			const config = prefs.PluginConfig
			expect(config).toBeDefined()
		})

		it('should handle Preferences-11-0-12-init.cfg file', async () => {
			prefsPath = path.join(
				__dirname,
				'testdata',
				'Preferences-11-0-12-init.cfg',
			)
			prefs = await new AbletonPrefs(prefsPath)
			const config = prefs.PluginConfig
			expect(config).toBeDefined()
		})

		it('should handle multiple loads independently', async () => {
			const prefs1 = await new AbletonPrefs(
				path.join(
					__dirname,
					'testdata',
					'live-11',
					'Preferences-vst3-enabled.cfg',
				),
			)
			const prefs2 = await new AbletonPrefs(
				path.join(
					__dirname,
					'testdata',
					'live-11',
					'Preferences-vst3-disabled.cfg',
				),
			)

			const config1 = prefs1.getVst3Configuration()
			const config2 = prefs2.getVst3Configuration()

			expect(config1).not.toEqual(config2)
		})
	})
})

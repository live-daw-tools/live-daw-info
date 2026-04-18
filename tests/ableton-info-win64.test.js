import { expect, test, vi, describe, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import os, { platform } from 'os'
import fs from 'node:fs/promises'

vi.mock('child_process', async () => {
	const actual = await vi.importActual('child_process')
	return {
		...actual,
		execSync: vi.fn(actual.execSync),
	}
})

import {
	AbletonInfoWin64,
	PluginInfoWin64,
	isRunningInWsl,
	runPowerShellCommand,
} from '../lib/ableton-info-win64.js'

describe('isRunningInWsl', () => {
	test('returns true when WSL_DISTRO_NAME environment variable is set and os.type is Linux', () => {
		const originalEnv = process.env.WSL_DISTRO_NAME
		const originalWslEnv = process.env.WSLENV
		process.env.WSL_DISTRO_NAME = 'Ubuntu'
		delete process.env.WSLENV

		const typeSpy = vi.spyOn(os, 'type').mockReturnValue('Linux')

		const result = isRunningInWsl()

		expect(result).toBe(true)

		typeSpy.mockRestore()

		// Restore original values
		if (originalEnv === undefined) {
			delete process.env.WSL_DISTRO_NAME
		} else {
			process.env.WSL_DISTRO_NAME = originalEnv
		}
		if (originalWslEnv !== undefined) {
			process.env.WSLENV = originalWslEnv
		}
	})

	test('returns true when WSLENV environment variable is set and os.type is Linux', () => {
		const originalDistro = process.env.WSL_DISTRO_NAME
		const originalWslEnv = process.env.WSLENV
		delete process.env.WSL_DISTRO_NAME
		process.env.WSLENV = 'PATH/l'

		const typeSpy = vi.spyOn(os, 'type').mockReturnValue('Linux')

		const result = isRunningInWsl()

		expect(result).toBe(true)

		typeSpy.mockRestore()

		// Restore original values
		if (originalDistro !== undefined) {
			process.env.WSL_DISTRO_NAME = originalDistro
		}
		if (originalWslEnv === undefined) {
			delete process.env.WSLENV
		} else {
			process.env.WSLENV = originalWslEnv
		}
	})

	test('returns false when WSL environment variables are set but os.type is not Linux', () => {
		const originalEnv = process.env.WSL_DISTRO_NAME
		process.env.WSL_DISTRO_NAME = 'Ubuntu'

		const typeSpy = vi.spyOn(os, 'type').mockReturnValue('Windows_NT')

		const result = isRunningInWsl()

		expect(result).toBe(false)

		typeSpy.mockRestore()

		// Restore original value
		if (originalEnv === undefined) {
			delete process.env.WSL_DISTRO_NAME
		} else {
			process.env.WSL_DISTRO_NAME = originalEnv
		}
	})

	test('returns false when os.type is Linux but WSL environment variables are not set', () => {
		const originalDistro = process.env.WSL_DISTRO_NAME
		const originalWslEnv = process.env.WSLENV
		delete process.env.WSL_DISTRO_NAME
		delete process.env.WSLENV

		const typeSpy = vi.spyOn(os, 'type').mockReturnValue('Linux')

		const result = isRunningInWsl()

		expect(result).toBe(false)

		typeSpy.mockRestore()

		// Restore original values
		if (originalDistro !== undefined) {
			process.env.WSL_DISTRO_NAME = originalDistro
		}
		if (originalWslEnv !== undefined) {
			process.env.WSLENV = originalWslEnv
		}
	})

	test('returns false when not running in WSL (Windows_NT)', () => {
		const originalDistro = process.env.WSL_DISTRO_NAME
		const originalWslEnv = process.env.WSLENV
		delete process.env.WSL_DISTRO_NAME
		delete process.env.WSLENV

		const typeSpy = vi.spyOn(os, 'type').mockReturnValue('Windows_NT')

		const result = isRunningInWsl()

		expect(result).toBe(false)

		typeSpy.mockRestore()

		// Restore original values
		if (originalDistro !== undefined) {
			process.env.WSL_DISTRO_NAME = originalDistro
		}
		if (originalWslEnv !== undefined) {
			process.env.WSLENV = originalWslEnv
		}
	})
})

// Note: Platform check test is skipped as mocking os.platform() with WSL checks is complex.
// The actual platform validation is tested in the platform-specific describe blocks below.

test('PluginInfoWin64 constructor throws on non-Windows non-WSL platform', () => {
	const originalDistro = process.env.WSL_DISTRO_NAME
	const originalWslEnv = process.env.WSLENV
	delete process.env.WSL_DISTRO_NAME
	delete process.env.WSLENV

	const platformSpy = vi.spyOn(os, 'platform').mockReturnValue('linux')
	const typeSpy = vi.spyOn(os, 'type').mockReturnValue('Linux')

	expect(() => new PluginInfoWin64()).toThrow(
		'PluginInfoWin64 can only be used on Windows',
	)

	platformSpy.mockRestore()
	typeSpy.mockRestore()

	if (originalDistro !== undefined) process.env.WSL_DISTRO_NAME = originalDistro
	if (originalWslEnv !== undefined) process.env.WSLENV = originalWslEnv
})

test('AbletonInfoWin64 constructor throws on non-Windows non-WSL platform', () => {
	const originalDistro = process.env.WSL_DISTRO_NAME
	const originalWslEnv = process.env.WSLENV
	delete process.env.WSL_DISTRO_NAME
	delete process.env.WSLENV

	const platformSpy = vi.spyOn(os, 'platform').mockReturnValue('linux')
	const typeSpy = vi.spyOn(os, 'type').mockReturnValue('Linux')

	expect(() => new AbletonInfoWin64()).toThrow(
		'AbletonInfoWin64 can only be used on Windows operating systems',
	)

	platformSpy.mockRestore()
	typeSpy.mockRestore()

	if (originalDistro !== undefined) process.env.WSL_DISTRO_NAME = originalDistro
	if (originalWslEnv !== undefined) process.env.WSLENV = originalWslEnv
})

describe('PluginInfoWin64', () => {
	let platformSpy

	beforeEach(() => {
		platformSpy = vi.spyOn(os, 'platform').mockReturnValue('win32')
	})

	afterEach(() => {
		platformSpy.mockRestore()
		vi.resetAllMocks()
	})
	test('getVst2Plugins returns empty list when VST2 is disabled by config', async () => {
		const readdirSpy = vi
			.spyOn(fs, 'readdir')
			.mockResolvedValue(['Synth.dll', 'Chord.dll', 'Readme.txt', 'FX.vst3'])

		const instance = new PluginInfoWin64()
		const result = await instance.getVst2Plugins(false)

		expect(readdirSpy).toHaveBeenCalledTimes(0)
		expect(result).toEqual([])

		readdirSpy.mockRestore()
	})

	test('getVst2Plugins includes plugins from system and custom VST2 paths when enabled', async () => {
		const readdirSpy = vi.spyOn(fs, 'readdir').mockImplementation((path) => {
			if (path === 'C:\\Program Files\\VSTPlugins') {
				return Promise.resolve(['DefaultSynth.dll', 'ignore.vst3'])
			}
			if (path === 'C:\\Program Files\\Steinberg\\VSTPlugins') {
				return Promise.resolve(['SteinbergFX.dll', 'notes.md'])
			}
			if (path === 'D:\\CustomVST2\\') {
				return Promise.resolve(['CustomEQ.dll', 'readme.txt'])
			}
			return Promise.resolve([])
		})

		const instance = new PluginInfoWin64({
			vst2: {
				enabled: true,
				customEnabled: true,
				customPath: 'D:\\CustomVST2\\',
			},
		})
		await new Promise((resolve) => setTimeout(resolve, 0))
		readdirSpy.mockClear()
		const result = await instance.getVst2Plugins(false)

		expect(readdirSpy).toHaveBeenCalledTimes(3)
		expect(readdirSpy).toHaveBeenNthCalledWith(
			1,
			'C:\\Program Files\\VSTPlugins',
		)
		expect(readdirSpy).toHaveBeenNthCalledWith(
			2,
			'C:\\Program Files\\Steinberg\\VSTPlugins',
		)
		expect(readdirSpy).toHaveBeenNthCalledWith(3, 'D:\\CustomVST2\\')
		expect(result).toEqual([
			'C:\\Program Files\\VSTPlugins\\DefaultSynth.dll',
			'C:\\Program Files\\Steinberg\\VSTPlugins\\SteinbergFX.dll',
			'D:\\CustomVST2\\CustomEQ.dll',
		])

		readdirSpy.mockRestore()
	})

	test('getVst3Plugins returns empty list when VST3 is disabled by config', async () => {
		const readdirSpy = vi
			.spyOn(fs, 'readdir')
			.mockResolvedValue(['StereoTool.vst3', 'Pad.vst3', 'Legacy.dll'])

		const instance = new PluginInfoWin64()
		const result = await instance.getVst3Plugins(false)

		expect(readdirSpy).toHaveBeenCalledTimes(0)
		expect(result).toEqual([])

		readdirSpy.mockRestore()
	})

	test('getVst3Plugins includes plugins from system and custom VST3 paths when enabled', async () => {
		const readdirSpy = vi.spyOn(fs, 'readdir').mockImplementation((path) => {
			if (path === 'C:\\Program Files\\Common Files\\VST3') {
				return Promise.resolve(['DefaultComp.vst3', 'skip.dll'])
			}
			if (path === 'D:\\MyVST3\\') {
				return Promise.resolve(['CustomLimiter.vst3', 'readme.txt'])
			}
			return Promise.resolve([])
		})

		const instance = new PluginInfoWin64({
			vst3: {
				enabled: true,
				customEnabled: true,
				customPath: 'D:\\MyVST3\\',
			},
		})
		await new Promise((resolve) => setTimeout(resolve, 0))
		readdirSpy.mockClear()
		const result = await instance.getVst3Plugins(false)

		expect(readdirSpy).toHaveBeenCalledTimes(2)
		expect(readdirSpy).toHaveBeenNthCalledWith(
			1,
			'C:\\Program Files\\Common Files\\VST3',
		)
		expect(readdirSpy).toHaveBeenNthCalledWith(2, 'D:\\MyVST3\\')
		expect(result).toEqual([
			'C:\\Program Files\\Common Files\\VST3\\DefaultComp.vst3',
			'D:\\MyVST3\\CustomLimiter.vst3',
		])

		readdirSpy.mockRestore()
	})

	test('getVst2Plugins uses cache when cache has plugins', async () => {
		const readdirSpy = vi.spyOn(fs, 'readdir').mockResolvedValue([])

		const instance = new PluginInfoWin64()
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Populate cache by calling with cache=false
		await instance.getVst2Plugins(false)
		readdirSpy.mockClear()

		// Subsequent calls with cache=true (default) should not call readdir
		await instance.getVst2Plugins()
		await instance.getVst2Plugins(true)

		expect(readdirSpy).toHaveBeenCalledTimes(0)

		readdirSpy.mockRestore()
	})

	test('getVst3Plugins uses cache by default', async () => {
		const instance = new PluginInfoWin64()
		await new Promise((resolve) => setTimeout(resolve, 10))

		// Manually populate the cache bypassing the constructor's async initialization
		await instance.getVst3Plugins(false) // Populate cache

		// Spy on the private method to see if it's called
		const readdirSpy = vi.spyOn(fs, 'readdir')

		// These calls should use cache and not call readdir
		await instance.getVst3Plugins()
		await instance.getVst3Plugins()

		expect(readdirSpy).toHaveBeenCalledTimes(0)

		readdirSpy.mockRestore()
	})

	test('refresh method refreshes all plugin caches using non-cached getter calls', async () => {
		const instance = new PluginInfoWin64()
		await new Promise((resolve) => setTimeout(resolve, 0))

		const refreshedVst2 = ['C:\\refreshed.dll']
		const refreshedVst3 = ['C:\\refreshed.vst3']

		const getVst2PluginsSpy = vi
			.spyOn(instance, 'getVst2Plugins')
			.mockResolvedValue(refreshedVst2)
		const getVst3PluginsSpy = vi
			.spyOn(instance, 'getVst3Plugins')
			.mockResolvedValue(refreshedVst3)

		await instance.refresh()

		expect(getVst2PluginsSpy).toHaveBeenCalledWith(false)
		expect(getVst3PluginsSpy).toHaveBeenCalledWith(false)

		getVst2PluginsSpy.mockRestore()
		getVst3PluginsSpy.mockRestore()

		await expect(instance.getVst2Plugins()).resolves.toEqual(refreshedVst2)
		await expect(instance.getVst3Plugins()).resolves.toEqual(refreshedVst3)
	})

	test('map getter returns object with vst2 and vst3 arrays', async () => {
		const instance = new PluginInfoWin64()
		await new Promise((resolve) => setTimeout(resolve, 0))

		const map = instance.map

		expect(map).toHaveProperty('vst2')
		expect(map).toHaveProperty('vst3')
		expect(Array.isArray(map.vst2)).toBe(true)
		expect(Array.isArray(map.vst3)).toBe(true)
	})

	test('getVst2Plugins handles missing directories gracefully', async () => {
		const readdirSpy = vi.spyOn(fs, 'readdir').mockImplementation((path) => {
			// Simulate missing directory
			return Promise.reject(new Error('ENOENT: no such file or directory'))
		})

		const instance = new PluginInfoWin64({
			vst2: {
				enabled: true,
				customEnabled: true,
				customPath: 'D:\\NonExistent\\',
			},
		})
		await new Promise((resolve) => setTimeout(resolve, 0))
		readdirSpy.mockClear()
		const result = await instance.getVst2Plugins(false)

		// Should return empty array when directories don't exist
		expect(result).toEqual([])

		readdirSpy.mockRestore()
	})

	test('getVst3Plugins handles missing directories gracefully', async () => {
		const readdirSpy = vi.spyOn(fs, 'readdir').mockImplementation((path) => {
			// Simulate missing directory
			return Promise.reject(new Error('ENOENT: no such file or directory'))
		})

		const instance = new PluginInfoWin64({
			vst3: {
				enabled: true,
				customEnabled: true,
				customPath: 'D:\\NonExistent\\',
			},
		})
		await new Promise((resolve) => setTimeout(resolve, 0))
		readdirSpy.mockClear()
		const result = await instance.getVst3Plugins(false)

		// Should return empty array when directories don't exist
		expect(result).toEqual([])

		readdirSpy.mockRestore()
	})
})

describe('AbletonInfoWin64', () => {
	let platformSpy

	beforeEach(() => {
		platformSpy = vi.spyOn(os, 'platform').mockReturnValue('win32')
	})

	afterEach(() => {
		platformSpy.mockRestore()
		vi.resetAllMocks()
	})
	test('AbletonInfoWin64 init', () => {
		const instance = new AbletonInfoWin64()
		expect(instance.platform).toBe('win32')
	})

	test('getWindowsVersion returns correct info for Windows 10', () => {
		const releaseSpy = vi.spyOn(os, 'release').mockReturnValue('10.0.19045')

		const instance = new AbletonInfoWin64()
		const result = instance.getWindowsVersion()

		expect(result).toEqual({
			majorVersion: 10,
			buildNumber: 19045,
			productName: 'Windows 10',
		})

		releaseSpy.mockRestore()
	})

	test('getWindowsVersion returns correct info for Windows 11', () => {
		const releaseSpy = vi.spyOn(os, 'release').mockReturnValue('10.0.26000')

		const instance = new AbletonInfoWin64()
		const result = instance.getWindowsVersion()

		expect(result).toEqual({
			majorVersion: 10,
			buildNumber: 26000,
			productName: 'Windows 11',
		})

		releaseSpy.mockRestore()
	})

	test('getWindowsVersion returns Windows 11 for builds >= 26000', () => {
		const releaseSpy = vi.spyOn(os, 'release').mockReturnValue('10.0.26100')

		const instance = new AbletonInfoWin64()
		const result = instance.getWindowsVersion()

		expect(result).toEqual({
			majorVersion: 10,
			buildNumber: 26100,
			productName: 'Windows 11',
		})

		releaseSpy.mockRestore()
	})

	test('getWindowsVersion returns Windows 10 for minimum supported build 10240', () => {
		const releaseSpy = vi.spyOn(os, 'release').mockReturnValue('10.0.10240')

		const instance = new AbletonInfoWin64()
		const result = instance.getWindowsVersion()

		expect(result).toEqual({
			majorVersion: 10,
			buildNumber: 10240,
			productName: 'Windows 10',
		})

		releaseSpy.mockRestore()
	})

	test('getWindowsVersion returns Windows 10 for build just below Windows 11 threshold', () => {
		const releaseSpy = vi.spyOn(os, 'release').mockReturnValue('10.0.25999')

		const instance = new AbletonInfoWin64()
		const result = instance.getWindowsVersion()

		expect(result).toEqual({
			majorVersion: 10,
			buildNumber: 25999,
			productName: 'Windows 10',
		})

		releaseSpy.mockRestore()
	})

	test('getWindowsVersion throws error for unsupported Windows version (build < 10240)', () => {
		const releaseSpy = vi.spyOn(os, 'release').mockReturnValue('6.1.7601')

		const instance = new AbletonInfoWin64()

		expect(() => instance.getWindowsVersion()).toThrow(
			'Unsupported Windows version: 6.1.7601. This library only supports Windows 10 and 11.',
		)

		releaseSpy.mockRestore()
	})

	test('getWindowsVersion throws error for Windows 8.1', () => {
		const releaseSpy = vi.spyOn(os, 'release').mockReturnValue('6.3.9600')

		const instance = new AbletonInfoWin64()

		expect(() => instance.getWindowsVersion()).toThrow(
			'Unsupported Windows version: 6.3.9600. This library only supports Windows 10 and 11.',
		)

		releaseSpy.mockRestore()
	})

	test('_getAbletonInstallations returns error string when install root not accessible', async () => {
		const instance = new AbletonInfoWin64()
		const accessSpy = vi.spyOn(fs, 'access').mockRejectedValue(new Error('ENOENT'))

		const result = await instance._getAbletonInstallations()

		expect(typeof result).toBe('string')
		expect(result).toContain('Install root path not found')
		expect(result).toContain(instance.LIVE_PATHS.Install_Root)

		accessSpy.mockRestore()
	})

	test('_getAbletonInstallations returns array when install root is accessible', async () => {
		const instance = new AbletonInfoWin64()
		const accessSpy = vi.spyOn(fs, 'access').mockResolvedValue(undefined)
		const readdirSpy = vi
			.spyOn(fs, 'readdir')
			.mockResolvedValue(['OtherFolder', 'NotLive'])

		const result = await instance._getAbletonInstallations()

		expect(Array.isArray(result)).toBe(true)

		accessSpy.mockRestore()
		readdirSpy.mockRestore()
	})

	test('getLiveVersionFromExe returns trimmed version string on success', async () => {
		const instance = new AbletonInfoWin64()
		vi.mocked(execSync).mockReturnValue(Buffer.from('12.1.0\r\n'))

		const result = await instance.getLiveVersionFromExe(
			'C:\\Program Files\\Ableton\\Live.exe',
		)

		expect(result).toBe('12.1.0')

		vi.clearAllMocks()
	})

	test('getLiveVersionFromExe returns null and logs error on failure', async () => {
		const instance = new AbletonInfoWin64()
		vi.mocked(execSync).mockImplementation(() => {
			throw new Error('Command failed')
		})

		const consoleSpy = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {})

		const result = await instance.getLiveVersionFromExe(
			'C:\\Program Files\\Ableton\\Live.exe',
		)

		expect(result).toBeNull()
		expect(consoleSpy).toHaveBeenCalled()

		consoleSpy.mockRestore()
		vi.clearAllMocks()
	})
})

describe('runPowerShellCommand', () => {
	test('returns trimmed stdout on success', () => {
		vi.mocked(execSync).mockReturnValue(Buffer.from('12.1.0\r\n'))

		const result = runPowerShellCommand(
			'"(Get-Item \'C:\\\\test.exe\').VersionInfo.ProductVersion"',
		)

		expect(result).toBe('12.1.0')
		expect(vi.mocked(execSync)).toHaveBeenCalledWith(
			expect.stringContaining('powershell.exe'),
			expect.objectContaining({ windowsHide: true }),
		)

		vi.clearAllMocks()
	})

	test('throws when execSync throws', () => {
		vi.mocked(execSync).mockImplementation(() => {
			throw new Error('powershell not found')
		})

		expect(() =>
			runPowerShellCommand('"some command"'),
		).toThrow('powershell not found')

		vi.clearAllMocks()
	})
})

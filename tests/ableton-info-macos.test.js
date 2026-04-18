import { expect, test, vi, describe } from 'vitest'
import { execSync } from 'child_process'
import os, { platform } from 'os'
import fs from 'node:fs'

vi.mock('child_process', async () => {
	const actual = await vi.importActual('child_process')
	return {
		...actual,
		execSync: vi.fn(actual.execSync),
	}
})

import AbletonInfoMacOS, { PluginInfoMacOS } from '../lib/ableton-info-macos.js'

test('AbletonInfoMacOS constructor throws on non-macOS platform', () => {
	const platformSpy = vi.spyOn(os, 'platform').mockReturnValue('win32')

	expect(() => new AbletonInfoMacOS()).toThrow(
		'AbletonInfoMacOS can only be used on macOS',
	)

	platformSpy.mockRestore()
})

test('PluginInfoMacOS constructor throws on non-macOS platform', () => {
	const platformSpy = vi.spyOn(os, 'platform').mockReturnValue('win32')

	expect(() => new PluginInfoMacOS()).toThrow(
		'PluginInfoMacOS can only be used on macOS',
	)

	platformSpy.mockRestore()
})

describe.skipIf(platform() !== 'darwin')('AbletonInfoMacOS', () => {
	test('getVst2Plugins returns empty list when VST2 is disabled by config', async () => {
		const readdirSpy = vi
			.spyOn(fs.promises, 'readdir')
			.mockResolvedValue(['Synth.vst', 'Chord.vst', 'Readme.txt', 'FX.vst3'])

		const instance = new PluginInfoMacOS()
		const result = await instance.getVst2Plugins(false)

		expect(readdirSpy).toHaveBeenCalledTimes(0)
		expect(result).toEqual([])

		readdirSpy.mockRestore()
	})

	test('getVst2Plugins includes plugins from default and custom VST2 paths when enabled', async () => {
		const readdirSpy = vi
			.spyOn(fs.promises, 'readdir')
			.mockImplementation((path) => {
				if (path === '/Library/Audio/Plug-Ins/VST/') {
					return Promise.resolve(['DefaultSynth.vst', 'ignore.vst3'])
				}
				if (path === '/Users/test/VST2/') {
					return Promise.resolve(['CustomEQ.vst', 'notes.md'])
				}
				return Promise.resolve([])
			})

		const instance = new PluginInfoMacOS({
			vst2: {
				isEnabled: true,
				isCustomPathEnabled: true,
				customPath: '/Users/test/VST2/',
			},
		})
		await new Promise((resolve) => setTimeout(resolve, 0))
		readdirSpy.mockClear()
		const result = await instance.getVst2Plugins(false)

		expect(readdirSpy).toHaveBeenCalledTimes(2)
		expect(readdirSpy).toHaveBeenNthCalledWith(
			1,
			'/Library/Audio/Plug-Ins/VST/',
		)
		expect(readdirSpy).toHaveBeenNthCalledWith(2, '/Users/test/VST2/')
		expect(result).toEqual([
			'/Library/Audio/Plug-Ins/VST/DefaultSynth.vst',
			'/Users/test/VST2/CustomEQ.vst',
		])

		readdirSpy.mockRestore()
	})

	test('getVst3Plugins returns empty list when VST3 is disabled by config', async () => {
		const readdirSpy = vi
			.spyOn(fs.promises, 'readdir')
			.mockResolvedValue(['StereoTool.vst3', 'Pad.vst3', 'Legacy.vst'])

		const instance = new PluginInfoMacOS()
		const result = await instance.getVst3Plugins(false)

		expect(readdirSpy).toHaveBeenCalledTimes(0)
		expect(result).toEqual([])

		readdirSpy.mockRestore()
	})

	test('getVst3Plugins includes plugins from default and custom VST3 paths when enabled', async () => {
		const readdirSpy = vi
			.spyOn(fs.promises, 'readdir')
			.mockImplementation((path) => {
				if (path === '/Library/Audio/Plug-Ins/VST3/') {
					return Promise.resolve(['DefaultComp.vst3', 'skip.vst'])
				}
				if (path === '/Users/test/VST3/') {
					return Promise.resolve(['CustomLimiter.vst3', 'readme.txt'])
				}
				return Promise.resolve([])
			})

		const instance = new PluginInfoMacOS({
			vst3: {
				isEnabled: true,
				isCustomPathEnabled: true,
				customPath: '/Users/test/VST3/',
			},
		})
		await new Promise((resolve) => setTimeout(resolve, 0))
		readdirSpy.mockClear()
		const result = await instance.getVst3Plugins(false)

		expect(readdirSpy).toHaveBeenCalledTimes(2)
		expect(readdirSpy).toHaveBeenNthCalledWith(
			1,
			'/Library/Audio/Plug-Ins/VST3/',
		)
		expect(readdirSpy).toHaveBeenNthCalledWith(2, '/Users/test/VST3/')
		expect(result).toEqual([
			'/Library/Audio/Plug-Ins/VST3/DefaultComp.vst3',
			'/Users/test/VST3/CustomLimiter.vst3',
		])

		readdirSpy.mockRestore()
	})

	test('getAudioUnitPlugins returns only .component files from default Components path', async () => {
		const readdirSpy = vi
			.spyOn(fs.promises, 'readdir')
			.mockResolvedValue([
				'ClassicCompressor.component',
				'SpatialVerb.component',
				'not-a-plugin.txt',
			])

		const instance = new PluginInfoMacOS()
		await new Promise((resolve) => setTimeout(resolve, 0))
		readdirSpy.mockClear()
		const result = await instance.getAudioUnitPlugins(false)

		expect(readdirSpy).toHaveBeenCalledTimes(1)
		expect(readdirSpy).toHaveBeenCalledWith(
			'/Library/Audio/Plug-Ins/Components/',
		)
		expect(result).toEqual([
			'/Library/Audio/Plug-Ins/Components/ClassicCompressor.component',
			'/Library/Audio/Plug-Ins/Components/SpatialVerb.component',
		])

		readdirSpy.mockRestore()
	})

	test('getAudioUnitPlugins throws when Components path cannot be read', async () => {
		const readdirSpy = vi.spyOn(fs.promises, 'readdir').mockResolvedValue([])

		const instance = new PluginInfoMacOS()
		await new Promise((resolve) => setTimeout(resolve, 0))

		readdirSpy.mockClear()
		readdirSpy.mockRejectedValue(new Error('permission denied'))

		await expect(instance.getAudioUnitPlugins(false)).rejects.toThrow(
			'permission denied',
		)

		expect(readdirSpy).toHaveBeenCalledTimes(1)
		expect(readdirSpy).toHaveBeenCalledWith(
			'/Library/Audio/Plug-Ins/Components/',
		)

		readdirSpy.mockRestore()
	})

	test('refreshPlugins refreshes all plugin caches using non-cached getter calls', async () => {
		const instance = new PluginInfoMacOS()
		await new Promise((resolve) => setTimeout(resolve, 0))

		const refreshedVst = ['/tmp/refreshed.vst']
		const refreshedVst3 = ['/tmp/refreshed.vst3']
		const refreshedAu = ['/tmp/refreshed.component']

		const getVst2PluginsSpy = vi
			.spyOn(instance, 'getVst2Plugins')
			.mockResolvedValue(refreshedVst)
		const getVst3PluginsSpy = vi
			.spyOn(instance, 'getVst3Plugins')
			.mockResolvedValue(refreshedVst3)
		const getAudioUnitPluginsSpy = vi
			.spyOn(instance, 'getAudioUnitPlugins')
			.mockResolvedValue(refreshedAu)

		await instance.refresh()

		expect(getVst2PluginsSpy).toHaveBeenCalledWith(false)
		expect(getVst3PluginsSpy).toHaveBeenCalledWith(false)
		expect(getAudioUnitPluginsSpy).toHaveBeenCalledWith(false)

		getVst2PluginsSpy.mockRestore()
		getVst3PluginsSpy.mockRestore()
		getAudioUnitPluginsSpy.mockRestore()

		await expect(instance.getVst2Plugins()).resolves.toEqual(refreshedVst)
		await expect(instance.getVst3Plugins()).resolves.toEqual(refreshedVst3)
		await expect(instance.getAudioUnitPlugins()).resolves.toEqual(refreshedAu)
	})

	test('AbletonInfoMacOS constructor sets platform to darwin', () => {
		const instance = new AbletonInfoMacOS()
		expect(instance.platform).toBe('darwin')
	})

	test('defaultInstallRoot returns /Applications/', () => {
		const instance = new AbletonInfoMacOS()
		expect(instance.defaultInstallRoot).toBe('/Applications/')
	})

	test('installedVersions getter returns getInstalledLiveVersions result', () => {
		const instance = new AbletonInfoMacOS()
		const expectedVersions = [{ version: '12.1.0', build: '1234' }]
		const getInstalledLiveVersionsSpy = vi
			.spyOn(instance, 'getInstalledLiveVersions')
			.mockReturnValue(expectedVersions)

		expect(instance.installedVersions).toEqual(expectedVersions)
		expect(getInstalledLiveVersionsSpy).toHaveBeenCalledTimes(1)

		getInstalledLiveVersionsSpy.mockRestore()
	})

	test('getMacOSVersion returns a version string', () => {
		const instance = new AbletonInfoMacOS()
		const version = instance.getMacOSVersion()

		// Should return a string
		expect(typeof version).toBe('string')

		// Should match version format (e.g., "14.2.1" or "13.0")
		expect(version).toMatch(/^\d+\.\d+(\.\d+)?$/)

		// Should not be empty
		expect(version.length).toBeGreaterThan(0)
	})

	test('getMacOSVersion handles execution correctly', async () => {
		// get current OS version
		const currentVersion = execSync('sw_vers -productVersion', {
			encoding: 'utf8',
		}).trim()

		const instance = new AbletonInfoMacOS()

		const version = instance.getMacOSVersion()

		expect(version).toBe(currentVersion)
	})

	test('getInstalledLiveVersions returns versions for installed bundles only', () => {
		const instance = new AbletonInfoMacOS()
		const rootDirectory = '/Applications/'
		const existingBundles = new Set([
			`${rootDirectory}Ableton Live 12 Suite.app`,
			`${rootDirectory}Ableton Live 11 Standard.app`,
		])

		vi.mocked(execSync).mockImplementation((command) => {
			const appPath = command.match(/test -d "(.*)"/)?.[1]
			if (appPath && existingBundles.has(appPath)) {
				return ''
			}
			throw new Error('not found')
		})

		const getLiveVersionFromAppBundleSpy = vi
			.spyOn(instance, 'getLiveVersionFromAppBundle')
			.mockImplementation((appBundlePath) => ({
				version: appBundlePath.includes('12 Suite') ? '12.1.0' : '11.3.35',
				build: null,
			}))

		const result = instance.getInstalledLiveVersions(rootDirectory)

		expect(result).toEqual([
			{ version: '12.1.0', build: null },
			{ version: '11.3.35', build: null },
		])
		expect(getLiveVersionFromAppBundleSpy).toHaveBeenCalledTimes(2)
		expect(getLiveVersionFromAppBundleSpy).toHaveBeenNthCalledWith(
			1,
			'/Applications/Ableton Live 12 Suite.app',
		)
		expect(getLiveVersionFromAppBundleSpy).toHaveBeenNthCalledWith(
			2,
			'/Applications/Ableton Live 11 Standard.app',
		)

		vi.clearAllMocks()
	})

	test('getInstalledLiveVersions uses defaultInstallRoot when rootDirectory is not provided', () => {
		const instance = new AbletonInfoMacOS()
		const defaultRoot = '/CustomApplications/'
		const existingBundlePath = `${defaultRoot}Ableton Live 12 Suite.app`

		const defaultInstallRootSpy = vi
			.spyOn(instance, 'defaultInstallRoot', 'get')
			.mockReturnValue(defaultRoot)

		vi.mocked(execSync).mockImplementation((command) => {
			const appPath = command.match(/test -d "(.*)"/)?.[1]
			if (appPath === existingBundlePath) {
				return ''
			}
			throw new Error('not found')
		})

		const getLiveVersionFromAppBundleSpy = vi
			.spyOn(instance, 'getLiveVersionFromAppBundle')
			.mockReturnValue({ version: '12.1.0', build: null })

		const result = instance.getInstalledLiveVersions()

		expect(result).toEqual([{ version: '12.1.0', build: null }])
		expect(defaultInstallRootSpy).toHaveBeenCalledTimes(1)
		expect(getLiveVersionFromAppBundleSpy).toHaveBeenCalledTimes(1)
		expect(getLiveVersionFromAppBundleSpy).toHaveBeenCalledWith(
			'/CustomApplications/Ableton Live 12 Suite.app',
		)

		vi.clearAllMocks()
	})

	test('getExactVersionFromAppBundle returns version from Info.plist', async () => {
		const instance = new AbletonInfoMacOS()

		vi.mocked(execSync).mockReturnValueOnce(
			{ version: '12.1.5', build: '2025-12-15_bba1e05a87' }.version,
		)

		const result = instance.getLiveVersionFromAppBundle(
			'/Applications/Ableton Live 12 Suite.app',
		)

		expect(execSync).toHaveBeenCalledWith(
			'plutil -extract CFBundleShortVersionString raw "/Applications/Ableton Live 12 Suite.app/Contents/Info.plist"',
			{ encoding: 'utf8' },
		)
		expect(result.version).toBe('12.1.5')

		vi.clearAllMocks()
	})

	test('getExactVersionFromAppBundle throws error on failure', async () => {
		const instance = new AbletonInfoMacOS()

		vi.mocked(execSync).mockImplementationOnce(() => {
			throw new Error('Command failed')
		})

		expect(() => {
			instance.getLiveVersionFromAppBundle('/Applications/NonExistent.app')
		}).toThrow('Failed to get version from app bundle')

		vi.clearAllMocks()
	})
})

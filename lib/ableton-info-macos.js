import os from 'node:os'
import fs from 'node:fs'
import { execSync } from 'child_process'

/** Map of internal keys to Ableton Live .app bundle names. @type {Object.<string, string>} */
const LIVE_APP_BUNDLES = {
	Live_12_Suite: 'Ableton Live 12 Suite.app',
	Live_12_Standard: 'Ableton Live 12 Standard.app',
	Live_12_Lite: 'Ableton Live 12 Lite.app',
	Live_11_Suite: 'Ableton Live 11 Suite.app',
	Live_11_Standard: 'Ableton Live 11 Standard.app',
	Live_11_Lite: 'Ableton Live 11 Lite.app',
	Live_10_Suite: 'Ableton Live 10 Suite.app',
	Live_10_Standard: 'Ableton Live 10 Standard.app',
	Live_10_Lite: 'Ableton Live 10 Lite.app',
}

/** Known Ableton preferences directory paths on macOS. @type {Object.<string, string>} */
const LIVE_PREFS_PATHS = {
	Live_Preferences: '~/Library/Preferences/Ableton',
}

/**
 * @typedef {Object} PluginInfoMacOSConfig
 * @property {string} [default='/Library/Audio/Plug-Ins/'] - Base directory for system plug-ins.
 * @property {Object} [vst2] - VST2 configuration.
 * @property {boolean} [vst2.isEnabled] - Whether VST2 scanning is enabled.
 * @property {boolean} [vst2.isCustomPathEnabled] - Whether the VST2 custom path is active.
 * @property {string|null} [vst2.customPath] - Custom VST2 search path.
 * @property {Object} [vst3] - VST3 configuration.
 * @property {boolean} [vst3.isEnabled] - Whether VST3 scanning is enabled.
 * @property {boolean} [vst3.isCustomPathEnabled] - Whether the VST3 custom path is active.
 * @property {string|null} [vst3.customPath] - Custom VST3 search path.
 * @property {boolean} [au.enabled=false] - Whether Audio Units are enabled.
 */

/**
 * Discovers installed macOS audio plug-ins (VST2, VST3, and Audio Units).
 * Must be instantiated on macOS (darwin); throws otherwise.
 */
export class PluginInfoMacOS {
	/** macOS can have 64-bit vst plugins, including custom paths for them */
	#_vst = []
	#_vst3 = []
	#_au = []

	#_config = {
		default: '/Library/Audio/Plug-Ins/',
		vst2: {
			enabled: false,
			customEnabled: false,
			customPath: null,
		},
		vst3: {
			enabled: false,
			customEnabled: false,
			customPath: null,
		},
		customVst2: null,
		customVst3: null,
		au: {
			enabled: false,
		},
	}

	/**
	 * @param {PluginInfoMacOSConfig} config - Plug-in search configuration.
	 * @throws {Error} When not running on macOS.
	 */
	constructor(config) {
		this.platform = os.platform()
		if (this.platform !== 'darwin') {
			throw new Error('PluginInfoMacOS can only be used on macOS')
		}

		this.#_config = { ...this.#_config, ...config }
		;(async () => {
			this.#_vst = await this.getVst2Plugins()
			this.#_vst3 = await this.getVst3Plugins()
			this.#_au = await this.getAudioUnitPlugins()
		})()
	}

	/**
	 * Returns a snapshot of all discovered plug-in file paths, grouped by format.
	 * @type {{vst2: string[], vst3: string[], au: string[]}}
	 */
	get map() {
		return {
			vst2: this.#_vst,
			vst3: this.#_vst3,
			au: this.#_au,
		}
	}

	/**
	 * Re-scans all plug-in directories, bypassing the in-memory cache.
	 * @returns {Promise<void>}
	 */
	async refresh() {
		this.#_vst = await this.getVst2Plugins(false)
		this.#_vst3 = await this.getVst3Plugins(false)
		this.#_au = await this.getAudioUnitPlugins(false)
	}

	/**
	 * Returns the list of discovered VST2 plug-in file paths.
	 * @param {boolean} [cache=true] - When true, returns the cached result if available.
	 * @returns {Promise<string[]>} Absolute paths to `.vst` bundles.
	 */
	async getVst2Plugins(cache = true) {
		if (cache && this.#_vst.length > 0) {
			return this.#_vst
		}
		return await this.#_getPluginPaths('Vst')
	}

	/**
	 * Returns the list of discovered VST3 plug-in file paths.
	 * @param {boolean} [cache=true] - When true, returns the cached result if available.
	 * @returns {Promise<string[]>} Absolute paths to `.vst3` bundles.
	 */
	async getVst3Plugins(cache = true) {
		if (cache && this.#_vst3.length > 0) {
			return this.#_vst3
		}
		return await this.#_getPluginPaths('Vst3')
	}

	/**
	 * Returns the list of discovered Audio Unit plug-in file paths.
	 * @param {boolean} [cache=true] - When true, returns the cached result if available.
	 * @returns {Promise<string[]>} Absolute paths to `.component` bundles.
	 */
	async getAudioUnitPlugins(cache = true) {
		if (cache && this.#_au.length > 0) {
			return this.#_au
		}
		return await this.#_getPluginPaths('AudioUnit')
	}

	async #_getPluginPaths(pluginType) {
		let searchPaths = []
		if (pluginType === 'Vst') {
			if (this.#_config.vst2.isEnabled) {
				searchPaths = [this.#_config.default + 'VST/']
			}
			if (
				this.#_config.vst2.isCustomPathEnabled &&
				this.#_config.vst2.customPath
			) {
				searchPaths.push(this.#_config.vst2.customPath)
			}
		} else if (pluginType === 'Vst3') {
			if (this.#_config.vst3.isEnabled) {
				searchPaths = [this.#_config.default + 'VST3/']
			}

			if (
				this.#_config.vst3.isCustomPathEnabled &&
				this.#_config.vst3.customPath
			) {
				searchPaths.push(this.#_config.vst3.customPath)
			}
		} else if (pluginType === 'AudioUnit') {
			searchPaths = [this.#_config.default + 'Components/']
		}

		let pluginFiles = []

		for (const path of searchPaths) {
			try {
				const files = await fs.promises.readdir(path)
				const pluginFilesInPath = files
					.filter((file) =>
						file.endsWith(this.#_getPluginExtension(pluginType)),
					)
					.map((file) => path + file)
				pluginFiles.push(...pluginFilesInPath)
			} catch (err) {
				// Handle error if directory can't be read
				if (err) throw err
			}
		}

		return pluginFiles
	}

	#_getPluginExtension(pluginType) {
		if (pluginType === 'Vst') {
			return '.vst'
		} else if (pluginType === 'Vst3') {
			return '.vst3'
		} else if (pluginType === 'AudioUnit') {
			return '.component'
		}
	}
}

/**
 * @typedef {Object} LiveVersion
 * @property {string} version - The version string (e.g. `"12.0.5"`).
 * @property {string|null} build - The build identifier, or `null` if not present.
 */

/**
 * Retrieves information about Ableton Live installations on macOS.
 * Must be instantiated on macOS (darwin); throws otherwise.
 */
export class AbletonInfoMacOS {
	/**
	 * @throws {Error} When not running on macOS.
	 */
	constructor() {
		// console.log('os', os.platform())
		this.platform = os.platform()
		if (this.platform !== 'darwin') {
			throw new Error('AbletonInfoMacOS can only be used on macOS')
		}
	}

	/**
	 * The default directory where Ableton Live is installed on macOS.
	 * @type {string}
	 */
	get defaultInstallRoot() {
		return '/Applications/'
	}

	/**
	 * All installed Ableton Live versions found in the default install root.
	 * @type {LiveVersion[]}
	 */
	get installedVersions() {
		return this.getInstalledLiveVersions()
	}

	/**
	 * Returns the macOS product version string (e.g. `"14.5"`).
	 * @returns {string} The macOS version.
	 */
	getMacOSVersion() {
		return execSync('sw_vers -productVersion', { encoding: 'utf8' }).trim()
	}

	/**
	 * Scans a directory for installed Ableton Live app bundles and returns their versions.
	 * @param {string|null} [rootDirectory=null] - Directory to search; defaults to {@link defaultInstallRoot}.
	 * @returns {LiveVersion[]} Version info for each detected installation.
	 */
	getInstalledLiveVersions(rootDirectory = null) {
		if (!rootDirectory) {
			rootDirectory = this.defaultInstallRoot
		}

		let bundles = Object.values(LIVE_APP_BUNDLES).filter((appBundleName) => {
			const appPath = `${rootDirectory}${appBundleName}`
			try {
				execSync(`test -d "${appPath}"`)
				return true
			} catch {
				return false
			}
		})

		return bundles.map((appBundleName) => {
			const appPath = `${rootDirectory}${appBundleName}`
			return this.getLiveVersionFromAppBundle(appPath)
		})
	}

	/**
	 * Reads the version from an Ableton Live `.app` bundle's `Info.plist`.
	 * @param {string} appBundlePath - Absolute path to the `.app` bundle.
	 * @returns {LiveVersion} The version and build extracted from the bundle.
	 * @throws {Error} When the plist cannot be read or parsed.
	 */
	getLiveVersionFromAppBundle(appBundlePath) {
		try {
			const plistPath = `${appBundlePath}/Contents/Info.plist`
			const rawVersion = execSync(
				`plutil -extract CFBundleShortVersionString raw "${plistPath}"`,
				{ encoding: 'utf8' },
			).trim()

			let pieces = rawVersion.split(' (')

			return {
				version: pieces[0].trim(),
				build: pieces[1] ? pieces[1].replace(')', '').trim() : null,
			}
		} catch (error) {
			throw new Error(`Failed to get version from app bundle: ${error.message}`)
		}
	}
}

export default AbletonInfoMacOS

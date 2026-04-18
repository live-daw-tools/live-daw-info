import os from 'node:os'
import { execFile, exec, execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'

/**
 * Detects whether the current process is running inside Windows Subsystem for Linux (WSL).
 * @returns {boolean} `true` when running under WSL, `false` otherwise.
 */
export function isRunningInWsl() {
	const hasWslEnv =
		process.env.WSL_DISTRO_NAME || process.env.WSLENV ? true : false

	const isWsl = os.type() === 'Linux' && hasWslEnv
	return isWsl
}

/**
 * @typedef {Object} PluginInfoWin64Config
 * @property {Object} [vst2] - VST2 configuration overrides.
 * @property {boolean} [vst2.enabled] - Whether VST2 scanning is enabled.
 * @property {string[]} [vst2.systemPaths] - Default system search paths for VST2 plug-ins.
 * @property {boolean} [vst2.customEnabled] - Whether the VST2 custom path is active.
 * @property {string|null} [vst2.customPath] - Custom VST2 search path.
 * @property {Object} [vst3] - VST3 configuration overrides.
 * @property {boolean} [vst3.enabled] - Whether VST3 scanning is enabled.
 * @property {string[]} [vst3.systemPaths] - Default system search paths for VST3 plug-ins.
 * @property {boolean} [vst3.customEnabled] - Whether the VST3 custom path is active.
 * @property {string|null} [vst3.customPath] - Custom VST3 search path.
 */

/**
 * Discovers installed 64-bit Windows audio plug-ins (VST2 and VST3).
 * Must be instantiated on Windows or WSL; throws otherwise.
 */
export class PluginInfoWin64 {
	/** Windows can have 32-bit and 64-bit VST plugins, including custom paths for them */
	#_vst2 = []
	#_vst3 = []

	#_config = {
		vst2: {
			enabled: false,
			systemPaths: [
				'C:\\Program Files\\VSTPlugins',
				'C:\\Program Files\\Steinberg\\VSTPlugins',
			],
			customEnabled: false,
			customPath: null,
		},
		vst3: {
			enabled: false,
			systemPaths: ['C:\\Program Files\\Common Files\\VST3'],
			customEnabled: false,
			customPath: null,
		},
	}

	/**
	 * @param {PluginInfoWin64Config} [config={}] - Optional overrides for default search paths and flags.
	 * @throws {Error} When not running on Windows or WSL.
	 */
	constructor(config = {}) {
		this.platform = os.platform()
		this.isWsl = isRunningInWsl()

		if (this.platform !== 'win32' && this.isWsl === false) {
			throw new Error('PluginInfoWin64 can only be used on Windows')
		}

		// Deep merge config
		if (config.vst2) {
			this.#_config.vst2 = { ...this.#_config.vst2, ...config.vst2 }
		}
		if (config.vst3) {
			this.#_config.vst3 = { ...this.#_config.vst3, ...config.vst3 }
		}

		;(async () => {
			this.#_vst2 = await this.getVst2Plugins()
			this.#_vst3 = await this.getVst3Plugins()
		})()
	}

	/**
	 * Returns a snapshot of all discovered plug-in file paths, grouped by format.
	 * @type {{vst2: string[], vst3: string[]}}
	 */
	get map() {
		return {
			vst2: this.#_vst2,
			vst3: this.#_vst3,
		}
	}

	/**
	 * Re-scans all plug-in directories, bypassing the in-memory cache.
	 * @returns {Promise<void>}
	 */
	async refresh() {
		this.#_vst2 = await this.getVst2Plugins(false)
		this.#_vst3 = await this.getVst3Plugins(false)
	}

	/**
	 * Returns the list of discovered VST2 plug-in file paths.
	 * @param {boolean} [cache=true] - When true, returns the cached result if available.
	 * @returns {Promise<string[]>} Absolute paths to `.dll` plug-in files.
	 */
	async getVst2Plugins(cache = true) {
		if (cache && this.#_vst2.length > 0) {
			return this.#_vst2
		}
		return await this.#_getPluginPaths('Vst2')
	}

	/**
	 * Returns the list of discovered VST3 plug-in file paths.
	 * @param {boolean} [cache=true] - When true, returns the cached result if available.
	 * @returns {Promise<string[]>} Absolute paths to `.vst3` plug-in files.
	 */
	async getVst3Plugins(cache = true) {
		if (cache && this.#_vst3.length > 0) {
			return this.#_vst3
		}
		return await this.#_getPluginPaths('Vst3')
	}

	async #_getPluginPaths(pluginType) {
		let searchPaths = []

		if (pluginType === 'Vst2') {
			if (this.#_config.vst2.enabled) {
				searchPaths.push(...this.#_config.vst2.systemPaths)
			}
			if (this.#_config.vst2.customEnabled && this.#_config.vst2.customPath) {
				searchPaths.push(this.#_config.vst2.customPath)
			}
		} else if (pluginType === 'Vst3') {
			if (this.#_config.vst3.enabled) {
				searchPaths.push(...this.#_config.vst3.systemPaths)
			}
			if (this.#_config.vst3.customEnabled && this.#_config.vst3.customPath) {
				searchPaths.push(this.#_config.vst3.customPath)
			}
		}

		let pluginFiles = []

		for (const path of searchPaths) {
			try {
				const files = await fs.readdir(path)
				const pluginFilesInPath = files
					.filter((file) =>
						file.endsWith(this.#_getPluginExtension(pluginType)),
					)
					.map((file) => {
						const separator = path.endsWith('\\') ? '' : '\\'
						return path + separator + file
					})
				pluginFiles.push(...pluginFilesInPath)
			} catch (err) {
				// Handle error if directory can't be read (e.g., doesn't exist)
				// Silently continue to the next path
			}
		}

		return pluginFiles
	}

	#_getPluginExtension(pluginType) {
		if (pluginType === 'Vst2') {
			return '.dll'
		} else if (pluginType === 'Vst3') {
			return '.vst3'
		}
	}
}

/**
 * @typedef {Object} WindowsVersionInfo
 * @property {number} majorVersion - The Windows major version number.
 * @property {number} buildNumber - The OS build number.
 * @property {string} productName - Human-readable product name (`"Windows 10"` or `"Windows 11"`).
 */

/**
 * Retrieves information about Ableton Live installations on 64-bit Windows.
 * Also works when running inside WSL. Throws on other platforms.
 */
export class AbletonInfoWin64 {
	/** Known Ableton Live paths on Windows. @type {Object} */
	LIVE_PATHS = {
		Live_Preferences: false, // ????
		Install_Root: 'C:\\ProgramData\\Ableton',
		Executables: {
			'Live 12 Suite':
				'C:\\ProgramData\\Ableton\\Live 12 Suite\\Program\\Ableton Live 12 Suite.exe',
			'Live 12 Standard':
				'C:\\ProgramData\\Ableton\\Live 12 Standard\\Program\\Ableton Live 12 Standard.exe',
			'Live 11 Suite':
				'C:\\ProgramData\\Ableton\\Live 11 Suite\\Program\\Ableton Live 11 Suite.exe',
			'Live 11 Standard':
				'C:\\ProgramData\\Ableton\\Live 11 Standard\\Program\\Ableton Live 11 Standard.exe',
			'Live 10 Suite':
				'C:\\ProgramData\\Ableton\\Live 10 Suite\\Program\\Ableton Live 10 Suite.exe',
			'Live 10 Standard':
				'C:\\ProgramData\\Ableton\\Live 10 Standard\\Program\\Ableton Live 10 Standard.exe',
		},
	}

	/**
	 * @param {Object} [config={}] - Reserved for future configuration options.
	 * @throws {Error} When not running on Windows or WSL.
	 */
	constructor(config = {}) {
		// console.log('os', os.platform())
		this.platform = os.platform()
		this.isWsl = isRunningInWsl()
		this.username = os.userInfo().username

		this.LIVE_PATHS.Live_Preferences = `C:\\Users\\${this.username}\\AppData\\Roaming\\Ableton`

		// console.log('wsl?', this.isWsl, 'platform', this.platform)

		if (this.platform !== 'win32' && this.isWsl === false) {
			throw new Error(
				'AbletonInfoWin64 can only be used on Windows operating systems',
			)
		}
	}

	// async get installedVersions() {
	// 	return await this._getAbletonInstallations()
	// }

	/**
	 * Enumerates Ableton Live installations found under `LIVE_PATHS.Install_Root`.
	 * @returns {Promise<string|Array>} An array of version promises, or an error message string
	 *   if the install root does not exist.
	 */
	async _getAbletonInstallations() {
		let dirs = []
		try {
			await fs.access(this.LIVE_PATHS.Install_Root)
		} catch (Err) {
			return `Install root path not found: ${this.LIVE_PATHS.Install_Root}, is Ableton Live installed?`
		}

		let arr = await fs.readdir(this.LIVE_PATHS.Install_Root)

		let versionMap = arr.map(async (version) => {
			if (this.LIVE_PATHS.Executables[version]) {
				return await this._getAbletonVersionFromExe(
					this.LIVE_PATHS.Executables[version],
				)
			}
		})

		return await versionMap
	}

	/**
	 * Returns Windows version information derived from `os.release()`.
	 * @returns {WindowsVersionInfo}
	 * @throws {Error} When the detected Windows build number is below 10240 (pre-Windows 10).
	 */
	getWindowsVersion() {
		let strRelease = os.release()
		let majorVersion = parseInt(strRelease.split('.')[0], 10)
		let buildNumber = parseInt(strRelease.split('.')[2], 10)

		if (buildNumber < 10240) {
			throw new Error(
				`Unsupported Windows version: ${strRelease}. This library only supports Windows 10 and 11.`,
			)
		}

		// Windows 10 has build numbers starting from 10240, while Windows 11 starts from 26000
		let productName = buildNumber >= 26000 ? 'Windows 11' : 'Windows 10'

		return {
			majorVersion,
			buildNumber,
			productName,
		}
	}

	/**
	 * Retrieves the product version of an Ableton Live executable via PowerShell.
	 * @param {string} exePath - Absolute path to the `.exe` file.
	 * @returns {Promise<string|null>} The version string, or `null` on failure.
	 */
	async getLiveVersionFromExe(exePath) {
		try {
			const command = `"(Get-Item '${exePath}').VersionInfo.ProductVersion"`
			return await runPowerShellCommand(command)
		} catch (Err) {
			console.error(`Error getting version from ${exePath}:`, Err)
			return null
		}
	}
}

/**
 * Executes a PowerShell command synchronously and returns its trimmed output.
 * @param {string} command - The PowerShell command string to execute.
 * @returns {string} The stdout output, trimmed of surrounding whitespace.
 * @throws {Error} When PowerShell exits with a non-zero status.
 */
export function runPowerShellCommand(command) {
	try {
		let result = execSync(
			`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ${command}`,
			{ windowsHide: true },
		)

		return result.toString().trim()
	} catch (Err) {
		throw Err
	}
}

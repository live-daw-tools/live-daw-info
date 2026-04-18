import fs from 'node:fs/promises'
import _ from 'lodash-es'
import { platform } from 'node:os'
import path from 'node:path'

/**
 * @typedef {Object} VstPluginConfig
 * @property {boolean} isEnabled - Whether the plug-in format is enabled in Ableton Live.
 * @property {string|null} customPath - The user-configured custom search path, or `null`.
 * @property {boolean|null} isCustomPathEnabled - Whether the custom path is active, or `null` when undetermined.
 */

/**
 * @typedef {Object} AuPluginConfig
 * @property {boolean} isEnabled - Whether Audio Units are enabled in Ableton Live.
 */

/**
 * @typedef {Object} PluginConfig
 * @property {VstPluginConfig} vst3 - VST3 plug-in configuration.
 * @property {VstPluginConfig} vst2 - VST2 plug-in configuration.
 * @property {AuPluginConfig} au - Audio Unit configuration.
 */

/**
 * Parses an Ableton Live binary preferences file to extract plug-in configuration.
 *
 * The constructor is async: it must be `await`-ed to get a fully initialised instance.
 *
 * @example
 * const prefs = await new AbletonPrefs('/path/to/Ableton/Live 12.0.0/Preferences.cfg')
 * console.log(prefs.PluginConfig)
 */
export class AbletonPrefs {
	#_bytes = null
	#_text = null
	#_vst3Config = null
	#_auConfig = null
	#_vst2Config = null
	#_bytesSegment = null
	#_strSegment = null
	#_os = null

	/**
	 * @param {string} path - Absolute path to the Ableton Live preferences file.
	 * @returns {Promise<AbletonPrefs>} A fully initialised `AbletonPrefs` instance.
	 * @throws {Error} When the file does not exist or cannot be read.
	 */
	constructor(path) {
		this.path = path
		this.os = platform()
		return (async () => {
			try {
				await fs.access(path)
			} catch (Err) {
				throw new Error(`File not found: ${path}`)
			}

			// grab the bytes as Uint8Array from the filesystem
			this.#_bytes = await fs.readFile(path)
			// convert a text representation of the bytes, easier for simpler processing
			this.#_text = new TextDecoder('utf-8').decode(this.#_bytes)

			this.#_strSegment = this.#_getPluginManagerSegment(this.#_text)

			return this
		})()
	}

	/**
	 * Aggregated plug-in configuration parsed from the preferences file.
	 * Triggers parsing of VST3, VST2, and AU sections on first access.
	 * @type {PluginConfig}
	 */
	get PluginConfig() {
		this.getVst3Configuration()
		this.getVst2Configuration()
		this.getAuConfiguration()

		return {
			vst3: this.#_vst3Config,
			vst2: this.#_vst2Config,
			au: this.#_auConfig,
		}
	}

	/**
	 * The raw bytes of the preferences file as a `Uint8Array`.
	 * @type {Uint8Array}
	 */
	get bytes() {
		return this.#_bytes
	}

	/**
	 * Parses and returns the Audio Unit configuration from the preferences file.
	 * @returns {AuPluginConfig}
	 */
	getAuConfiguration() {
		this.#_auConfig = {
			isEnabled: this.#_strSegment.includes('AuFolder'),
		}

		return this.#_auConfig
	}

	/**
	 * Parses and returns the VST2 plug-in configuration from the preferences file.
	 *
	 * @warning This method currently fails on Windows.
	 *   Edge cases not yet handled:
	 *   - VST2 system path disabled but custom directory enabled
	 *   - VST2 system path enabled but custom directory disabled
	 *
	 * @returns {VstPluginConfig}
	 */
	getVst2Configuration() {
		// does the segment include PlugScanInfo data?
		const isEnabled = this.#_strSegment.includes('PlugScanInfo')
		let vstIndexes = this.findAllOccurrences('VstManager', this.#_bytes)
		let segment = this.#_bytes.slice(vstIndexes[1], vstIndexes[1] + 300)
		let _str = this.bytesToStringArr(segment)

		let customPath = null,
			isCustomPathEnabled = null

		if (segment[14] === 0) {
			isCustomPathEnabled = false
		} else if (segment[14] === 28 || segment[14] === 41) {
			isCustomPathEnabled = true
			customPath = this.extractVst2CustomPath(segment)
		}

		this.#_vst2Config = {
			isEnabled,
			customPath,
			isCustomPathEnabled,
		}

		return this.#_vst2Config
	}

	/**
	 * Extracts a VST3 custom search path from a byte slice of the preferences file.
	 * Works for both macOS and Windows preferences files.
	 *
	 * Windows example: `Vst3Preferences\x02\x01\x01)C:/Users/aniso/OneDrive/Desktop/hack/vst3\x15`
	 * macOS example:   `Vst3Preferences\x02\x01\x01#/Users/jeff/Desktop/tmp/vst3-custom\x15`
	 *
	 * @param {Uint8Array} bytes - A byte slice starting at the `Vst3Preferences` marker.
	 * @returns {string|false} The extracted path string, or `false` when no custom path is set.
	 */
	extractVst3CustomPath(bytes) {
		// console.log('bytes', bytes)

		let textSegment = this.bytesToStringArr(bytes)
		let filtered = textSegment.filter((char) => {
			if (char !== '\\x00') return true
		})

		let _filtered = filtered.join('')

		// console.log('filtered', _filtered)

		// Unified regex that matches both Windows and macOS paths
		// - Windows: C:/path/to/folder or C:\path\to\folder (with support for spaces and colons in path)
		// - macOS: /path/to/folder
		// Both terminated by \x15
		const regex = /(?:[)#])([A-Z]:[\/\\][\w\/\\\-\s:]+?|\/[\w\/\-\s]+?)\\x15/

		const match = regex.exec(_filtered)

		// console.log('match!', match)

		if (match && match[1]) {
			return match[1]
		} else {
			return false
		}
	}

	/**
	 * Extracts a VST2 custom search path from a byte slice of the preferences file.
	 *
	 * @warning This method currently fails on Windows.
	 *
	 * @param {Uint8Array} bytes - A byte slice starting at the second `VstManager` marker.
	 * @returns {string|undefined} The extracted path string, or `undefined` when no custom path is found.
	 */
	extractVst2CustomPath(bytes) {
		let textSegment = this.bytesToStringArr(bytes)
		let match = null

		let filtered = textSegment
			.filter((char) => {
				if (char !== '\\x00') return true
			})
			.join('')

		if (bytes[14] === 0) {
			return null
		} else if (bytes[14] === 28) {
			match = filtered.match(/(\/[\w\/\-]+?)\\x01/)
		} else if (bytes[14] === 41) {
			match = filtered.match(/\)(C\:\/[\w\/]+?)\)/)
		}

		if (match) {
			return match[1]
		}
	}

	/**
	 * Parses and returns the VST3 plug-in configuration from the preferences file.
	 * @returns {VstPluginConfig}
	 * @throws {Error} When the byte at index 15 of the VST3 segment has an unexpected value.
	 */
	getVst3Configuration() {
		// segment for vst3 detection
		let indexes = this.findAllOccurrences('Vst3Preferences', this.#_bytes)
		let bytes = this.#_bytes.slice(indexes[1], indexes[1] + 200)

		if (!bytes[15] === 2) {
			throw new Error('Unexpected byte value at index 15, expected 2')
		}

		const SYSTEM_ENABLED_BYTE = 19
		const CUSTOM_ENABLED_BYTE = 20

		const isEnabled = bytes[SYSTEM_ENABLED_BYTE] === 1
		const isCustomPathEnabled = bytes[CUSTOM_ENABLED_BYTE] === 1

		let customPath = this.extractVst3CustomPath(bytes)

		this.#_vst3Config = {
			isEnabled,
			isCustomPathEnabled,
			customPath,
		}

		return this.#_vst3Config
	}

	/**
	 * Converts a `Uint8Array` (or any byte-like array) to an array of strings where
	 * printable ASCII characters (32–126) are represented as themselves and all other
	 * bytes are represented as hex escape sequences (e.g. `\x0f`).
	 *
	 * @param {Uint8Array} bytes - The bytes to convert.
	 * @param {Object} [options={}] - Formatting options.
	 * @param {string} [options.hexPrefix='\\x'] - Prefix for non-printable bytes (e.g. `'0x'`, `'%'`).
	 * @param {boolean} [options.lowercase=true] - When `true`, hex digits are lowercased.
	 * @returns {string[]} Array of character or hex-escape strings, one element per byte.
	 */
	bytesToStringArr(bytes, options = {}) {
		const {
			hexPrefix = '\\x', // alternatives: '0x', '%'
			lowercase = true,
		} = options

		let out = []

		bytes.forEach((byte) => {
			// Printable ASCII characters: 32-126
			// console.log('byte', byte)
			if (byte >= 32 && byte <= 126) {
				// console.log('str', String.fromCharCode(byte))
				out.push(String.fromCharCode(byte))
				// return String.fromCharCode(byte)
			} else {
				// Non-printable: convert to hex
				const hex = byte.toString(16).padStart(2, '0')
				// console.log('hex', hex)
				out.push(`${hexPrefix}${lowercase ? hex : hex.toUpperCase()}`)
			}
		})

		return out
	}

	/**
	 * Finds all byte-offsets at which the UTF-8 encoding of `needle` appears in `bytes`.
	 * Overlapping matches are skipped (each match advances past the full pattern length).
	 *
	 * @param {string} needle - The string pattern to search for.
	 * @param {Uint8Array} bytes - The buffer to search within.
	 * @returns {number[]} Array of starting byte offsets where `needle` was found.
	 */
	findAllOccurrences(needle, bytes) {
		const pattern = new TextEncoder().encode(needle)
		const matches = []

		outer: for (let i = 0; i <= bytes.length - pattern.length; i++) {
			for (let j = 0; j < pattern.length; j++) {
				if (bytes[i + j] !== pattern[j]) continue outer
			}
			matches.push(i)
			i += pattern.length - 1 // skip ahead (optional: remove to find overlapping matches)
		}

		return matches
	}

	#_getPluginManagerSegment() {
		const segmentStart = this.#_text.indexOf('PluginManager')
		if (segmentStart === -1) {
			throw new Error('PluginManager segment not found')
		}

		const segmentEnd = this.#_text.indexOf('SongPrefData', segmentStart)

		return this.#_text.slice(segmentStart, segmentEnd)
	}
}

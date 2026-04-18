import _ from 'lodash-es'

/**
 * General-purpose utility class.
 * The constructor is async: it must be `await`-ed to get a fully initialised instance.
 */
export class Utils {
	/**
	 * @param {Object} [options={}] - Configuration options passed to the utility instance.
	 * @returns {Promise<Utils>} A fully initialised `Utils` instance.
	 */
	constructor(options) {
		this.options = options || {}
		return (async () => {
			// console.log('options', this.options)
			return this
		})()
	}
}

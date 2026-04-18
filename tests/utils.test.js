import { Utils } from '../lib/utils.js'

test('the utils library', async () => {
	let instance = await new Utils({
		foo: 'bar',
		bar: 'baz',
		baz: 'qux',
	})
	expect(instance.options.foo).toBe('bar')
})

test('Utils with no options defaults to empty object', async () => {
	let instance = await new Utils()
	expect(instance.options).toEqual({})
})

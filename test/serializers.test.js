const assert = require('assert')
const cacheManager = require('cache-manager')
const sqliteStore = require('../index')

describe('cacheManager serializers', () => {
    it('supports CBOR', async () => {
        const cache = cacheManager.caching({
            store: sqliteStore,
            options: { serializer: 'cbor' }
        })

        await cache.set("foo", {foo: "bar", arr: [1, true, null]})
        assert.deepEqual(await cache.get("foo"), {foo: "bar", arr: [1, true, null]})
    })

    it('supports JSON', async () => {
        const cache = cacheManager.caching({
            store: sqliteStore,
            options: { serializer: 'json' }
        })

        await cache.set("foo", {foo: "bar", arr: [1, true, null]})
        assert.deepEqual(await cache.get("foo"), {foo: "bar", arr: [1, true, null]})
    })
})

describe('cacheManager custom serializers', () => {
    it('Bad serializer does not save', async () => {
        const cache = cacheManager.caching({
            store: sqliteStore,
            options: { 
                serializer: {
                    serialize: () => { 
                        throw new Error('Fake error') 
                    },
                    deserialize: () => {
                        throw new Error('Fake error') 
                    }
                }
            }
        })

        await cache.set("foo", {foo: "bar", arr: [1, true, null]})
        assert.deepEqual(await cache.get("foo"), null)
    })

    it('supports JSON', async () => {
        const cache = cacheManager.caching({
            store: sqliteStore,
            options: { serializer: 'json' }
        })

        await cache.set("foo", {foo: "bar", arr: [1, true, null]})
        assert.deepEqual(await cache.get("foo"), {foo: "bar", arr: [1, true, null]})
    })
})
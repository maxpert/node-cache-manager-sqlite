# SQLite store for node cache manager

A modern SQlite cache store for [node-cache-manager](https://github.com/BryanDonovan/node-cache-manager). Featuring:

 - Async SQLite3 using [sqlite3](https://github.com/TryGhost/node-sqlite3)
 - `async`/`await` support with Promise
 - 100% test coverage and production ready
 - Optimized `mset`/`mget` support
 - Supports CBOR for efficient and fast storage (selectable between `json` or `cbor` default: `json`)
 - Support for custom serializers
 - Smart purging support, no configuration required

## Installation

```
npm i cache-manager-sqlite
```

## Requirements

 - SQLite 3 with [sqlite3 package](https://github.com/TryGhost/node-sqlite3)
 - Node 14+

## Usage

## Single store
```js
const sqliteStore = require('cache-manager-sqlite')
const cacheManager = require('cache-manager')

// SQLite :memory: cache store
const memStoreCache = cacheManager.caching({
    store: sqliteStore,
    serializer: 'cbor', // default is 'json'
    ttl: 20 // TTL in seconds
})

// On disk cache on employees table
const cache = cacheManager.caching({
    store: sqliteStore,
    name: 'employees',
    path: '/tmp/cache.db'
})


// TTL in seconds
await cache.set('foo', {test: 'bar'}, {ttl: 10})
const value = await cache.get('foo')
```

### Multi-store example:

```js
const cacheManager = require('cache-manager')
const redisStore = require('cache-manager-ioredis')
const sqliteStore = require('cache-manager-sqlite')

const redisCache = cacheManager.caching({ store: redisStore, db: 0, ttl: 600 })
const sqliteCache = cacheManager.caching({ store: sqliteStore, path: '/cache.db', name: 'users', ttl: 600 })

const multiCache = cacheManager.multiCaching([sqliteCache, redisCache])

// Basic get/set
await multiCache.set('foo2', 'bar2', { ttl: customTTL })
const v = await multiCache.get('foo2')

// Wrap call example
const userId = 'user-1'

// Optionally pass ttl
await multiCache.wrap(userId, { ttl: customTTL }, async () => {
    console.log("Calling expensive service")
    await getUserFromExpensiveService(userId)
})

// set and get multiple
await multiCache.mset('foo1', 'bar1', 'foo0', 'bar0') //Uses default TTL
await multiCache.mset('foo1', 'bar1', 'foo3', 'bar3', {ttl: customTTL})
await multiCache.mget('foo1', 'foo3')
```

## License

The `node-cache-manager-sqlite` is licensed under the MIT license.

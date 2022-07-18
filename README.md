# SQLite store for node cache manager

A modern SQlite cache store for [node-cache-manager](https://github.com/BryanDonovan/node-cache-manager). Featuring:

 - Async SQLite3 using [sqlite3](https://github.com/TryGhost/node-sqlite3)
 - `async`/`await` support with Promise
 - 100% test coverage and production ready
 - Optimized `mset`/`mget` support
 - Smart purging support (no configuration required)

## Installation

```
npm i cache-manager-sqlite
```

## Requirements

 - SQLite 3 with [sqlite3 package](https://github.com/TryGhost/node-sqlite3)
 - Node 14+

## Usage

```js
const sqliteStore = require('cache-manager-sqlite')
const cacheManager = require('cache-manager')

// SQLite :memory: cache store
const memStoreCache = cacheManager.caching({
    store: sqliteStore
})

// On disk cache on employees table
const cache = cacheManager.caching({
    store: sqliteStore,
    name: 'employees',
    path: '/tmp/cache.db'
})


await cache.set('foo', {test: 'bar'}, {ttl: 10000})
const valu = await cache.get('foo')
// value = {test: 'bar'} here
```

## License

The `node-cache-manager-sqlite` is licensed under the MIT license.

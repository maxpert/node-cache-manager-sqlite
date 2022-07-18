const sqlite = require('sqlite3')
const util = require('util')

const ConfigurePragmas = `
PRAGMA main.synchronous = NORMAL;
PRAGMA main.journal_mode = WAL;
`
const CreateTableStatement = `
CREATE TABLE IF NOT EXISTS %s (
    key TEXT PRIMARY KEY, 
    val BLOB, 
    created_at INTEGER, 
    expire_at INTEGER
);
CREATE INDEX IF NOT EXISTS index_expire_%s ON %s(expire_at);
`
const SelectKeyStatementPrefix = "SELECT * FROM %s WHERE key IN "
const UpsertStatement = "INSERT OR REPLACE INTO %s(key, val, created_at, expire_at) VALUES ($key, $val, $created_at, $expire_at)"
const DeleteStatement = "DELETE FROM %s WHERE key IN ($keys)"
const TruncateStatement = "DELETE FROM %s"
const PurgeExpiredStatement = "DELETE FROM %s WHERE expire_at < $ts"

function now() {
    return new Date().getTime()
}

function liftFirst(type, ...args) {
    return args.find(t => typeof t === type)
}

function liftCallback(...args) {
    return liftFirst('function', ...args)
}

/**
 * Promisified allows `run` to execute in a promise agnostic way, allowing compatibility with callbacks.
 * This will allow us to act like callback async when callback is passed in `cb`, otherwise otherwise
 * returns a completable promise that is filled by `run`
 */
function promisified(cb, run) {
    if (cb) {
        return run(cb)
    }

    return new Promise((ok, fail) => {
        const pcb = (e, v) => e ? fail(e) : ok(v)
        return run(pcb)
    })
}

/**
 * @typedef {object} SqliteOpenOptions
 * @property {function} onOpen callback function when database open if failure or success
 * @property {function} onReady callback function when database table for key-value space has been created
 * @property {number} flags sqlite3 open flags for database file
 */

class SqliteCacheAdapter {
    /**
     * @property {sqlite.Database} db for db instance
     */
    db = null
    #name = null
    #default_ttl = 24 * 60 * 60 * 1000

    /**
     * @param {string} name of key-value space
     * @param {string} path of database file
     * @param {SqliteOpenOptions} options for opening database
     */
    constructor(name, path, options) {
        const mode = options.flags || (sqlite.OPEN_CREATE | sqlite.OPEN_READWRITE)
        this.#name = name
        this.#default_ttl = options.ttl === undefined ? this.#default_ttl : options.ttl

        this.db = new sqlite.Database(path, mode, options.onOpen)
        this.db.serialize(() => {
            const stmt = ConfigurePragmas + util.format(CreateTableStatement, name, name, name)
            this.db.exec(stmt, options.onReady)
        })
    }

    _fetch_all(keys, cb) {
        this.db.serialize(() => {
            const holders = '?'.repeat(keys.length).split('').join(', ')
            const postFix = `(${holders})`
            const stmt = util.format(SelectKeyStatementPrefix + postFix, this.#name)
            this.db.all(stmt, keys, (err, rows) => {
                if (err) {
                    return cb(err)
                }

                cb(null, rows)
            })
        })
    }

    mget(keys, options, callback) {
        return promisified(liftCallback(options, callback), cb => {
            const ts = now()
            this._fetch_all(keys, (err, rs) => {
                if (err) {
                    return cb(err)
                }
    
                const rows = rs.filter(r => r.expire_at > ts)
                
                // Schedule cleanup for expired rows
                if (rows.length < rs.length) {
                    process.nextTick(() => this.#purgeExpired())
                }

                return cb(null, rows.map(row => this.#deserialize(row.val)))
            })
        })
    }

    get(key, options, callback) {
        return promisified(liftCallback(options, callback), cb => {
            const opts = liftFirst('object', options) || {}
            this.mget([key], opts, (err, rows) => {
                if (err) {
                    return cb(err)
                }

                const rs = rows.length > 0 ? rows[0] : null
                return cb(null, rs)
            })
        })
    }

    set(key, value, ttl, options, callback) {
        callback = liftCallback(ttl, options, callback)
        options = liftFirst('object', ttl, options) || {}
        ttl = liftFirst('number', ttl) || options.ttl || this.#default_ttl

        return promisified(callback, cb => {
            this.db.serialize(() => {
                const stmt = util.format(UpsertStatement, this.#name)
                const ts = now()
                const binding = {$key: key, $val: this.#serialize(value), $created_at: ts, $expire_at: ts + ttl}
    
                this.db.run(stmt, binding, function (err) {
                    const {lastID, changes} = this
                    return cb(err, {lastID, changes})
                })
            })
        })
    }

    del(key, options, callback) {
        return promisified(liftCallback(options, callback), cb => {
            this.db.serialize(() => {
                const stmt = util.format(DeleteStatement, this.#name)
                const binding = {$keys: [key]}
    
                this.db.run(stmt, binding, function (err) {
                    cb(err)
                })
            })
        })
    }

    reset(callback) {
        return promisified(liftCallback(callback), cb => {
            this.db.serialize(() => {
                const stmt = util.format(TruncateStatement, this.#name)
                this.db.run(stmt, {}, function (err) {
                    cb(err)
                })
            })
        })
    }

    ttl(key, callback) {
        return promisified(callback, cb => {
            this._fetch_all([key], (err, rows) => {
                if (err) {
                    return cb(err)
                }

                if (rows.length < 1) {
                    return cb(null, -1)
                }
    
                cb(null, rows[0].expire_at - now())
            })
        })
    }

    #serialize(obj) {
        return JSON.stringify(obj)
    }

    #deserialize(payload) {
        try {
            return JSON.parse(payload)
        } catch(e) {
            return null
        }
    }

    #purgeExpired() {
        this.db.serialize(() => {
            const stmt = util.format(PurgeExpiredStatement, this.#name)
            const ts = now()
            this.db.run(stmt, {$ts: ts})
        })
    }
}

/**
 * @typedef {object} SqliteCacheAdapterArgs
 * @property {string} name of key-value space
 * @property {string} path of database
 * @property {SqliteOpenOptions} flags sqlite3 open flags for database file
 */
module.exports = {
    create: function (args) {
        return new SqliteCacheAdapter(args.name || 'kv', args.path || ':memory:', args.options || {})
    }
}
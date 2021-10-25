const path = require('path')
require('dotenv').config({ path: path.resolve(`${__dirname}/../../../../../.env`) })
 
module.exports = {
    app: {
        blockSynchIntervalMs: parseInt(process.env.BLOCK_SYNCH_INTERVAL_MS)
    },
    rpc: {
        uri: process.env.RPC_URI,
        username: process.env.RPC_USERNAME,
        password: process.env.RPC_PASSWORD,
        requestTimeoutMs: parseInt(process.env.RPC_REQUEST_TIMEOUT_MS)
    },
    db: {
        host: process.env.DB_HOST,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        databaseName: process.env.DB_NAME
    }
}
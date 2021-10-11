const path = require('path')
require('dotenv').config({ path: path.resolve(`${__dirname}/../../../../.env`) })
 
module.exports = {
    rpc: {
        uri: process.env.RPC_URI,
        username: process.env.RPC_USERNAME,
        password: process.env.RPC_PASSWORD
    },
    db: {
        host: process.env.DB_HOST,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        databaseName: process.env.DB_NAME
    }
}
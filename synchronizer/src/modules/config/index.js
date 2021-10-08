module.exports = {
    rpc: {
        uri: process.env.RPC_URI,
        username: process.env.RPC_USERNAME,
        password: process.env.RPC_PASSWORD
    },
    db: {
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        databaseName: process.env.DB_NAME
    }
}
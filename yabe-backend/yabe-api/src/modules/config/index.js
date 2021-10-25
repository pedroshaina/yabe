module.exports = {
    server: {
        port: parseInt(process.env.EXPLORER_API_PORT)
    },
    db: {
        host: process.env.DB_HOST,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        databaseName: process.env.DB_NAME
    }
}
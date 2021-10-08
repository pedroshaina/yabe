// Update with your config settings.

const appConfig = require('./modules/config')

module.exports = {

  development: {
    client: 'pg',
    connection: {
      database: appConfig.db.databaseName,
      user: appConfig.db.username,
      password: appConfig.db.password
    }
  }

};

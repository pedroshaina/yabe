// Update with your config settings.
const appConfig = require('./modules/config')
const { knexSnakeCaseMappers } = require('./modules/db/utils/identifierMapping')

module.exports = {

  development: {
    client: 'pg',
    connection: {
      host: appConfig.db.host,
      database: appConfig.db.databaseName,
      user: appConfig.db.username,
      password: appConfig.db.password
    },
    migrations: {
      tableName: 'knex_migrations', 
      directory: `${__dirname}/modules/db/migrations`
    },

    ...knexSnakeCaseMappers()
  }

};

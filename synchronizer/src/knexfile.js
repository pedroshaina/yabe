// Update with your config settings.
const appConfig = require('./modules/config')
const { knexSnakeCaseMappers } = require('./modules/db/utils/identifierMapping')
const pg = require('pg')

pg.types.setTypeParser(pg.types.builtins.INT8, parseInt)
pg.types.setTypeParser(pg.types.builtins.FLOAT8, parseFloat)
pg.types.setTypeParser(pg.types.builtins.NUMERIC, parseFloat)

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
    useNullAsDefault: true,

    ...knexSnakeCaseMappers()
  }

};

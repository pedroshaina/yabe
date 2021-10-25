// Update with your config settings.
const pg = require('pg')

const appConfig = require('../config')
const { knexSnakeCaseMappers } = require('./utils/identifierMapping')

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
      directory: `${__dirname}/migrations`
    },
    useNullAsDefault: true,

    ...knexSnakeCaseMappers() //maps snake_case => camelCase once querying and camelCase => snake_case once modifying the db.
  }

};

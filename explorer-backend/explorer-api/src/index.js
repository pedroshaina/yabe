const express = require('express')
const cors = require('cors')

const appConfig = require('./modules/config')

const knex = require('./modules/db/knex')

const blockDao = require('./modules/db/dao/block')(knex)
const transactionDao = require('./modules/db/dao/transaction')(knex)

const blockService = require('./modules/service/block')(blockDao)
const transactionService = require('./modules/service/transaction')(transactionDao)

const blocksController = require('./modules/controller/blocks')(blockService)
const transactionsController = require('./modules/controller/transactions')(transactionService)

const routes = require('./modules/route')

const app = express()

app.use(cors())
app.use(express.json())

app.use(routes(blocksController, transactionsController))

const port = appConfig.server.port || 8080 

app.listen(port, () => {
    console.log(`Server up! Listening on ${port}`)
})


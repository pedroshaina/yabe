const logger = require('./modules/logger')

const synchronizerFactory = require('./modules/service/synchronizer-service')

const knex = require('./modules/db/knex')
const appConfig = require('./modules/config')
const bitcoinRpc = require('./modules/bitcoin-rpc')

const dbTrxManager = require('./modules/db/utils/dbTrxManager')(knex)
const blockDao = require('./modules/db/dao/block')(knex, logger)
const transactionDao = require('./modules/db/dao/transaction')(knex, logger)

const synchronizer = synchronizerFactory(blockDao, transactionDao, bitcoinRpc, dbTrxManager)


let timerId = setTimeout(synch = async () => {
    try {
        await synchronizer.synchronize()
        timerId = setTimeout(synch, appConfig.app.blockSynchIntervalMs)        
    } catch (err) {
        logger.error('Error while attempting to index block... scheduling a new attempt.  ', err)
        timerId = setTimeout(synch, appConfig.app.blockSynchIntervalMs)
    }
}, appConfig.app.blockSynchIntervalMs)
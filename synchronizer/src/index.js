const logger = require('./modules/logger')

const synchronizerFactory = require('./modules/service/synchronizer-service')

const appConfig = require('./modules/config')
const blockDao = require('./modules/db/dao/block')
const transactionDao = require('./modules/db/dao/transaction')
const bitcoinRpc = require('./modules/bitcoin-rpc')
const dbTrxManager = require('./modules/db/utils/dbTrxManager')

const synchronizer = synchronizerFactory(blockDao, transactionDao, bitcoinRpc, dbTrxManager)


let timerId = setTimeout(synch = async () => {
    try {
        await synchronizer.synchronize()
        timerId = setTimeout(synch, appConfig.app.blockSynchIntervalMs)        
    } catch (err) {
        logger.error(`Error while attempting to index block... scheduling a new attempt. Reason: ${err.message}`, {...err})
        timerId = setTimeout(synch, appConfig.app.blockSynchIntervalMs)
    }
}, appConfig.app.blockSynchIntervalMs)
const synchronizerFactory = require('./modules/service/synchronizer-service')

const blockDao = require('./modules/db/dao/block')
const transactionDao = require('./modules/db/dao/transaction')
const bitcoinRpc = require('./modules/bitcoin-rpc')
const dbTrxManager = require('./modules/db/utils/dbTrxManager')

const synchronizer = synchronizerFactory(blockDao, transactionDao, bitcoinRpc, dbTrxManager)

let timerId = setTimeout(synch = async () => {
    await synchronizer.synchronize()

    timerId = setTimeout(synch)
})
const synchronizerFactory = require('./modules/service/synchronizer-service')

const blockDao = require('./modules/db/block-dao')
const transactionDao = require('./modules/db/transaction-dao')
const bitcoinRpc = require('./modules/bitcoin-rpc')
const dbTrxManager = require('./modules/db/utils/dbTrxManager')

const synchronizer = synchronizerFactory(blockDao, transactionDao, bitcoinRpc, dbTrxManager)

synchronizer.synchronize()
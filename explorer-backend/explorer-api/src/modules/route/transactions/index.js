const router = require('express').Router()

module.exports = (transactionsController) => {
    router.get('/transactions', transactionsController.listTransactionsByBlockHash)
    
    router.get('/transactions/:txid', transactionsController.getTransactionByTxId)

    return router
}
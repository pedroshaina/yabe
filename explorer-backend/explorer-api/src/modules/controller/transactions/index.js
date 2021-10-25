module.exports = (transactionService) => {
    const listTransactionsByBlockHash = async (req, res, next) => {

        if (!req.query.blockHash || !req.query.page || !req.query.pageSize) {
            return res.status(400).json({ error: 'You must provide the following query params: blockHash, page, pageSize' })
        }

        const {
            blockHash,
            page,
            pageSize
        } = req.query

        try {
            const blockTransactions = await transactionService.listTransactionsByBlockHash(blockHash, page, pageSize)
            return res.json(blockTransactions)
        } catch (err) {
            next(err)
        }
    }

    const getTransactionByTxId = async (req, res, next) => {
        
        if (!req.params.txid) {
            return res.status(400).json({ error: 'You must provide the following path param: txid' })
        }

        const {
            txid
        } = req.params
        
        try {
            const transaction = await transactionService.getTransactionByTxId(txid)
            return res.json(transaction)
        } catch (err) {
            next(err)
        }
    }

    return {
        listTransactionsByBlockHash,
        getTransactionByTxId
    }
}
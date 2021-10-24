module.exports = (transactionService) => {
    const listTransactionsByBlockHash = (req, res) => {

        if (!req.query.blockHash || !req.query.page || !req.query.pageSize) {
            res.status(400).json({ error: 'You must provide the following query params: blockHash, page, pageSize' })
        }

        const {
            blockHash,
            page,
            pageSize
        } = req.query

        const blockTransactions = await transactionService.listTransactionsByBlockHash(blockHash, page, pageSize)

        return res.json(blockTransactions)
    }

    const getTransactionByTxId = (req, res) => {
        if (!req.params.txid) {
            res.status(400).json({ error: 'You must provide the following path param: txid' })
        }

        const {
            txid
        } = req.params
        
        const transaction = await transactionService.getTransactionByTxId(txid)

        return res.json(transaction)
    }

    return {
        listTransactionsByBlockHash,
        getTransactionByTxId
    }
}
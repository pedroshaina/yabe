module.exports = (transactionDao) => {
    const listTransactionsByBlockHash = async (blockHash, page, pageSize) => {
        return await transactionDao.loadMinifiedTransactionsByBlockHash(blockHash, page, pageSize)
    }

    const getTransactionByTxId = async (txid) => {
        return await transactionDao.loadFullTransacionByTxid(txid)
    }

    return {
        listTransactionsByBlockHash,
        getTransactionByTxId
    }
}
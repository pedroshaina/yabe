module.exports = (blockDao) => {
    const listLatestBlocksWithPagination = async (page, pageSize) => {
        return await blockDao.getLatestBlocksWithPagination(page, pageSize)
    }

    const retrieveBlockByHash = async (blockHash) => {
        return await blockDao.getBlockByHash(blockHash)
    }

    return {
        listLatestBlocksWithPagination,
        retrieveBlockByHash
    }
}
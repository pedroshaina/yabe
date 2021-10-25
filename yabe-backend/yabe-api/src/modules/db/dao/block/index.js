module.exports = (knex) => {
    const getLatestBlocksWithPagination = async (page, pageSize) => {
        const currentPage = (page && page >= 1) ? page : 1
        const offset = (currentPage - 1) * (pageSize || 10)

        return await knex('block')
            .limit(pageSize)
            .offset(offset)
            .orderBy('height', 'desc')
            .select('*')
    }

    const getBlockByHash = async (blockHash) => {
        return await knex('block')
            .where('hash', blockHash)
            .select('*')
    }

    return {
        getLatestBlocksWithPagination,
        getBlockByHash
    }
}
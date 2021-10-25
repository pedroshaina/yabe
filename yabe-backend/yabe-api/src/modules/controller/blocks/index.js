module.exports = (blockService) => {

    const listLatestBlocks = async (req, res, next) => {
        
        if (!req.query.page || !req.query.pageSize) {
            return res.status(400).json({ error: 'You must provide the following query params: page, pageSize' })
        }
        
        const {
            page,
            pageSize 
        } = req.query

        try {
            const blocks = await blockService.listLatestBlocksWithPagination(page, pageSize)
            return res.json(blocks)
        } catch (err) {
            next(err)
        }
    }

    const getBlockByHash = async (req, res, next) => {
        if (!req.params.hash) {
            return res.status(400).json({ error: 'You must provide the following path param: hash' })
        }

        const { hash } = req.params
        
        try {
            const block = await blockService.getBlockByHash(hash)
            return res.json(block)
        } catch (err) {
            next(err)
        }
    }

    return {
        listLatestBlocks,
        getBlockByHash
    }
}
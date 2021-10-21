module.exports = (blockService) => {

    const listLatestBlocks = async (req, res) => {
        
        if (!req.query.page || !req.query.pageSize) {
            res.status(400).json({ error: 'You must provide the following query params: page, pageSize' })
        }
        
        const {
            page,
            pageSize 
        } = req.query

        const blocks = await blockService.listLatestBlocksWithPagination(page, pageSize)

        return res.json(blocks)
    }

    const getBlockByHash = async (req, res) => {
        if (!req.params.hash) {
            res.status(400).json({ error: 'You must provide the following path param: hash' })
        }

        const { hash } = req.params
        
        const block = await blockService.getBlockByHash(hash)

        return res.json(block)
    }

    return {
        listLatestBlocks,
        getBlockByHash
    }
}
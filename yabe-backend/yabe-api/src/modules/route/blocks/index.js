const router = require('express').Router()

module.exports = (blocksController) => {
    
    router.get('/blocks', blocksController.listLatestBlocks)

    router.get('/blocks/:hash', blocksController.getBlockByHash)

    return router
}
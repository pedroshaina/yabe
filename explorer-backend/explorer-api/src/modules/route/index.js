const router = require('express').Router()

const blocksRoutes = require('./blocks')
const transactionsRoutes = require('./transactions')

module.exports = (blocksController, transactionsController) => {
    router.use(blocksRoutes(blocksController))
    router.use(transactionsRoutes(transactionsController))
    
    router.use((req, res) => {
        res.status(404).json("Not found")
    })

    return router
}
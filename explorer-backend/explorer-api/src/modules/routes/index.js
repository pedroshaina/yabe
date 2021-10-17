const router = require('express').Router()

const blocksRouter = require('./blocks')
const transactionsRouter = require('./transactions')

router.use(blocksRouter)
router.use(transactionsRouter)

router.use((req, res) => {
    res.status(404).json("Not found")
})

module.exports = router
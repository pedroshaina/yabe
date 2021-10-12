const knex = require('../../knex')
const logger = require('./../../../logger')

const getMaxBlockHeight = async () => {
    const [res] = await knex('block').max('height')

    if (!res.max) {
        return 0
    }

    return res.max
}

const insertBlockInTrans = async (dbTrx, block) => {
    const {
        height,
        hash
    } = block

    logger.info(`Indexing block height ${height} with hash '${hash}' `)

    await dbTrx('block')
        .insert(block)
}

const insertBlock = async (block, transactions) => {
    const dbTrx = await knex.transaction()
    try {
        await insertBlockInTrans(dbTrx, block, transactions)
        await dbTrx.commit()
    } catch (err) {
        await dbTrx.rollback()
        throw err
    }
}

module.exports = {
    getMaxBlockHeight,
    insertBlockInTrans,
    insertBlock
}
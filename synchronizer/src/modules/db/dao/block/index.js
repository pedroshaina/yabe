const knex = require('../../knex')

const getMaxBlockHeight = async () => {
    const [res] = await knex('block').max('height')

    if (!res.max) {
        return 0
    }

    return new Number(res.max)
}

const insertBlockInTrans = async (dbTrx, block) => {
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
        console.log(JSON.stringify(err))
        throw err
    }
}

module.exports = {
    getMaxBlockHeight,
    insertBlockInTrans,
    insertBlock
}
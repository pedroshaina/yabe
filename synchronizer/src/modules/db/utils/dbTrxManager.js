const knex = require('./../knex')

const newTrans = async () => {
    return await knex.transaction()
}

const commitTrans = async (dbTrx) => {
    return await dbTrx.commit()
}

const rollbackTrans = async (dbTrx) => {
    return await dbTrx.rollback()
}

module.exports = {
    newTrans,
    commitTrans,
    rollbackTrans
}
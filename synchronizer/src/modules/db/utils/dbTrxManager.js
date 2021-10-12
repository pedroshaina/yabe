const knex = require('./../knex')

const newTrans = async () => {
    return await knex.transaction()
}

const executeInTrans = async (functionToBeExecuted) => {
    return await knex.transaction(async dbTrx => {
        await functionToBeExecuted(dbTrx)
    })
}

const commitTrans = async (dbTrx) => {
    return await dbTrx.commit()
}

const rollbackTrans = async (dbTrx) => {
    return await dbTrx.rollback()
}

module.exports = {
    newTrans,
    executeInTrans,
    commitTrans,
    rollbackTrans
}
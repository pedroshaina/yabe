const knex = require('../../knex')

const insertTransactionsInTrans = async (dbTrx, transactions) => {
    await Promise.all(transactions.map(async (transaction) => {
        await insertTransactionInTrans(dbTrx, transaction)
    }))
}

const insertTransactionInTrans = async (dbTrx, transaction) => {
    const {
        inputs,
        outputs,
        ...transactionModel
    } = transaction

    if (!transactionModel.feeValue) 
        transactionModel.feeValue = 0

    const [transactionId] = await dbTrx('transaction')
        .returning('id')
        .insert(transactionModel)

    await storeInputs(dbTrx, inputs, transactionId)
    await storeOutputs(dbTrx, outputs, transactionId)    
}

const storeInputs = async (dbTrx, inputs, transactionId) => {
    await Promise.all(inputs.map(async input => {
        const {
            scriptSig,
            witnessData,
            ...inputModel
        } = input

        const [scriptSigId] = await storeScriptSig(dbTrx, scriptSig)

        const [transactionInputId] = await storeInput(dbTrx, inputModel, transactionId, scriptSigId)

        await storeWitnessData(dbTrx, witnessData, transactionInputId)
    }))
}

const storeScriptSig = async (dbTrx, scriptSig) => {
    if (!scriptSig)
        return [null]

    return await dbTrx('script_sig')
        .returning('id')
        .insert(scriptSig)
}

const storeInput = async (dbTrx, input, transactionId, scriptSigId) => {
    return await dbTrx('transaction_input')
        .returning('id')
        .insert({
            ...input,
            transactionId,
            scriptSigId
        })
}

const storeWitnessData = async (dbTrx, witnessData, transactionInputId) => {
    if (!witnessData || !witnessData.size) {
        return
    }
    
    await Promise.all(witnessData.map(async (hex) => {
        await dbTrx('witness_data')
            .returning('id')
            .insert({
                transactionInputId,
                hex
            })
    }))
}

const storeOutputs = async (dbTrx, outputs, transactionId) => {
    await Promise.all(outputs.map(async (output) => {
        const {
            scriptPubKey,
            ...outputModel
        } = output

        const [scriptPubKeyId] = await storeScriptPubKey(dbTrx, scriptPubKey)

        await storeOutput(dbTrx, outputModel, transactionId, scriptPubKeyId)
    }))
}

const storeScriptPubKey = async (dbTrx, scriptPubKey) => {
    return await dbTrx('script_pub_key')
        .returning('id')
        .insert(scriptPubKey)
}

const storeOutput = async (dbTrx, output, transactionId, scriptPubKeyId) => {
    return await dbTrx('transaction_output')
        .returning('id')
        .insert({
            ...output,
            transactionId,
            scriptPubKeyId
        })
}

module.exports = {
    insertTransactionsInTrans,
    insertTransactionInTrans
}
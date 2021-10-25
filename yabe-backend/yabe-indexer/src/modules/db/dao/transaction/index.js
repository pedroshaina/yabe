module.exports = (knex, logger) => {
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
    
        logger.info(`Indexing transaction with txid '${transactionModel.txid}'  for block '${transactionModel.blockHash}'`)
    
        const [transactionId] = await dbTrx('transaction')
            .returning('id')
            .insert(transactionModel)
    
        await storeInputs(dbTrx, inputs, transactionId)
        await storeOutputs(dbTrx, outputs, transactionId)    
    }
    
    const getFullTransactionByTxid = async (txid) => {
        const [transaction] = await knex('transaction')
            .where('transaction.txid', txid)
            .select('*')
    
        const inputs = await retrieveTransactionInputs(transaction.id)
        const outputs = await retrieveTransactionOutputs(transaction.id)
        const witnessData = await retrieveTransactionWitnessData(transaction.id)
    
        return {
            ...transaction,
            inputs,
            outputs,
            witnessData
        }
    }
    
    const retrieveTransactionInputs = async (transactionId) => {
        if (!transactionId) {
            return []
        }
        
        const inputs = await knex('transaction_input')
            .where('transaction_input.transaction_id', transactionId)
            .select('*')
    
        if (!inputs || !inputs.length) {
            return []
        }
    
        return await Promise.all(inputs.map(async input => {
            const [scriptSig] = await retrieveScriptSig(input.scriptSigId)
            const witnessData = await retrieveTransactionWitnessData(input.id)
    
            return {
                ...input,
                scriptSig,
                witnessData
            }
        }))
    }
    
    const retrieveScriptSig = async (scriptSigId) => {
        if (!scriptSigId) {
            return [null]
        }
    
        return await knex('script_sig')
            .where('script_sig.id', scriptSigId)
            .select('*')
    }
    
    const retrieveTransactionOutputs = async (transactionId) => {
        if (!transactionId) {
            return []
        }
        
        const outputs = await knex('transaction_output')
            .where('transaction_output.transaction_id', transactionId)
            .select('*')
    
        if (!outputs || !outputs.length) {
            return []
        }
    
        return await Promise.all(outputs.map(async output => {
            const [scriptPubKey] = await retrieveScriptPubKey(output.scriptPubKeyId)
    
            return {
                ...output,
                scriptPubKey
            }
        }))
    }
    
    const retrieveScriptPubKey = async (scriptPubKeyId) => {
        if (!scriptPubKeyId) {
            return [null]
        }
    
        return await knex('script_pub_key')
            .where('script_pub_key.id', scriptPubKeyId)
            .select('*')
    }
    
    const retrieveTransactionWitnessData = async (transactionInputId) => {
        if (!transactionInputId) {
            return []
        }
    
        return knex('witness_data')
            .where('witness_data.transaction_input_id', transactionInputId)
            .select('*')
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
    
    return {
        insertTransactionsInTrans,
        insertTransactionInTrans,
        getFullTransactionByTxid
    }
}




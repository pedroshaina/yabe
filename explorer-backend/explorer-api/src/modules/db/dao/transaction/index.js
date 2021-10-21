module.exports = (knex) => {
    const loadMinifiedTransactionsByBlockHash = async (blockHash, page, pageSize) => {
        const currentPage = page >= 1 ? page : 1
        const offset = (currentPage - 1) * pageSize

        return await knex('transaction')
            .where('block_hash', blockHash)
            .limit(pageSize)
            .offset(offset)
            .select('*')
    }

    const loadFullTransacionByTxid = async (txid) => {
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

    return {
        loadMinifiedTransactionsByBlockHash,
        loadFullTransacionByTxid
    }
}
const synchronizerFactory = (blockDao, transactionDao, bitcoinRpc, dbTrxManager) => {

    const synchronize = async () => {
        const lastIndexedHeight = await blockDao.getMaxBlockHeight()
        const lastNodeHeight = await bitcoinRpc.getBlockCount()
        const nextHeightToBeIndexed = 1 + lastIndexedHeight
        
        console.log({lastIndexedHeight, lastNodeHeight})
    
        if (lastNodeHeight >= nextHeightToBeIndexed) {
            console.log('New block to be indexed', nextHeightToBeIndexed)
            const blockHash = await bitcoinRpc.getBlockHash(nextHeightToBeIndexed)
    
            const {
                txs,
                ...block
            } = await bitcoinRpc.getBlockWithTransactions(blockHash)
    
            const blockStats = await bitcoinRpc.getBlockStats(nextHeightToBeIndexed)
    
            const blockModel = buildBlockModel(block, blockStats);
            const transactionsModel = buildTransactionsModel(txs, blockHash)

            const dbTrx = dbTrxManager.newTrans()

            try {
                await blockDao.insertBlockInTrans(dbTrx, blockModel)
                await transactionDao.insertTransactionInTras(dbTrx, transactionsModel)    
            
                await dbTrxManager.commitTrans(dbTrx)
            } catch (err) {
                await dbTrxManager.rollbackTrans(dbTrx)
            }
        }
    }

    const buildBlockModel = (rpcBlock, rpcBlockStats) => {
        const {
            hash,
            confirmations,
            height,
            size,
            strippedsize: strippedSize,
            version,
            weight,
            versionHex,
            merkleroot: merkleRoot,
            time,
            mediantime: medianTime,
            nonce,
            bits,
            difficulty,
            nTx: txCount,
            previousblockhash: previousBlockHash,
            nextblockhash: nextBlockHash
        } = rpcBlock

        const totalUtxoValue = rpcBlockStats.total_out / 100000000
        const totalFeeValue = rpcBlockStats.totalfee / 100000000
        const rewardValue = rpcBlockStats.subsidy / 100000000

        return {
            hash,
            confirmations,
            height,
            size,
            strippedSize,
            version,
            weight,
            versionHex,
            merkleRoot,
            time,
            medianTime,
            nonce,
            bits,
            difficulty,
            txCount,
            previousBlockHash,
            nextBlockHash,
            totalUtxoValue,
            totalFeeValue,
            rewardValue
        }
    }

    const buildTransactionsModel = (transactions, blockHash) => {
        return transactions.map(transaction => {
            const inputs = mapTransactionInputs(transaction)
            const outputs = mapTransactionOutputs(transaction)

            const inputCount = inputs.length
            const outputCount = outputs.length

            //const totalInputValue = getInputValue(inputs)
            const totalInputValue = 0
            const totalOutputValue = outputs
                .map(output => output.value)
                .reduce((partial, actual) => partial + actual, 0);
            
            const isCoinbase = hasCoinbaseInput(inputs)

            const {
                txid,
                hash,
                size,
                vsize,
                weight,
                locktime,
                fee: feeValue
            } = transaction

            return {
                txid,
                hash,
                size,
                vsize,
                weight,
                locktime,
                feeValue,
                blockHash,
                isCoinbase,
                inputCount,
                outputCount,
                totalInputValue,
                totalOutputValue,
                inputs,
                outputs
            }
        })
    }

    const hasCoinbaseInput = (inputs) => {
        return inputs.some(input => !!input.coinbaseData)
    }

    const mapTransactionInputs = (transaction) => {
        return transaction.vin.map(input => {
            const scriptSig = input.scriptSig? { asm: input.scriptSig.asm, hex: input.scriptSig.hex } : null
            const coinbaseData = input.coinbase? input.coinbase : null
            const hasWitness = !!input.txinwitness
            const witnessData = hasWitness? input.txinwitness : null

            const {
                txid: sourceOutputTxId,
                vout: sourceOutputIndex,
                sequence
            } = input

            return {
                sourceOutputTxId,
                sourceOutputIndex,
                hasWitness,
                witnessData,
                coinbaseData,
                scriptSig,
                sequence
            }
        })
    }

    const mapTransactionOutputs = (transaction) => {
        return transaction.vout.map(output => {
            const scriptPubKey = output.scriptPubKey? {
                asm: output.scriptPubKey.asm,
                hex: output.scriptPubKey.hex,
                type: output.scriptPubKey.type,
                address: output.scriptPubKey.address? output.scriptPubKey.address : null
            } : null

            const {
                value,
                n: index
            } = output

            return {
                value,
                index,
                scriptPubKey
            }
        })
    }

    return {
        synchronize
    }
}

module.exports = synchronizerFactory
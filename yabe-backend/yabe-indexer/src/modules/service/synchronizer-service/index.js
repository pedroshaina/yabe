const logger = require('./../../logger')

const synchronizerFactory = (blockDao, transactionDao, bitcoinRpc, dbTrxManager) => {

    const synchronize = async () => {
        const lastIndexedHeight = await blockDao.getMaxBlockHeight()
        const lastNodeHeight = await bitcoinRpc.getBlockCount()
        const nextHeightToBeIndexed = 1 + lastIndexedHeight
        
        logger.info(`lastIndexedHeight ${lastIndexedHeight}, nextHeightToBeIndexed ${nextHeightToBeIndexed}, lastNodeHeight ${lastNodeHeight}`)

        if (lastNodeHeight >= nextHeightToBeIndexed) {
            
            const blockHash = await bitcoinRpc.getBlockHash(nextHeightToBeIndexed)

            const {
                tx: txs,
                ...block
            } = await bitcoinRpc.getBlockWithTransactions(blockHash)

            let blockStats = null

            if (nextHeightToBeIndexed !== 0) { //skip genesis block
                blockStats = await bitcoinRpc.getBlockStats(nextHeightToBeIndexed)
            }

            const blockModel = buildBlockModel(block, blockStats);
            const transactionsModel = buildTransactionsModel(txs, blockHash)

            await dbTrxManager.executeInTrans(async dbTrx => {
                await blockDao.insertBlockInTrans(dbTrx, blockModel)
                await transactionDao.insertTransactionsInTrans(dbTrx, transactionsModel)
            })
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

        const blockStats = getBlockStats(rpcBlockStats, height)

        const {
            totalUtxoValue,
            totalFeeValue,
            rewardValue
        } = blockStats

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

            const isCoinbase = hasCoinbaseInput(inputs)

            const {
                txid,
                hash,
                size,
                vsize,
                weight,
                locktime,
                version,
                fee: feeValue
            } = transaction

            return {
                txid,
                hash,
                size,
                vsize,
                weight,
                locktime,
                version,
                feeValue,
                blockHash,
                isCoinbase,
                inputCount,
                outputCount,
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
            const scriptSig = input.scriptSig ? { asm: input.scriptSig.asm, hex: input.scriptSig.hex } : null
            const coinbaseData = input.coinbase ? input.coinbase : null
            const hasWitness = !!input.txinwitness
            const witnessData = hasWitness ? input.txinwitness : null

            const {
                txid: sourceOutputTxid,
                vout: sourceOutputIndex,
                sequence
            } = input

            return {
                sourceOutputTxid,
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
            const scriptPubKey = output.scriptPubKey ? {
                asm: output.scriptPubKey.asm,
                hex: output.scriptPubKey.hex,
                type: output.scriptPubKey.type,
                address: getAddress(output.scriptPubKey)
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

    const getAddress = (scriptPubKey) => {
        if (scriptPubKey.addresses)
            return [scriptPubKey.addresses]

        if (scriptPubKey.address)
            return scriptPubKey.address

        return null
    }

    const getBlockStats = (rpcBlockStats, blockHeight) => {
        //genesis block special treatment
        if (blockHeight === 0) {
            return {
                totalUtxoValue: 50,
                totalFeeValue: 0,
                rewardValue: 50
            }
        }
        
        if (!rpcBlockStats) {
            return {
                totalUtxoValue: 0,
                totalFeeValue: 0,
                rewardValue: 0
            }
        }

        return {
            totalUtxoValue: (rpcBlockStats.total_out || 0) / 100000000,
            totalFeeValue: (rpcBlockStats.totalfee || 0) / 100000000,
            rewardValue: (rpcBlockStats.subsidy || 0) / 100000000
        }
    }

    return {
        synchronize
    }
}

module.exports = synchronizerFactory
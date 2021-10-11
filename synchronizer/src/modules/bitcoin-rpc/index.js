const crypto = require('crypto')
const fetch = require('node-fetch').default

const appConfig = require('../config')

const defaultRequestConfig = {
    method: 'POST',
    auth: {
        username: appConfig.rpc.username,
        password: appConfig.rpc.password
    },
    headers: {
        'Content-Type': 'text/plain',
        'Authorization': `Basic ${Buffer.from(`${appConfig.rpc.username}:${appConfig.rpc.password}`).toString('base64')}`
    }
}

const createRequestBody = (rpcMethodName, params) => {
    return JSON.stringify({
        jsonrpc: 1.0,
        id: crypto.randomBytes(16).toString('hex'),
        method: rpcMethodName,
        params
    })
}


const call = async (rpcMethodName, ...params) => {
    const requestBody = createRequestBody(rpcMethodName, params)

    const response = await fetch(appConfig.rpc.uri, {
        ...defaultRequestConfig,
        body: requestBody
    })
    
    return response.json()
}

const getBlockCount = async () => {
    const res = await call('getblockcount')

    return res.result
}

const getBlockHash = async (blockHeight) => {
    const res = await call('getblockhash', blockHeight)

    return res.result
}

const getBlockWithTransactions = async (blockHash) => {
    const res = await call('getblock', blockHash, 2)

    return res.result
}

const getBlockStats = async (blockHeight) => {
    const res = await call('getblockstats', blockHeight)

    return res.result
}
  
module.exports = {
    getBlockCount,
    getBlockHash,
    getBlockWithTransactions,
    getBlockStats
}
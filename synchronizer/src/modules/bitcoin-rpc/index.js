const crypto = require('crypto')
const fetch = require('node-fetch').default
const logger = require('../logger')
const AbortController = require('abort-controller')

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

    const requestTimeoutMs = appConfig.rpc.requestTimeoutMs || 30000

    const controller = new AbortController()

    const timeout = setTimeout(() => {
        controller.abort()
    }, requestTimeoutMs)

    try {
        const response = await fetch(appConfig.rpc.uri, {
            ...defaultRequestConfig,
            signal: controller.signal,
            body: requestBody
        })
        
        const responseJson = await response.json()
        
        if (!responseJson.result && !!responseJson.error) {
            throw new Error(`Received error response from bitcoin-rpc: ${responseJson.error.message}`)
        }
    
        return responseJson.result
    } catch (err) {
        if (err.name == 'AbortError') {
            throw new Error(`RPC call to method '${rpcMethodName}' timed out after ${requestTimeoutMs}ms`)
        }        
        throw err
    } finally {
        clearTimeout(timeout)
    }
}

const getBlockCount = async () => {
    return await call('getblockcount')
}

const getBlockHash = async (blockHeight) => {
    return await call('getblockhash', blockHeight)
}

const getBlockWithTransactions = async (blockHash) => {
    return await call('getblock', blockHash, 2)
}

const getBlockStats = async (blockHeight) => {
    return await call('getblockstats', blockHeight)
}
  
module.exports = {
    getBlockCount,
    getBlockHash,
    getBlockWithTransactions,
    getBlockStats
}
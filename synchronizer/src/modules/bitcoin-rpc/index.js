const crypto = require('crypto')
const Axios = require('axios')

const appConfig = require('../config')

const axiosConfig = {
    method: 'POST',
    url: appConfig.rpc.uri,
    auth: {
        username: appConfig.rpc.username,
        password: appConfig.rpc.password
    },
    headers: {
        'Content-Type': 'text/plain'
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

const createAxiosRequest = async (rpcMethodName, params) => {
    const requestBody = createRequestBody(rpcMethodName, params)
    return Axios({
        ...axiosConfig,
        data: requestBody
    })
}

const call = async (rpcMethodName, ...params) => {
    return await createAxiosRequest(rpcMethodName, [...params])
}

module.exports = {
    call
}
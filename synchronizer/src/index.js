const bitcoinRPC = require('./modules/bitcoin-rpc')

bitcoinRPC.call('getblockhash', 60000)
    .then(result => console.log(result.data))
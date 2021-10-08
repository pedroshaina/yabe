const bitcoinRPC = require('./modules/bitcoin-rpc')

async function loadLastSynchronizedBlock() {
    console.log('Getting last block height from node')
    const lastLoadedBlockHeight = await bitcoinRPC.getBlockCount()
    console.log('Last block height from node', lastLoadedBlockHeight)

    console.log(`Getting block hash with height ${lastLoadedBlockHeight}`)
    const lastLoadedBlockHash = await bitcoinRPC.getBlockHash(lastLoadedBlockHeight)
    console.log('Block hash', lastLoadedBlockHash)

    console.log('Getting block with transactions')
    const lastLoadedBlock = await bitcoinRPC.getBlockWithTransactions(lastLoadedBlockHash)

    console.log(lastLoadedBlock)
}

loadLastSynchronizedBlock()
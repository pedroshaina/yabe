const defaultConfig = require('./default.js')
const envSpecificConfig = require(`./${process.env.NODE_ENV || "dev"}.js`)

const mergedConfig = {
    ...defaultConfig,
    ...envSpecificConfig
}

//TODO read environment variables and merge accordingly

module.exports = mergedConfig
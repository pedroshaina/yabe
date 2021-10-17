const express = require('express')
const cors = require('cors')

const appConfig = require('./modules/config')
const routes = require('./modules/routes')

const app = express()

app.use(cors())
app.use(express.json())

app.use(routes)

app.listen(appConfig.server.port || 8080, () => {
    console.log("Server up")
})


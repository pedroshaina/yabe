import { rpcAuthLine } from '../rpcauth.js'

const [user, password] = process.argv.slice(2)
if (!user || !password) {
  console.error('Usage: pnpm rpcauth <user> <password>')
  process.exit(1)
}
console.log(rpcAuthLine(user, password))

'use strict'

const Client = require('bitcoin-core')

/* SETTINGS */

const nav1Receiving = 'sJgrkHqvxYD1AKhcUKCnetVVdL3TqcDysr'
const nav1RcpUser = '*'
const nav1RcpPass = '*'
const rcpPort = 44444

const nav2RcpUser = '*'
const nav2RcpPass = '*'
const nav2IPAddress = '192.168.1.8'
/* INIT */

const localNav1Client = new Client({
  username: nav1RcpUser,
  password: nav1RcpPass,
  port: rcpPort,
})

const remoteNav2Client = new Client({
  username: nav2RcpUser,
  password: nav2RcpPass,
  port: rcpPort,
  host: nav2IPAddress,
})

remoteNav2Client.getInfo().then((info) => console.log('remoteNav2Client', info))

localNav1Client.getInfo().then((info) => getUnspent(info))

const getUnspent = (info) => {
  console.log('localNav1Client', info)
  localNav1Client.listUnspent().then((unspent) => filterUnspent(unspent))
}

const filterUnspent = (unspent) => {
  // console.log('listUnspent', unspent)
  let hasPending = false

  for (const pending of unspent) {
    if (pending.address === nav1Receiving) {
      hasPending = true
      processTransaction(pending)
    }
  }

  if (!hasPending) console.log('nothing to process')
}

const processTransaction = (pending) => {
  console.log('processTransaction', pending)
}

'use strict'

const Client = require('bitcoin-core')
const fs = require('fs')

// --------- Settings ---------

const nav1Receiving = 'sNszCRJXUKbP7GZ9QMy5wbxximm2WCBtCg'
const nav1BurnAddress = 'sV7wPhehHDxAr4Gi5dKnSuE9vqf7DTVrZ4'
const nav1RcpUser = '*'
const nav1RcpPass = '*'
const rcpPort = 44444

const nav2RcpUser = '*'
const nav2RcpPass = '*'
const nav2IPAddress = '192.168.1.8'

const txFee = 0.01

// --------- Initialisation ---------

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

localNav1Client.getInfo().then((info) => getUnspent(info)).error((err) => {
  writeLog('001', 'failed getInfo', err)
})

// --------- Functions ---------

const getUnspent = (info) => {
  console.log('localNav1Client', info)
  localNav1Client.listUnspent().then((unspent) => filterUnspent(unspent)).error((err) => {
    writeLog('002', 'failed listUnspent', err)
  })
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

  localNav1Client.getTransaction(pending.txid).then((fullTrans) => {
    console.log('gettransaction', fullTrans)
    const nav2UserAddress = fullTrans['tx-comment']
    validateNav2Address(nav2UserAddress, pending, fullTrans)
  }).error((err) => {
    writeLog('003', 'failed gettransaction', {
      error: err,
      pending,
    })
  })
}

const validateNav2Address = (nav2UserAddress, pending, fullTrans) => {
  remoteNav2Client.validateAddress(nav2UserAddress).then((addressInfo) => {
    console.log('validateaddress', addressInfo)
    if (addressInfo.isValid) {
      sendNav2(nav2UserAddress, pending)
    } else {
      writeLog('005', 'invalid address', {
        nav2UserAddress,
        pending,
        fullTrans,
      })
      getOrigin(pending)
    }
  }).error((err) => {
    writeLog('004', 'failed validateAddress', {
      error: err,
      pending,
      fullTrans,
    })
  })
}

const sendNav2 = (nav2UserAddress, pending) => {
  console.log('sendNav2', pending, nav2UserAddress)

  remoteNav2Client.sendToAddress(nav2UserAddress, pending.amount).then((sendOutcome) => {
    console.log('sendOutcome', sendOutcome)
    if (sendOutcome.txid) {
      burnNav1(pending)
    } else {
      writeLog('007', 'failed to send the transaction', {
        pending,
        nav2UserAddress,
        sendOutcome,
      })
      getOrigin(pending)
    }
  }).error((err) => {
    writeLog('006', 'failed sendToAddress', {
      error: err,
      pending,
      nav2UserAddress,
    })
  })
}

const burnNav1 = (pending) => {
  console.log('burnNav1', pending)

  const outgoingTransactions = {}
  outgoingTransactions[nav1BurnAddress] = pending.amount - txFee

  const spentTransactions = [{
    txid: pending.txid,
    vout: pending.vout,
  }]

  localNav1Client.createRawTransaction(spentTransactions, outgoingTransactions).then((rawTrans) => {
    signBurnTx(rawTrans, pending)
  }).error((err) => {
    writeLog('008', 'failed createRawTransaction', {
      error: err,
      pending,
      spentTransactions,
      outgoingTransactions,
    })
  })
}

const signBurnTx = (rawTrans, pending) => {
  localNav1Client.signRawTransaction(rawTrans).then((signedRaw) => {
    sendBurnTx(signedRaw, pending)
  }).error((err) => {
    writeLog('009', 'failed signRawTransaction', {
      error: err,
      pending,
      rawTrans,
    })
  })
}

const sendBurnTx = (signedRaw, pending) => {
  localNav1Client.sendRawTransaction(signedRaw.hex).then((rawOutcome) => {
    console.log('burnNav1 rawOutcome', rawOutcome)
  }).error((err) => {
    writeLog('010', 'failed sendRawTransaction', {
      error: err,
      pending,
      signedRaw,
    })
  })
}

const getOrigin = (pending) => {
  localNav1Client.getRawTransaction(pending.txid).then((incomingRaw) => {
    decodeOriginRaw(incomingRaw, pending)
  }).error((err) => {
    writeLog('011', 'failed getRawTransaction', {
      error: err,
      pending,
    })
  })
}

const decodeOriginRaw = (incomingRaw, pending) => {
  localNav1Client.decodeRawTransaction(incomingRaw).then((incomingTrans) => {
    getOriginRaw(incomingTrans, pending)
  }).error((err) => {
    writeLog('012', 'failed decodeRawTransaction', {
      error: err,
      pending,
      incomingRaw,
    })
  })
}

const getOriginRaw = (incomingTrans, pending) => {
  localNav1Client.getRawTransaction(incomingTrans.vin[0].txid).then((inputRaw) => {
    decodeOriginInputRaw(inputRaw, incomingTrans, pending)
  }).error((err) => {
    writeLog('013', 'failed getRawTransaction', {
      error: err,
      pending,
      incomingTrans,
    })
  })
}

const decodeOriginInputRaw = (inputRaw, incomingTrans, pending) => {
  localNav1Client.decodeRawTransaction(inputRaw).then((inputTrans) => {
    const origin = inputTrans.vout[incomingTrans.vin[0].vout].scriptPubKey.addresses[0]
    sendNav1(origin, pending)
  }).error((err) => {
    writeLog('014', 'failed decodeRawTransaction', {
      error: err,
      pending,
      inputRaw,
    })
  })
}

const sendNav1 = (origin, pending) => {
  console.log('returnNav1', origin, pending)

  const outgoingTransactions = {}
  outgoingTransactions[origin] = pending.amount - txFee

  const spentTransactions = [{
    txid: pending.txid,
    vout: pending.vout,
  }]

  localNav1Client.createRawTransaction(spentTransactions, outgoingTransactions).then((rawTrans) => {
    signNav1Raw(rawTrans, pending)
  }).error((err) => {
    writeLog('015', 'failed createRawTransaction', {
      error: err,
      pending,
      spentTransactions,
      outgoingTransactions,
    })
  })
}

const signNav1Raw = (rawTrans, pending) => {
  localNav1Client.signRawTransaction(rawTrans).then((signedRaw) => {
    sendNav1Raw(signedRaw, pending)
  }).error((err) => {
    writeLog('016', 'failed signRawTransaction', {
      error: err,
      pending,
      rawTrans,
    })
  })
}

const sendNav1Raw = (signedRaw, pending) => {
  localNav1Client.sendRawTransaction(signedRaw.hex).then((rawOutcome) => {
    console.log('returnNav1 rawOutcome', rawOutcome)
  }).error((err) => {
    writeLog('017', 'failed sendRawTransaction', {
      error: err,
      pending,
      signedRaw,
    })
  })
}

const writeLog = (errorCode, errorMessage, data) => {
  const date = new Date()
  let logString = '\r\n'
  logString += 'Date: ' + date + '\r\n'
  logString += 'Error Code: ' + errorCode + '\r\n'
  logString += 'Error Message: ' + errorMessage + '\r\n'

  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      let string = data[key]
      if (typeof data[key] === 'object') string = JSON.stringify(data[key])
      logString += key + ': ' + string + '\r\n'
    }
  }
  logString += '\r\n-----------------------------------------------------------\r\n'

  fs.appendFile('log.txt', logString, (err) => {
    if (err) console.log('writeLog err', err)
    else console.log('writeLog success')
  })
}

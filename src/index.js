const Client = require('bitcoin-core')
const fs = require('fs')
const settings = require('./settings')

// --------- Initialisation ---------

const localNav1Client = new Client({
  username: settings.nav1RcpUser,
  password: settings.nav1RcpPass,
  port: settings.rcpPort,
})

const remoteNav2Client = new Client({
  username: settings.nav2RcpUser,
  password: settings.nav2RcpPass,
  port: settings.rcpPort,
  host: settings.nav2IPAddress,
})

// run on start up

localNav1Client.getInfo().then(() => getUnspent()).catch((err) => {
  writeLog('001', 'failed getInfo', err)
})

// then run every 2 minutes after that

setInterval(() => {
  localNav1Client.getInfo().then(() => getUnspent()).catch((err) => {
    writeLog('001', 'failed getInfo', err)
  })
}, settings.scriptInterval)

// --------- Functions ---------

const getUnspent = () => {
  localNav1Client.listUnspent().then((unspent) => filterUnspent(unspent)).catch((err) => {
    writeLog('002', 'failed listUnspent', err)
  })
}

const filterUnspent = (unspent) => {
  let hasPending = false

  for (const pending of unspent) {
    if (pending.address === settings.nav1Receiving) {
      hasPending = true
      processTransaction(pending)
    }
  }

  if (!hasPending) console.log('Nothing to process')
}

const processTransaction = (pending) => {
  localNav1Client.getTransaction(pending.txid).then((fullTrans) => {
    const nav2UserAddress = fullTrans['tx-comment']
    validateNav2Address(nav2UserAddress, pending, fullTrans)
  }).catch((err) => {
    writeLog('003', 'failed gettransaction', {
      error: err,
      pending,
    })
  })
}

const validateNav2Address = (nav2UserAddress, pending, fullTrans) => {
  remoteNav2Client.validateAddress(nav2UserAddress).then((addressInfo) => {
    if (addressInfo.isvalid) {
      sendNav2(nav2UserAddress, pending)
    } else {
      writeLog('005', 'invalid address', {
        nav2UserAddress,
        pending,
        fullTrans,
        addressInfo,
      })
      getOrigin(pending)
    }
  }).catch((err) => {
    writeLog('004', 'failed validateAddress', {
      error: err,
      pending,
      fullTrans,
    })
  })
}

const sendNav2 = (nav2UserAddress, pending) => {
  remoteNav2Client.sendToAddress(nav2UserAddress, parseFloat(pending.amount)).then((sendOutcome) => {
    if (sendOutcome) {
      burnNav1(pending)
    } else {
      writeLog('007', 'failed to send the transaction', {
        pending,
        nav2UserAddress,
        sendOutcome,
      })
      getOrigin(pending)
    }
  }).catch((err) => {
    writeLog('006', 'failed sendToAddress', {
      error: err,
      pending,
      nav2UserAddress,
    })
  })
}

const burnNav1 = (pending) => {
  const outgoingTransactions = {}
  outgoingTransactions[settings.nav1BurnAddress] = pending.amount - settings.txFee

  const spentTransactions = [{
    txid: pending.txid,
    vout: pending.vout,
  }]

  localNav1Client.createRawTransaction(spentTransactions, outgoingTransactions).then((rawTrans) => {
    signBurnTx(rawTrans, pending)
  }).catch((err) => {
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
  }).catch((err) => {
    writeLog('009', 'failed signRawTransaction', {
      error: err,
      pending,
      rawTrans,
    })
  })
}

const sendBurnTx = (signedRaw, pending) => {
  localNav1Client.sendRawTransaction(signedRaw.hex).then((rawOutcome) => {
    console.log('Success!')
    writeLog('200', 'Success!', {
      rawOutcome,
      pending,
      signedRaw,
    })
  }).catch((err) => {
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
  }).catch((err) => {
    writeLog('011', 'failed getRawTransaction', {
      error: err,
      pending,
    })
  })
}

const decodeOriginRaw = (incomingRaw, pending) => {
  localNav1Client.decodeRawTransaction(incomingRaw).then((incomingTrans) => {
    getOriginRaw(incomingTrans, pending)
  }).catch((err) => {
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
  }).catch((err) => {
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
  }).catch((err) => {
    writeLog('014', 'failed decodeRawTransaction', {
      error: err,
      pending,
      inputRaw,
    })
  })
}

const sendNav1 = (origin, pending) => {
  const outgoingTransactions = {}
  outgoingTransactions[origin] = pending.amount - settings.txFee

  const spentTransactions = [{
    txid: pending.txid,
    vout: pending.vout,
  }]

  localNav1Client.createRawTransaction(spentTransactions, outgoingTransactions).then((rawTrans) => {
    signNav1Raw(rawTrans, pending)
  }).catch((err) => {
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
  }).catch((err) => {
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
  }).catch((err) => {
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

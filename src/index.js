const express = require('express')
const bitcoin = require('bitcoin')
const app = express()

app.get('/', function (req, res) {

  const client = new bitcoin.Client({
    host: 'localhost',
    port: 8332,
    user: 'username',
    pass: 'password',
    timeout: 30000,
  })

  client.getBalance('*', 6, (err, balance, resHeaders) => {
    if (err) return console.log(err)
    res.status(200).send('Balance: ' + balance)
  })
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})

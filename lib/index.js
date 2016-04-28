'use strict';

var express = require('express');
var bitcoin = require('bitcoin');
var app = express();

app.get('/', function (req, res) {

  var client = new bitcoin.Client({
    host: 'localhost',
    port: 8332,
    user: 'username',
    pass: 'password',
    timeout: 30000
  });

  client.getBalance('*', 6, function (err, balance, resHeaders) {
    if (err) return console.log(err);
    res.status(200).send('Balance: ' + balance);
  });
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require("jwt-simple"); 
const co = require('co');

const dbX = require('../db');
const config = require('../config');

const logJsonStr = require('../utils/log-json-string');


router.post('/', function(req, res) {
  if (!req.body.username ||!req.body.password) res.sendStatus(401);
  const username0 = req.body.username;
  const password0 = req.body.password;
  co(function*() {
    const db = yield dbX.dbPromise;
    const userFound = yield db.collection('users').findOne({username: username0});
    if (!userFound) res.sendStatus(401);
    const passwordMatch = yield bcrypt.compare(password0, userFound.password);
    if (!passwordMatch) res.sendStatus(401);
    const payload = {
      _id: userFound._id,
      username: userFound.username
    };
    const token = jwt.encode(payload, config.jwtSecret);
    res.json({
      token
    })
    // Close the connection
    yield db.close();
  }).catch(function(err) {
    console.log(err.stack);
  });
});

module.exports = router;

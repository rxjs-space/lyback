const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require("jwt-simple"); 
const co = require('co');
const myAcl = require('../../my-acl');

const dbX = require('../../db');

const saltRounds = 10;

router.post('/', function(req, res) {
  res.send('at roles');
})

module.exports = router;

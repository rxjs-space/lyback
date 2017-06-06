const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require("jwt-simple"); 
const co = require('co');
const myAcl = require('../../my-acl');

const dbX = require('../../db');

const saltRounds = 10;

router.post('/', function(req, res) {
  if (!req.body.username ||!req.body.password) return res.status(400).json({
    message: 'Usernme or password is missing.'
  });
  /* consider adding verification for username and password */

  const username = req.body.username;
  const password = req.body.password;
  const roles = req.body.roles.split(' ');
  co(function*() {
    const hash = yield bcrypt.hash(password, saltRounds);
    const db = yield dbX.dbPromise;
    // const db = dbX.db;
    const itemToInsert = {
      username,
      password: hash,
      createdBy: req.user,
      createdAt: (new Date()).toISOString(),
      isActive: true,
    }
    const insertFeedback = yield db.collection('users').insertOne(itemToInsert);
    const aclInstance = yield myAcl.aclInstancePromise;
    yield aclInstance.addUserRoles(itemToInsert._id.toHexString(), roles)
    // db.close();
    res.json(itemToInsert);
  }).catch(function(err) {
    const errStr = JSON.stringify(err.stack);
    // if duplicate username ...
    if (errStr.indexOf('E11000')) return res.status(400).json({
      message: 'Duplicate username.'
    });
    return res.status(500).json(err.stack);
  });
});



module.exports = router;

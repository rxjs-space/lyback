const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require("jwt-simple"); 
const co = require('co');
const myAcl = require('../../my-acl');

const dbX = require('../../db');

const saltRounds = 10;

router.post('/', function(req, res) {
  // console.log(JSON.stringify(req.user), 'posting on /users');
  /* only this user can add a user */
  if (req.user._id.toHexString() !== '5923b7c1ea44c850e43863dc') return res.sendStatus(401);
  if (!req.body.username ||!req.body.password) return res.status(400).json({
    message: 'Usernme or password is missing.'
  });
  /* consider adding verification for username and password */
  const username = req.body.username;
  const password = req.body.password;
  const roles = req.body.roles.split(' ');
  co(function*() {
    const hash = yield bcrypt.hash(password, saltRounds);
    // const db = yield dbX.dbPromise;
    const db = dbX.db;
    const itemToInsert = {
      username,
      password: hash
    }
    const insertFeedback = yield db.collection('users').insertOne(itemToInsert);
    // const aclInstance = new acl(new acl.mongodbBackend(db, 'acl_'));
    const aclInstance = yield myAcl.aclInstancePromise;
    // yield aclInstance.allow('user', 'vehicles', 'view');
    yield aclInstance.addUserRoles(itemToInsert._id.toHexString(), roles)
    // db.close();
    res.json(insertFeedback);
  }).catch(function(err) {
    const errStr = JSON.stringify(err.stack);
    // if duplicate username ...
    if (errStr.indexOf('E11000')) {return res.status(400).json({
      message: 'Duplicate username.'
    })} else {
      return res.json(err.stack);
    }
    // console.log(err.stack);
  });
});

module.exports = router;

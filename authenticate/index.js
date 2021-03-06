const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require("jwt-simple"); 
const co = require('co');
const acl = require('acl-mirror');

const dbX = require('../db');
const config = require('../config');

const logJsonStr = require('../utils/log-json-string');
// const aclInstancePromise = require('../my-acl').aclInstancePromise;

router.post('/', function(req, res) {
  console.log('authenticating');
  if (!req.body.username ||!req.body.password) res.status(401).send({
    message: 'Username or password is missing.'
  });
  const username0 = req.body.username;
  const password0 = req.body.password;
  co(function*() {
    const db = yield dbX.dbPromise;
    // const db = dbX.db;
    const userFound = yield db.collection('users').findOne({username: username0});
    if (!userFound) return res.sendStatus(401);
    const passwordMatch = yield bcrypt.compare(password0, userFound.password);
    if (!passwordMatch) return res.sendStatus(401);
    if (!userFound.isActive) return res.status(401).json({
      message: 'Your account is inactive.'
    })
    const aclInstance = new acl(new acl.mongodbBackend(db, 'acl_'));

    // const aclInstance = yield aclInstancePromise;
    const roles = yield aclInstance.userRoles(userFound._id.toHexString());
    // console.log('roles are');
    // console.log(roles);
    const iat = Math.ceil(Date.now() / 1000);
    const exp = iat + 60 * 60 * 24;
    const payload = {
      iat,
      exp,
      sub: {
        _id: userFound._id.toHexString(),
        username: userFound.username,
        roles,
        facility: userFound.facility,
        department: userFound.department
      }
    };
    const token = jwt.encode(payload, config.jwtSecret);
    return res.json({
      token,
      displayName: userFound.displayName, // when including displayName in the token, the atob result is messy for Chinese characters
      settings: userFound.settings
    })

  }).catch(function(err) {
    console.log('caught an error in authenticate');
    console.log(err);
    return res.status(500).json({
      err
    });
  });
});

module.exports = router;

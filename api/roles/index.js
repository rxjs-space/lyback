const router = require('express').Router();
// const bcrypt = require('bcrypt');
const jwt = require("jwt-simple"); 
const co = require('co');
const myAcl = require('../../my-acl');

const dbX = require('../../db');

const saltRounds = 10;

router.post('/', function(req, res) {
  res.send('at roles');
})

router.get('/', (req, res) => {
  co(function*() {
    const db = yield dbX.dbPromise;
    const roleList = yield db.collection('acl_roles').find({}, {_id: 0, key: 1}).toArray();
    const roleKeyList = roleList.map(item => item.key);
    res.json(roleKeyList);
  }).catch(function(err) {
    return res.status(500).json(err.stack);
  });
})



module.exports = router;

const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require("jwt-simple"); 
const co = require('co');
const ObjectID = require('mongodb').ObjectID;
const myAcl = require('../../my-acl');

const dbX = require('../../db');

const saltRounds = 10;

router.get('/', (req, res) => {
  co(function*() {
    const db = yield dbX.dbPromise;
    const userList = yield db.collection('users').find({}, {password: 0}).toArray();
    res.json(userList);
  }).catch(function(err) {
    return res.status(500).json(err.stack);
  });
  // res.send('ok');
})

router.get('/one', (req, res) => {
  if (!req.query.userId && !req.query.username) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  
  switch (true) {
    case !!req.query.userId:

      const userId = new ObjectID(req.query.userId);
      co(function*() {
        const db = yield dbX.dbPromise;
        const docs = yield db.collection('users').find({_id: userId}, {password: 0}).toArray();
        if (!docs.length) {return res.status(400).json({
          message: `no user whose id is ${userId}`
        })}
        const user = docs[0];
        const userRecordsInACL = 
          yield db.collection('acl_users').find({key: req.query.userId}, {_id: 0, key: 0}).toArray();
        const userRolesObj = userRecordsInACL[0];
        user.roles = userRolesObj ? Object.keys(userRolesObj) : [];
        return res.send(user);
      }).catch((err) => {
        return res.status(500).json(err.stack);
      })


      break;
    case !!req.query.username:
      const username = req.query.username;
      co(function*() {
        const db = yield dbX.dbPromise;
        const docs = yield db.collection('users').find({username}, {password: 0}).toArray();
        if (!docs.length) {return res.status(400).json({
          message: `no user whose name is ${username}`
        })}
        const user = docs[0];
        // console.log(user._id.toHexString());
        const userRecordsInACL = 
          yield db.collection('acl_users').find({key: user._id.toHexString()}, {_id: 0, key: 0}).toArray();
        const userRolesObj = userRecordsInACL[0];
        user.roles = userRolesObj ? Object.keys(userRolesObj) : [];
        return res.send(user);
        // res.send('ok');
      }).catch((err) => {
        return res.status(500).json(err.stack);
      })

      break;
  }

  // res.send('ok');
})

/* return staffs of the facility which current user belongs to */
router.get('/staffs', (req, res) => {
  co(function*() {
    const db = yield dbX.dbPromise;
    const staffs = yield db.collection('users').find({
      facility: req.user.facility,
    }, {username: 1, displayName: 1}).toArray();
    res.json(staffs);
  }).catch(function(err) {
    return res.status(500).json(err.stack);
  });
  // res.json(req.user);
})

router.post('/', (req, res) => {
  if (!req.body.username ||!req.body.password || !req.body.displayName) return res.status(400).json({
    message: 'Usernme or password or display name is missing.'
  });
  /* consider adding verification for username and password */

  const username = req.body.username;
  const displayName = req.body.displayName;
  const password = req.body.password;
  const roles = req.body.roles || ['guest'];
  co(function*() {
    const hash = yield bcrypt.hash(password, saltRounds);
    const db = yield dbX.dbPromise;
    // const db = dbX.db;
    const itemToInsert = {
      username,
      password: hash,
      displayName,
      createdBy: req.user._id,
      createdAt: (new Date()).toISOString(),
      isActive: true,
      facility: req.body.facility,
      department: req.body.department
    }
    const insertResult = yield db.collection('users').insertOne(itemToInsert);
    const updateVersionResult = yield db.collection('versions').updateOne({
      collection: 'users'
    }, {
      '$set': {version: `${(new Date()).toISOString().substring(0, 10)}:${Math.random()}`}
    }, {
      upsert: true
    });
    // mongodb driver will add _id to itemToInsert after above ops
    const aclInstance = yield myAcl.aclInstancePromise;
    const aclResult = yield aclInstance.addUserRoles(itemToInsert._id.toHexString(), roles)
    // db.close();
    delete itemToInsert.password;
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

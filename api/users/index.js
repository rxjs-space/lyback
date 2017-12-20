const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require("jwt-simple"); 
const co = require('co');
const ObjectID = require('mongodb').ObjectID;
const MongoError = require('mongodb').MongoError;

const toMongodb = require('jsonpatch-to-mongodb');

const myAcl = require('../../my-acl');

const dbX = require('../../db');
const collectionName = 'users';

const saltRounds = 10;

const postSearch = (req, res) => {

  if (!req.body) {
    return res.status(400).json({
      message: 'No search params provided.'
    });
  }
  const searchParams = JSON.parse(JSON.stringify(req.body));
  const isFindOne = !!searchParams._id;


  co(function*() {
    const db = yield dbX.dbPromise;
    let project, searchResult;
    if (isFindOne) {
      searchParams._id = new ObjectID(searchParams._id);
      projection = {password: 0};
      searchResult = yield db.collection(collectionName).find(searchParams, projection).toArray();
      if (searchResult.length) {
        // get userRoles
        const aclInstance = yield myAcl.aclInstancePromise;
        const userRoles = yield aclInstance.userRoles(req.body._id);
        searchResult[0]['roles'] = userRoles;
      }
    } else {
      projection = {password: 0, settings: 0};
      searchResult = yield db.collection(collectionName).find(searchParams, projection).toArray();
    }
    return res.json(searchResult);
  }).catch(error => {
    if (error instanceof MongoError) {
      // front end will check if error contains error code like 'E11000' using error.indexOf
      return res.status(500).json(error.toString());
    } else {
      return res.status(500).json(error.stack);
    }
  })

}

router.post('/search', postSearch);

/* 
  GET /
  return only users of the same facility as for req.user
  if req.user.facility === 'f000', return all the users
*/
router.get('/', (req, res) => {
  // co(function*() {
  //   const db = yield dbX.dbPromise;
  //   const userList = yield db.collection('users').find({}, {password: 0}).toArray();
  //   res.json(userList);
  // }).catch(function(err) {
  //   return res.status(500).json(err.stack);
  // });

  co(function*() {
    const db = yield dbX.dbPromise;
    const query = req.user.facility === 'f000' ?
      {} :
      {facility: {$in: [req.user.facility, 'f000']}};
    const users = yield db.collection('users').find(query, {username: 1, displayName: 1}).toArray();
    res.json(users);
  }).catch(function(err) {
    return res.status(500).json(err.stack);
  });
  // res.json(req.user);


})



router.patch('/', (req, res) => {
  // a user can edit its own record
  // a admin can edit all the records
  const editorUserId = req.user._id; // this is an ObjectID instance
  const targetUserId = req.query._id; // this is a string
  if (!targetUserId) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  if (!req.body || !req.body.patches) {
    return res.status(400).json({
      message: 'no data provided.'
    })
  }

  const sameUser = JSON.stringify(editorUserId) === JSON.stringify(targetUserId);
  co(function*() {
    const db = yield dbX.dbPromise;

    let canPatch = sameUser;
    if (!canPatch) { // check if editor is admin
      const aclInstance = yield myAcl.aclInstancePromise;
      canPatch = yield aclInstance.hasRole(JSON.parse(JSON.stringify(editorUserId)), 'admin');
    }
    if (!canPatch) {
      return res.status(401).json({error: 'not authorized'});
    } else {
      console.log('patches', req.body.patches);
      const rolesToAdd = [];
      const rolesIndexToRemove = [];
      const patchesX = [];
      req.body.patches.forEach(p => {
        switch (true) {
          case p.path.indexOf('roles') > -1 && (p.op === 'replace' || p.op === 'add'):
            rolesToAdd.push(p.value);
            break;
          case p.path.indexOf('roles') > -1 && (p.op === 'remove'):
            rolesIndexToRemove.push(+p.path.split('/')[2]);
            break;
          case p.path.indexOf('password') > -1:
            // hash pasword
            const pX = JSON.parse(JSON.stringify(p));
            patchesX.push(p);
            break;
          default:
            patchesX.push(p);
        }
      })
      let patchResultR = {};
      let patchResultX;
      // deal with roles changes
      if (rolesToAdd.length || rolesIndexToRemove.length) {
        const aclInstance = yield myAcl.aclInstancePromise;
        const userRolesBefore = yield aclInstance.userRoles(targetUserId);
        // deal with removed roles
        let userRolesAfter = rolesIndexToRemove.length ? userRolesBefore.reduce((acc, curr, index) => {
          if (rolesIndexToRemove.indexOf(index) === -1) {
            acc.push(curr);
          }
          return acc;
        }, []) : JSON.parse(JSON.stringify(userRolesBefore));
        userRolesAfter = [...userRolesAfter, ...rolesToAdd]; // not caring the duplicated ones, acl.addUserRoles will ignore them
        // console.log(userRolesBefore);
        // console.log(rolesToAdd);
        // console.log(rolesIndexToRemove);
        // console.log(userRolesAfter);
        // reset roles by remove all and adding userRolesAfter
        yield aclInstance.removeUserRoles(targetUserId, userRolesBefore);
        yield aclInstance.addUserRoles(targetUserId, userRolesAfter);
        patchResultR.roles = 'done';
      }

      // deal with the rest
      if (patchesX.length) {
        const patchesToApply = toMongodb(req.body.patches);
        console.log('patchesToApply', patchesToApply);
        // todo: deal with password
        patchResultX = yield db.collection('users').updateOne(
          {_id: new ObjectID(targetUserId)},
          patchesToApply
        );
      }

      res.json(Object.assign({}, patchResultX, patchResultR));
    }
  }).catch(err => {
    return res.status(500).json(err.stack);
  })


  // res.json({editorUserId, targetUserId, sameUser})
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

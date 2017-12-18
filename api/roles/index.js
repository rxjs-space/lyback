const router = require('express').Router();
// const bcrypt = require('bcrypt');
const jwt = require("jwt-simple"); 
const co = require('co');
const coForEach = require('co-foreach');
const ObjectID = require('mongodb').ObjectID;
const myAcl = require('../../my-acl');

const dbX = require('../../db');

const saltRounds = 10;

const roles = [
  'admin',
  'operationOperator',
  'operationManager',
  'producationOperator',
  'productionManager',
  'accountingOperator',
  'accountingManager',
  'management',
]

const resources = [
  '/api/brands', '/api/brands/one',
  '/api/customers', '/api/customers/one', '/api/customers/reports',
  '/api/dismantling-orders', '/api/dismantling-orders/one', '/api/dismantling-orders/reports',
  '/api/dismantling-prepare', '/api/dismantling-prepare/reports',
  '/api/inventory', '/api/inventory/query', '/api/inventory/reports',
  '/api/payments-to-owner', '/api/payments-to-owner/reports',
  '/api/prices',
  '/api/sales', '/api/sales/one', '/api/sales/reports',
  '/api/surveys', '/api/surveys/reports',
  '/api/tt', '/api/tt/one',
  '/api/users', '/api/users/one', '/api/users/role', '/api/users/staffs',
  '/api/vehicles', '/api/vehicles/one', '/api/vehicles/reports',
  '/api/versions', '/api/versions/compare'
];

const postSearch = (req, res) => {
  /**
   * returns a role
   * Role {
   *   key: string;
   *   users: User[];
   *   parents: string[];
   *   resources: any[];
   * }
   */
  if (!req.body || !req.body.roleName) {
    return res.status(400).json({
      message: 'Insufficient params provided.'
    });
  }
  const roleName = req.body.roleName;
  const role = {};
  co(function*() {
    const db = yield dbX.dbPromise;
    const aclInstance = yield myAcl.aclInstancePromise;
    const roleUsersObj = yield db.collection('acl_roles').findOne({key: roleName}, {_id: 0, key: 0});
    if (!roleUsersObj) {
      return res.status(400).json({
        message: `no such role as '${roleName}'.`
      })
    }
    const roleUserIds = Object.keys(roleUsersObj).reduce((acc, curr) => {
      return roleUsersObj[curr] ? [...acc, curr] : [...acc];
    }, []).map(id => new ObjectID(id));
    const roleUsers = yield db.collection('users').find({_id: {$in: roleUserIds}}, {password: 0, settings: 0}).toArray();
    role.key = roleName;
    role.users = roleUsers;
    const roleResources = yield aclInstance.whatResources(roleName);
    role.resources = roleResources;
    const roleParents = yield db.collection('acl_parents').findOne({key: roleName}, {_id: 0, key: 0});
    role.parents = roleParents;
    res.json(role);
  }).catch(err => {
    return res.status(500).json(err.stack);
  })
}

router.post('/search', postSearch);

router.post('/', function(req, res) {
  res.send('at roles');
});

router.get('/', (req, res) => {
  co(function*() {
    const db = yield dbX.dbPromise;
    const rolesObjList = yield db.collection('acl_roles').find({}, {_id: 0}).toArray();
    const rolesNameCountList = rolesObjList.map(roleObj => ({
      name: roleObj.key,
      count: Object.keys(roleObj).length - 1
    }));
    res.json(rolesNameCountList);
  }).catch(function(err) {
    return res.status(500).json(err.stack);
  });
});

const getPermissions = (req, res) => {
  // get current role permissions [whatResources]
  const currentRole = req.body.role;

  co(function*() {
    const db = yield dbX.dbPromise;
    const aclInstance = yield myAcl.aclInstancePromise;
    const thosePermissions = yield aclInstance.whatResources(currentRole);
    res.json(thosePermissions);
  }).catch(err => {
    return res.status(500).json(err.stack);
  })
}

const addPermissions = (req, res) => {
  // add permission to role [allow]
  const currentRole = req.body.role;
  const resourcesPermissions = req.body.rps;
  if (!(resourcesPermissions instanceof Array) || !resourcesPermissions.length) {
    return res.status(400).json({
      message: 'bad data'
    })
  }
  co(function*() {
    const db = yield dbX.dbPromise;
    const aclInstance = yield myAcl.aclInstancePromise;

    yield coForEach(resourcesPermissions, function*(rp) {
      if (resources.indexOf(rp['r']) > -1) {
        const opResult = yield aclInstance.allow(
          currentRole, rp['r'], rp['p']);
      } else {
        throw new Error('bad resource');
      }
    });
    res.json({
      done: true
    })
    // const thosePermissions = yield aclInstance.whatResources(currentRole);
    // res.json(thosePermissions);
  }).catch(err => {
    // console.log(err);
    if (err.stack.indexOf('bad resource') > -1) {
      return res.status(400).json({
        message: 'requested resouce does not exist'
      })
    } else {
      return res.status(500).json(err.stack);      
    }
  })
}

router.post('/permissions', (req, res) => {
  const currentRole = req.body.role;
  const operation = req.body.op;
  const resourcesPermissions = req.body.rps;
  if (!currentRole || !operation) {
    return res.status(400).json({
      message: 'insufficient parameters'
    })
  }
  if (roles.indexOf(currentRole) === -1) {
    return res.status(400).json({
      message: 'invalid role'
    })
  }
  if (operation !== 'get' && !resourcesPermissions) {
    return res.status(400).json({
      message: 'insufficient parameters'
    })
  }
  
  switch (operation) {
    case 'get':
      return getPermissions(req, res);
    case 'add':
      return addPermissions(req, res);
    case 'remove':
      break;
    default:
      return res.status(400).json({
        message: 'bad operation'
      })
  }
});

// get current role permissions [whatResources]
// add permission to role [allow]
// remove permission from a role [removeAllow]

// add role parent(s) [addRoleParents]
// remove role parent(s) [removeRoleParents]

// list all users of a role [roleUsers]

// add role [allow]
// remove role [removeRole]

module.exports = router;

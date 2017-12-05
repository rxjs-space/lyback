const router = require('express').Router();
// const bcrypt = require('bcrypt');
const jwt = require("jwt-simple"); 
const co = require('co');
const coForEach = require('co-foreach');
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

router.post('/', function(req, res) {
  res.send('at roles');
});

router.get('/', (req, res) => {
  co(function*() {
    const db = yield dbX.dbPromise;
    const rolesObjList = yield db.collection('acl_roles').find({}, {_id: 0, key: 1}).toArray();
    const rolesList = rolesObjList.map(item => item.key);
    res.json(rolesList);
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

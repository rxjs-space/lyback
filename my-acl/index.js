const dbX = require('../db');
const acl = require('acl-mirror');
const co = require('co');
let aclInstance;

module.exports = {
  // get aclInstancePromise() {
  //   if (aclInstance) {
  //     return Promise.resolve(aclInstance);
  //   } else {
  //     return co(function*() {
  //       const db = yield dbX.dbPromise;
  //       // const db = dbX.db;
  //       aclInstance = new acl(new acl.mongodbBackend(db, 'acl_'));
  //       return aclInstance;
  //     }).catch(err => {
  //       console.log('err at aclInstancePromise', err);
  //       return res.status(500).json(err.stack);
  //     })
  //   }
  // },
  get aclInstancePromise() {
    return co(function*() {
      const db = yield dbX.dbPromise;
      // const db = dbX.db;
      aclInstance = new acl(new acl.mongodbBackend(db, 'acl_'));
      return aclInstance;
    }).catch(err => {
      console.log('err at aclInstancePromise', err);
      return res.status(500).json(err.stack);
    })
  },
  middlleware() {
    const self = this;
    return (req, res, next) => {
      co(function*() {
        const aclInstance = yield self.aclInstancePromise;
        const id = req.user._id.toHexString();
        yield aclInstance.removeResource('/api/inventory/');
        yield aclInstance.removeResource('/api/tt0');
        yield aclInstance.removeResource('/vehicles');
        yield aclInstance.removeResource('vehicles');
        yield aclInstance.removeResource('/api/tt1');
        yield aclInstance.removeResource('*');
        yield aclInstance.removeResource('brands/models/list');
        yield aclInstance.removeResource('/api/types');

        yield aclInstance.allow('admin', '/api/roles/search', '*');
        yield aclInstance.allow('operationOperator', '/api/roles/search', ['post']);
        yield aclInstance.allow('operationOperator', '/api/users', ['patch']);
        yield aclInstance.allow('admin', '/api/users/search', '*');
        yield aclInstance.allow('operationOperator', '/api/users/search', ['post']);
        yield aclInstance.allow('admin', '/api/prices-v2/search', '*');
        yield aclInstance.allow('operationOperator', '/api/prices-v2/search', ['post']);
        yield aclInstance.allow('operationOperator', '/api/brands', ['patch']);
        yield aclInstance.allow('admin', '/api/prices-v2', '*');
        yield aclInstance.allow('operationOperator', '/api/prices-v2', ['post', 'get', 'patch']);
        yield aclInstance.allow('admin', '/api/brands/models/list', '*');
        yield aclInstance.allow('operationOperator', '/api/brands/models/list', 'post');
        yield aclInstance.allow('admin', '/api/customers', '*');
        yield aclInstance.allow('operationOperator', '/api/customers', ['post', 'get', 'patch']);
        yield aclInstance.allow('admin', '/api/pws', '*');
        yield aclInstance.allow('operationOperator', '/api/pws', ['post', 'get', 'patch']);
        yield aclInstance.allow('admin', '/api/customers/one', '*');
        yield aclInstance.allow('admin', '/api/customers/reports', '*');
        yield aclInstance.allow('operationOperator', '/api/customers/reports', ['get']);
        yield aclInstance.allow('admin', '/api/sales/reports', '*');
        yield aclInstance.allow('operationOperator', '/api/sales/reports', ['get']);
        yield aclInstance.allow('admin', '/api/sales', '*');
        yield aclInstance.allow('operationOperator', '/api/sales', ['post', 'get', 'patch']);
        yield aclInstance.allow('admin', '/api/sales/one', '*');
        yield aclInstance.allow('admin', '/api/roles/permissions', '*');
        // yield aclInstance.allow('admin', '/api/payments-to-owner/reports', '*');
        // yield aclInstance.allow('operationOperator', '/api/payments-to-owner', ['post', 'get', 'patch']);
        // yield aclInstance.allow('operationOperator', '/api/users/one', 'patch');
// 
        // yield aclInstance.removeUserRoles(id, 'user');
        // yield aclInstance.addUserRoles(id, 'admin');
        yield aclInstance.addRoleParents('accountingManager', ['accountingOperator']);
        // yield aclInstance.allow('operationOperator', '/api/vehicles', ['get', 'post']);
        // yield aclInstance.allow('operationOperator', '/api/vehicles/one', ['get', 'patch']);
        // yield aclInstance.allow('operationOperator', '/api/brands', ['get', 'post']);
        // yield aclInstance.allow('operationOperator', '/api/tt/one', ['get']);

        console.log('acl middleware:', req.user.username, req.method, req.originalUrl, (new Date()).toISOString());

        /*
          middleware( [numPathComponents, userId, permissions] )
          0 for all the components in the path
        */
        return aclInstance.middleware(0, id)(req, res, next);
      }).catch(err => {
        console.log('err at acl middleware', err);
        return res.status(500).json(err.stack);
      })
    }
  }
}


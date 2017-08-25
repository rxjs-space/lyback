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
        // yield aclInstance.allow('admin', '/api/prices', '*');
        // yield aclInstance.allow('admin', '/api/inventory/query', '*');
        // yield aclInstance.allow('operationOperator', '/api/inventory/query', 'post');
        // yield aclInstance.allow('operationOperator', '/api/prices', ['get']);
        // yield aclInstance.allow('operationOperator', '/api/inventory/reports', ['get']);
        // yield aclInstance.allow('operationOperator', '/api/vehicles/reports', ['get']);
        // yield aclInstance.allow('operationOperator', '/api/dismantling-orders', ['post']);
        // yield aclInstance.removeUserRoles(id, 'user');
        // yield aclInstance.addUserRoles(id, 'admin');
        // yield aclInstance.addRoleParents('operationManager', ['operationOperator']);
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


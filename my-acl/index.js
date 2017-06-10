const dbX = require('../db');
const acl = require('acl');
const co = require('co');
let aclInstance;

module.exports = {
  get aclInstancePromise() {
    if (aclInstance) {
      return Promise.resolve(aclInstance);
    } else {
      return co(function*() {
        const db = yield dbX.dbPromise;
        // const db = dbX.db;
        aclInstance = new acl(new acl.mongodbBackend(db, 'acl_'));
        return aclInstance;
      }).catch(err => {
        return res.json(err.stack);
      })
    }
  },
  get middlleware() {
    const self = this;
    return (req, res, next) => {
      co(function*() {
        const aclInstance = yield self.aclInstancePromise;
        const id = req.user._id.toHexString();
        // yield aclInstance.allow('admin', '/api/backup', '*');
        // yield aclInstance.allow('admin', '/api/vehicles/one', '*');
        // yield aclInstance.allow('admin', '/api/users', '*');
        // yield aclInstance.allow('member', 'blogs', ['get', 'post', 'put'])
        // yield acl.addUserRoles('joed', 'guest')
        // yield aclInstance.removeUserRoles(id, 'user');
        // yield aclInstance.addUserRoles(id, 'admin');
        yield aclInstance.addRoleParents('operationManager', ['operationOperator']);
        // yield aclInstance.allow('operationOperator', '/api/vehicles', ['get', 'post']);
        // yield aclInstance.allow('operationOperator', '/api/vehicles/one', ['get', 'patch']);
        // yield aclInstance.allow('operationOperator', '/api/brands', ['get', 'post']);
        // yield aclInstance.allow('operationOperator', '/api/tt/one', ['get']);

        console.log(req.user.username, req.method, req.originalUrl, (new Date()).toISOString());

        /*
          middleware( [numPathComponents, userId, permissions] )
          0 for all the components in the path
        */
        return aclInstance.middleware(0, id)(req, res, next);
      }).catch(err => {
        return res.json(err.stack);
      })
    }
  }
}


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
        // aclInstance.allow('admin', '/api/users', '*');
        // aclInstance.allow('member', 'blogs', ['get', 'post', 'put'])
        // acl.addUserRoles('joed', 'guest')
        // yield aclInstance.removeUserRoles(id, 'user');
        // yield aclInstance.addUserRoles(id, 'admin');
        // yield aclInstance.addRoleParents('admin', ['user']);
        console.log(req.user.username, 'accessing', req.originalUrl);
        return aclInstance.middleware(0, id)(req, res, next);
      }).catch(err => {
        return res.json(err.stack);
      })
    }
  }
}


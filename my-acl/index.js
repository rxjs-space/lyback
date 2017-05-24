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
        // const db = yield dbX.dbPromise;
        const db = dbX.db;
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
        console.log('accessing', req.originalUrl);
        return aclInstance.middleware(0, id)(req, res, next);
      }).catch(err => {
        return res.json(err.stack);
      })
    }
  }
}


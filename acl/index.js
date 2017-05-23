const dbX = require('./db');
const acl = require('acl');
let aclInstance;

dbX.db.then(db => {
  console.log('db connected');
  aclInstance = new acl(new acl.mongodbBackend(db, 'acl_'));
  aclInstance.allow('user', 'vehicles', 'view').then(data => console.log(data));
  aclInstance.addUserRoles('baoshijie', 'user');
  // aclInstance.addRoleParents('admin', 'user');
  aclInstance.isAllowed('baoshijie', 'vehicles', 'view', (err, res) => {
    console.log(err);
    if (res) {
      console.log('user baoshijie is allowed to view vehicles');
    }
  })
})

module.exports = {
  aclInstance
}
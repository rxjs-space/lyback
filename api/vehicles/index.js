const router = require('express').Router();
const co = require('co');
const myAcl = require('../../my-acl');

const someMW = (req, res, next) => {
  next(new Error('xyz'));
}


router.use(myAcl.middlleware);

router.get('/', (req, res) => {
  return res.json(req.user);
})
module.exports = router;
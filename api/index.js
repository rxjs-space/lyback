const router = require('express').Router();
const vehicles = require('./vehicles');
const products = require('./products');
const users = require('./users');
const myAcl = require('../my-acl');

router.use(myAcl.middlleware);

router.use('/vehicles', vehicles);
router.use('/products', products);
router.use('/users', users);
module.exports = router;

const router = require('express').Router();
const vehicles = require('./vehicles');
const products = require('./products');
const users = require('./users');
const roles = require('./roles');
const tt = require('./tt');
const backup = require('./backup');
const dismantlingOrders = require('./dismantling-orders');
const brands = require('./brands');
const inventory = require('./inventory');
const batches = require('./batches');
const stats = require('./stats');
const prices = require('./prices');
const versions = require('./versions');
const dismantlingPrepare = require('./dismantling-prepare');
const myAcl = require('../my-acl');
const myPassport = require('../my-passport')();

router.use(myPassport.authenticate());
router.use(myAcl.middlleware());


router.use('/vehicles', vehicles);
router.use('/products', products);
router.use('/users', users);
router.use('/roles', roles);
router.use('/tt', tt);
router.use('/backup', backup);
router.use('/stats', stats);
router.use('/brands', brands);
router.use('/inventory', inventory);
router.use('/batches', batches);
router.use('/prices', prices);
router.use('/versions', versions);
router.use('/dismantling-prepare', dismantlingPrepare);
router.use('/dismantling-orders', dismantlingOrders);
module.exports = router;

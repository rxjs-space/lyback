```javascript
// departments: accounting, planning, production, sales, inventory
// roles: admin -> supervisor -> user -> guest
// resouces

const vehicles = '/api/vehicles';
const products = '/api/products';
const dismantlingOrders = '/api/dismantling-orders';
const surveyOrders = '/api/survey-orders';
const salesOrders = '/api/sales-orders';
const truckingOrders = '/api/trucking-orders';
const users = '/api/users';

const apis = [
  vehicles,
  products,
  dismantlingOrders,
  surveyOrders,
  salesOrders,
  truckingOrders,
  users
]

acl.allow([
  {
    roldes: ['admin'],
    allows: [
      {resources: [...apis], permissions: '*'}
    ]
  },
    {
        roles:['guest', 'member'],
        allows:[
            {resources:'blogs', permissions:'get'},
            {resources:['forums', 'news'], permissions:['get', 'put', 'delete']}
        ]
    },
    {
        roles:['gold', 'silver'],
        allows:[
            {resources:'cash', permissions:['sell', 'exchange']},
            {resources:['account', 'deposit'], permissions:['put', 'delete']}
        ]
    }
])


//
acl.addUserRoles('joed', 'guest')

//
acl.addRoleParents('baz', ['foo', 'bar'])

```
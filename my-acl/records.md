
```javascript
  aclInstance.allow('admin', '/api/users', '*');
  aclInstance.allow('admin', '/api/roles', '*');
        // yield aclInstance.allow('operationOperator', '/api/vehicles', ['get', 'post']);
        // yield aclInstance.allow('operationOperator', '/api/vehicles/one', ['get', 'patch']);
        // yield aclInstance.allow('operationOperator', '/api/brands', ['get', 'post']);
        // yield aclInstance.allow('operationOperator', '/api/tt/one', ['get']);
        // yield aclInstance.allow('admin', '/api/backup', '*');
        // yield aclInstance.allow('admin', '/api/vehicles/one', '*');
        // yield aclInstance.allow('admin', '/api/users', '*');
        yield aclInstance.allow('admin', '/api/dismantling-orders/one', '*');
        yield aclInstance.allow('admin', '/api/dismantling-orders', '*');
        yield aclInstance.allow('operationOperator', '/api/dismantling-orders/one', ['get', 'patch']);
        yield aclInstance.allow('operationOperator', '/api/dismantling-orders', ['get']);
        yield aclInstance.allow('admin', '/api/dismantling-orders/reports', '*');
        yield aclInstance.allow('operationOperator', '/api/dismantling-orders/reports', ['get']);
        yield aclInstance.allow('admin', '/api/vehicles/reports', '*');
        yield aclInstance.allow('operationOperator', '/api/vehicles/reports', ['get']);
```


roles:
admin
management
operationManager
operationOperator
accountingManger
accountingOperator
productionManger
productionOperator
guest


resources:
/api/users post get
/api/users/one patch get (not using /api/user/:id, because don't know how to setup acl for that)
/api/roles post get
/api/roles/one patch get

/api/vehicles post get(with field projection)
/api/vehicles/one patch get
/api/vehicles/reports get

/api/dismantling-orders GET
/api/dismantling-orders/one GET PATCH
/api/dismantling-orders/reports

/api/products
/api/products/one

/api/sales-orders
/api/sales-orders/one

/api/tt post
/api/tt/types patch get
/api/tt/titles patch get

/api/brands post get
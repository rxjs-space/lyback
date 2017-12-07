#20171009
db.vehicles.updateMany({'status.dismantlingPrepare.done': true, 'status.dismantled.done': false, 'status2.dismantlingPrepareBatchIds': {$size: 0}}, {$set: {'status.dismantled.done': true}})

clear dismantlingOrders, dismantlingOrderPatches, inventory, inventoryPatches

db.dismantlingPrepareBatches.updateMany({}, {$set: {completed: true}})

#2017123 (done)
> var cursor = db.vehicles.find({"vehicle.registrationDate": {"$exists": true, "$type": 2}});
> while (cursor.hasNext()) {var doc = cursor.next(); db.vehicles.update({"_id": doc._id}, {"$set": {"vehicle.registrationDate": new ISODate(doc.vehicle.registrationDate)}});}

#20171025 (done)
set unique index for 'name' of collection 'customers'

#20171023 (done)
add idString to inventory

#20171206 (done)
add models to brands
// get brandId for each brand
// get models list for that brand
// update that brand to have models list
```javascript
  // use longyundb
  var cursor = db.brands.find();
  while (cursor.hasNext()) {
    var doc = cursor.next();
    var brandId = doc._id.valueOf();
    var vehicle = db.vehicles.findOne({
      'vehicle.brand': brandId
    });
    var result = db.vehicles.aggregate([
      {$match: {
        'vehicle.brand': brandId
      }},
      {$group: {
        _id: {
          'model': '$vehicle.model',
        },
      }}
    ]).toArray();
    result = result.map(r => r._id.model);
    db.brands.update({"_id": doc._id}, {"$set": {"models": result}});

  }

```

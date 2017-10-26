#20171009
db.vehicles.updateMany({'status.dismantlingPrepare.done': true, 'status.dismantled.done': false, 'status2.dismantlingPrepareBatchIds': {$size: 0}}, {$set: {'status.dismantled.done': true}})

clear dismantlingOrders, dismantlingOrderPatches, inventory, inventoryPatches

db.dismantlingPrepareBatches.updateMany({}, {$set: {completed: true}})

#2017123
> var cursor = db.vehicles.find({"vehicle.registrationDate": {"$exists": true, "$type": 2}});
> while (cursor.hasNext()) {var doc = cursor.next(); db.vehicles.update({"_id": doc._id}, {"$set": {"vehicle.registrationDate": new ISODate(doc.vehicle.registrationDate)}});}

#20171025
set unique index for 'name' of collection 'customers'
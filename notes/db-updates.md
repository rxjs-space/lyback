#20171009
db.vehicles.updateMany({'status.dismantlingPrepare.done': true, 'status.dismantled.done': false, 'status2.dismantlingPrepareBatchIds': {$size: 0}}, {$set: {'status.dismantled.done': true}})

clear dismantlingOrders, dismantlingOrderPatches, inventory, inventoryPatches

db.dismantlingPrepareBatches.updateMany({}, {$set: {completed: true}})
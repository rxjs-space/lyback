# useless line for making a new commit

20170904 last 36afbc4e8a7d3bbef6523951651fd60d74a0f682

- for async op iterations, like inserting a bunch of docs into a collection
```js
function IterateOver(list, iterator, callback) {
    // this is the function that will start all the jobs
    // list is the collections of item we want to iterate over
    // iterator is a function representing the job when want done on each item
    // callback is the function we want to call when all iterations are over

    var doneCount = 0;  // here we'll keep track of how many reports we've got

    function report() {
        // this function resembles the phone number in the analogy above
        // given to each call of the iterator so it can report its completion

        doneCount++;

        // if doneCount equals the number of items in list, then we're done
        if(doneCount === list.length)
            callback();
    }

    // here we give each iteration its job
    for(var i = 0; i < list.length; i++) {
        // iterator takes 2 arguments, an item to work on and report function
        iterator(list[i], report)
    }
}


IterateOver(paths, function(path, report) {
    fs.readFile(path, 'utf8', function(err, data) {

        var num = parseInt(data);
        totalSum += num;

        // we must call report to report back iteration completion
        report();
    });
}, PrintTotalSum);

```


## error handling
```js
const myEmitter = new MyEmitter();

process.on('uncaughtException', (err) => {
  console.error('whoops! there was an error');
});

myEmitter.emit('error', new Error('whoops!'));
// Prints: whoops! there was an error

```

passport attach userInfo to req.user

## pitfalls
socket.io not supporting transfer object with Chinese strings very well;
```js
JSON.parse(JSON.parse(updateHash[k]['data'])) // need two stringifies, otherwise, error at heroku without details
```

## db console
mongo ds161960.mlab.com:61960/longyundb -u <dbuser> -p <dbpassword>

## db backup
mongodump --host ds161960.mlab.com -d longyundb --port 61960 --username timliu --password 2858880 --excludeCollectionsWithPrefix acl



mongodump --host ds161960.mlab.com -d longyundb --port 61960 --username timliu --password 2858880 --out dump-20171020-0915


mongorestore --host ds054289.mlab.com -d longyundb --port 54289 --username timliu --password 2858880 dump-20170817-0915/

mongorestore --host 127.0.0.1 dump-20171017-0726/
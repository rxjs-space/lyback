- db connection  
  mongo ds161960.mlab.com:61960/longyundb -u <dbuser> -p <dbpassword>  
  mongodb://<dbuser>:<dbpassword>@ds161960.mlab.com:61960/longyundb


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
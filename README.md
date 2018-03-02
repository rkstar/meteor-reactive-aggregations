# meteor-reactive-aggregations

Publish aggregations, reactively!

    meteor add rkstar:reactive-aggregations

## Usage

```
const Books = new Mongo.Collection('books');
const Authors = new Mongo.Collection('authors');

Meteor.publish('books', function() {
    const pipline = [ ...your_aggregation_pipeline ];
    const options = {
        observer: {
            query: {},
            options: {},
        },
        clientCollection: 'books.on.the.client',
        delay: 500,
    };
    Books.aggregate(this, pipeline, options);
});
```

**NOTE:** the `Collection.aggregate` function **does not return a cursor** unlike `Collection.find()`. Do not `return Collection.aggregate(...)` from your `Meteor.publish()` callback.

## THIS PACKAGE CANNOT CO-EXIST WITH meteorhacks:aggregate

I'm aware of this, so I've added this **bonus usage**! You can simply pass in a `pipeline` and/or some `options` and you will bypass all of my hard work to make aggregations reactive. **BANG!**

```
const Books = new Mongo.Collection('books');
const pipeline = [{
    $match: { ...some stuff ... }
}, {
    $lookup: {
        from: 'some.collection',
        ... etc...
    }
}];
const options = {
    ...some options...
} ;

Books.aggregate(pipeline, options):
```

---

## Collection.aggregate(subscription, pipeline, options);

* `subscription` should always be `this` in a publication.
* `pipeline` is the aggregation pipeline to execute.
* `options` **[optional]** provides further options:
  * `observer` can be provided to improve efficiency. This is an object that should contain either or both of `query` and `options` which are regular MongoDB objects used on `.find` operations.
  * `delay` (default: `250`) the time (in milliseconds) between re-runs caused by changes in any reactive collections in the aggregation.
  * `clientCollection` defaults to `collection._name` but can be overriden to sent the results to a different client-side collection.
  * `getPipelineAndOptions` **[optional]** returns an object as `{ pipeline, options }` when the aggregation is run.
  * `beforeAdd` **[optional]** is passed the document that will be added to the `clientCollection` and expects a new document to be returned. the returned document will be added to `clientCollection` instead. **the `_id` field cannot be modified here.**
  * `beforeChange` **[optional]** is passed the document that will be changed in the `clientCollection` and expects a new document to be returned. the returned document will be changed in the `clientCollection` instead. **the `_id` field cannot be modified here.**
  * `beforeRemove` **[optional]** is passed the document that will be removed from the `clientCollection`. no return value is processed as the document is simply removed from the `clientCollection`.

### Example

```
const options = {
    observer: {
        query: {
            bookId: { $exists: true }
        },
        options: {
            limit: 10,
            sort: { createdAt: -1 }
        }
    },
    clientCollection: 'books.on.the.client',
    delay: 1000,
    beforeAdd: doc => ({
        ...doc,
        totalAfterTaxes: (doc.subtotal + (doc.subtotal * doc.taxRate)),
    }),
};
```

## Multiple collections observe

By default, any **Mongo.Collection instances** passed into the aggregation pipeline in the `$lookup.from` stages will be reactive. If you wish to opt out of reactivity for a collection in your pipeline, simply use `Collection._name` as a string.

### Example

All collections reactive:

```
const pipeline = [{
    $lookup: {
        from: Books,
        localField: 'bookId',
        foreignField: '_id',
        as: 'books',
    },
    ...
    $lookup: {
        from: Authors,
        localField: 'authorName',
        foreignField: 'name',
        as: 'authors',
        // our aggregation will only get re-run if the "name" field changes in Authors
        observer: {
            query: { name: { $exists: true } },
            options: {
                limit: 10,
                sort: { birthDate: -1 },
            },
        },
    },
    ...
}];
```

Only `Books` collection is reactive:

```
const pipeline = [{
    $lookup: {
        from: Books,
        localField: 'bookId',
        foreignField: '_id',
        as: 'books',
    },
    ...
    $lookup: {
        from: Authors,
        localField: 'authorName',
        foreignField: 'name',
        as: 'authors',
    },
    ...
}];
```

---

## Credit

Much of the groundwork for this package was laid by [JcBernack](https://github.com/JcBernack) with the [meteor-reactive-aggregate](https://github.com/JcBernack/meteor-reactive-aggregate) package. I contributed to that package before deciding that I wanted it to work differently enough that it made sense to publish my own derivitive of it.

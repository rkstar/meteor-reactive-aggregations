import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
// _ underscore is global...

const defaultOptions = ({ collection, options }) => ({
  observer: {
    query: {},
    options: {}
  },
  delay: 250,
  getPipelineAndOptions: null,
  beforeAdd: null,
  beforeChange: null,
  beforeRemove: null,
  clientCollection: collection._name,
  ...options
});

function aggregateWithoutReactivity({ pipeline = [], options = {} }) {
  const collection = this.rawCollection();
  return Meteor.wrapAsync(collection.aggregate.bind(collection))(
    pipeline,
    options
  );
}

function aggregateReactively({ subscription, pipeline = [], options = {} }) {
  const collection = this.rawCollection();
  const runAggregation = Meteor.wrapAsync(
    collection.aggregate.bind(collection)
  );
  const {
    observer,
    delay,
    getPipelineAndOptions,
    beforeAdd,
    beforeChange,
    beforeRemove,
    clientCollection
  } = defaultOptions({
    collection: this,
    options
  });

  const throttledUpdate = _.throttle(
    Meteor.bindEnvironment(({ pipeline, options }) => {
      if (_.isFunction(getPipelineAndOptions)) {
        getPipelineAndOptions({ pipeline, options });
      }
      // add and update documents on the client
      runAggregation(pipeline, options).forEach(doc => {
        const { _id } = doc;
        const copy = { ...doc };
        if (!subscription._ids[_id]) {
          const handledDoc = _.isFunction(beforeAdd)
            ? { ...beforeAdd(copy), _id }
            : copy;
          subscription.added(clientCollection, _id, handledDoc);
        } else {
          const handledDoc = _.isFunction(beforeChange)
            ? { ...beforeChange(copy), _id }
            : copy;
          subscription.changed(clientCollection, _id, handledDoc);
        }
        subscription._ids[_id] = subscription._iteration;
      });
      // remove documents not in the result anymore
      _.each(subscription._ids, (iteration, key) => {
        if (iteration != subscription._iteration) {
          if (_.isFunction(beforeRemove)) {
            beforeRemove(copy);
          }
          delete subscription._ids[key];
          subscription.removed(clientCollection, key);
        }
      });
      subscription._iteration++;
    }),
    delay
  );
  const update = () =>
    !initializing
      ? throttledUpdate({ pipeline: safePipeline, options: observer.options })
      : null;

  // don't update the subscription until __after__ the initial hydrating of our collection
  let initializing = true;
  // mutate the subscription to ensure it updates as we version it
  subscription._ids = {};
  subscription._iteration = 1;

  // create a list of collections to watch and make sure
  // we create a sanitized "strings-only" version of our pipeline
  const observerHandles = [createObserver(this, observer)];
  // look for $lookup collections passed in as Mongo.Collection instances
  // and create observers for them
  // if any $lookup.from stages are passed in as strings they will be omitted
  // from this process. the aggregation will still work, but those collections
  // will not force an update to this query if changed.
  const safePipeline = pipeline.map(stage => {
    if (stage.$lookup && stage.$lookup.from instanceof Mongo.Collection) {
      const { from: collection, observer = {} } = stage.$lookup;
      observerHandles.push(createObserver(collection, observer));
      stage.$lookup.from = collection._name;
      delete stage.$lookup.observer;
    }
    return stage;
  });

  // observeChanges() will immediately fire an "added" event for each document in the query
  // these are skipped using the initializing flag
  initializing = false;
  // send an initial result set to the client
  update();
  // mark the subscription as ready
  subscription.ready();
  // stop observing the cursor when the client unsubscribes
  subscription.onStop(() => observerHandles.map(handle => handle.stop()));

  /**
   * Create observer
   * @param {Mongo.Collection|*} collection
   * @returns {any|*|Meteor.LiveQueryHandle} Handle
   */
  function createObserver(collection, { query, options }) {
    const cursor = collection.find(query || {}, options || {});
    return cursor.observeChanges({
      added: update,
      changed: update,
      removed: update,
      error: err => {
        throw err;
      }
    });
  }
}

Mongo.Collection.prototype.aggregate = function(
  subscription,
  pipeline = [],
  options = {}
) {
  return Array.isArray(subscription)
    ? aggregateWithoutReactivity.call(this, {
        pipeline: subscription,
        options:
          Array.isArray(pipeline) || !_.isObject(pipeline) ? {} : pipeline
      })
    : aggregateReactively.call(this, { subscription, pipeline, options });
};

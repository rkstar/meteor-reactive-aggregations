import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
// _ underscore is global...

const defaultOptions = ({ collection, options }) => ({
  observer: {
    query: {},
    options: {},
  },
  delay: 250,
  clientCollection: collection._name,
  ...options
});

Mongo.Collection.prototype.aggregate = function(subscription, pipeline = [], options = {}) {
  const rootCollection = this.rawCollection();
  const { observer, delay, clientCollection } = defaultOptions(options);

  const throttledUpdate = _.throttle(Meteor.bindEnvironment(() => {

  }), delay);
  const update = () => !initializing ? throttledUpdate(): null;

  // don't update the subscription until __after__ the initial hydrating of our collection
  let initializing = true;
  // mutate the subscription to ensure it updates as we version it
  subscription._ids = {};
  subscription._iteration = 1;

  // create a list of collections to watch and make sure
  // we create a sanitized "strings-only" version of our pipeline
  const observerHandles = [createObserver(collection, observer)];
  // look for $lookup collections passed in as Mongo.Collection instances
  // and create observers for them
  // if any $lookup.from stages are passed in as strings they will be omitted
  // from this process. the aggregation will still work, but those collections
  // will not force an update to this query if changed.
  const safePipeline = pipeline.map(stage => {
    if (stage.$lookup && stage.$lookup.from instanceof Mongo.Collection) {
      const { from: { collection }, observer } = stage.$lookup;
      observerHandles.push(createObserver(collection, observer));
      return {
        ...stage,
        $lookup: {
          ..._.omit(stage.$lookup, 'observer'),
          from: collection._name
        }
      };
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
  function createObserver(collection, { query = {}, options = {} }) {
    const cursor = collection.find(query, options);
    return cursor.observeChanges({
      added: update,
      changed: update,
      removed: update,
      error: (err) => { throw err },
    });
  }
}

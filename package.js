Package.describe({
  name: "rkstar:reactive-aggregations",
  version: "1.0.0",
  // Brief, one-line summary of the package.
  summary: "Publish aggregations, reactively!",
  // URL to the Git repository containing the source code for this package.
  git: "https://github.com/rkstar/meteor-reactive-aggregations",
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: "README.md"
});

Package.onUse(function(api) {
  api.versionsFrom("1.5");
  api.use(['ecmascript', 'underscore', 'mongo']);
  api.addFiles('./aggregate.js');
});

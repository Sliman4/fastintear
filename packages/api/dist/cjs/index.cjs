'use strict';

var near = require('./near');
var client = require('./client');



Object.defineProperty(exports, "createNearClient", {
  enumerable: true,
  get: function () { return client.createNearClient; }
});
Object.keys(near).forEach(function (k) {
  if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
    enumerable: true,
    get: function () { return near[k]; }
  });
});
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map
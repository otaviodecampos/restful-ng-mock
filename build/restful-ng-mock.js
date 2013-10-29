/***********************************************
* restful-ng-mock JavaScript Library
* https://github.com/AmericanCouncils/restful-ng-mock/ 
* License: MIT (http://www.opensource.org/licenses/mit-license.php)
* Compiled At: 10/29/2013 15:52
***********************************************/
(function(window) {
'use strict';
angular.module('restfulNgMock', []);

'use strict';

angular.module('restfulNgMock')
.factory('basicMock', [
'$httpBackend',
function($httpBackend) {
  var urlRe = /^(\/[\w\-]+|)(\/[\w\-]+|\/\?)*$/;
  function BasicMock(baseUrl, options) {
    this._baseUrl = baseUrl || '';
    if (!(urlRe.test(this._baseUrl))) {
      throw 'Invalid baseUrl for resourceMock: "' + baseUrl + '".';
    }

    this.options = angular.extend({}, this.DEFAULT_OPTIONS);
    this.setOptions(options || {});
  }

  BasicMock.prototype.constructor = BasicMock;

  // Nested class HttpError
  BasicMock.prototype.HttpError = (function() {
    function HttpError(code, message) {
      this.code = code;
      this.message = message;
    }
    return HttpError;
  })();

  // Nested class HttpRequest
  BasicMock.prototype.HttpRequest = (function() {
    function HttpRequest(pathArgs, method, rawUrl, url, body, headers) {
      this.pathArgs = pathArgs;
      this.method = method;
      this.rawUrl = rawUrl;
      this.url = url;
      this.rawBody = body;
      if (/^application\/json($|;)/.test(headers['Content-Type'])) {
        this.body = JSON.parse(body);
      } else {
        this.body = body;
      }
      this.headers = headers;
    }
    return HttpRequest;
  })();

  BasicMock.prototype.DEFAULT_OPTIONS = {
    debug: false,
    httpResponseInfoLabel: false
  };

  BasicMock.prototype._buildResponse = function(data, request) {
    if (angular.isUndefined(data) || data === null) {
      data = new this.HttpError(404, 'Not Found');
    }

    var responseInfo = { code: 200, message: 'OK' };
    if (data instanceof this.HttpError) {
      responseInfo.code = data.code;
      responseInfo.message = data.message;
      if (this.options.httpResponseInfoLabel) {
        data = {};
      } else {
        data = responseInfo;
      }
    }

    if (this.options.httpResponseInfoLabel) {
      data[this.options.httpResponseInfoLabel] = responseInfo;
    }

    var jsonString = JSON.stringify(data);

    if (this.options.debug) {
      var debug = this.options.debug;
      if (typeof debug !== 'function') {
        debug = this._defaultDebug;
      }
      debug(request, responseInfo, JSON.parse(jsonString));
    }

    return [
      responseInfo.code,
      jsonString,
      { 'Content-Type': 'application/json' }
    ];
  };

  BasicMock.prototype._defaultDebug = function(request, responseInfo, responseData) {
    // From http://stackoverflow.com/a/10075654/351149
    var pad = function(n, d) {
      return new Array(Math.max(d - String(n).length + 1, 0)).join(0) + n;
    };

    var d = new Date();
    var dParts = [
      pad(d.getHours(), 2),
      pad(d.getMinutes(), 2),
      pad(d.getSeconds(), 2),
      pad(d.getMilliseconds(), 3)
    ];
    console.log([
      dParts.join(':'),
      '>>> ' + request.method + ' ' + request.rawUrl,
      '<<< ' + responseInfo.code,
      responseData
    ]);
  };

  BasicMock.prototype.route = function(method, url, func) {
    if (!(urlRe.test(url))) {
      throw 'Invalid url for route: "' + url + '".';
    }
    var fullUrl = this._baseUrl + url;
    var urlPattern = fullUrl
      .replace(/\//g, '\\/')
      .replace(/\?/g, '([\\w\\-]+)');
    var re = new RegExp( '^' + urlPattern  + '(?:\\?.*)?$');

    var me = this;
    $httpBackend.when(method, re).respond(
      function(method, rawUrl, body, headers) {
        var purlUrl = purl(rawUrl, true);
        var params = re.exec(purlUrl.attr('path')).slice(1);
        var request = new me.HttpRequest(params, method, rawUrl, purlUrl, body, headers);
        var r = func.call(me, request);
        return me._buildResponse(r, request);
      }
    );
  };

  BasicMock.prototype.setOptions = function(opts) {
    var me = this;
    angular.forEach(opts, function(v, k) {
      if (typeof me.DEFAULT_OPTIONS[k] === 'undefined') {
        throw 'Invalid option key ' + k;
      }
      me.options[k] = v;
    });
    return me;
  };

  var BasicMockFactory = function(baseUrl, options) {
    return new BasicMock(baseUrl, options);
  };
  BasicMockFactory.classFn = BasicMock;
  return BasicMockFactory;
}]);

'use strict';

angular.module('restfulNgMock')
.factory('resourceMock', [
'basicMock',
function(basicMock) {
  function ResourceMock(baseUrl, dataSource, options) {
    ResourceMock._super.constructor(baseUrl, options);

    this.dataSource = dataSource || {};

    this.requiredParams = 0;
    for (var cidx = 0; cidx < baseUrl.length; ++cidx) {
      if (baseUrl.charAt(cidx) === '?') { ++this.requiredParams; }
    }

    this.route('GET', '', function(request) {
      var response = this.indexAction(request);
      return this._labelEncap(true, response);
    });

    this.route('GET', '/?', function(request) {
      var response = this.showAction(request);
      return this._labelEncap(false, response);
    });

    this.route('POST', '', function(request) {
      var response = this.createAction(request);
      return this._labelEncap(false, response);
    });

    this.route('PUT', '/?', function(request) {
      var response = this.updateAction(request);
      return this._labelEncap(false, response);
    });

    this.route('DELETE', '/?', function(request) {
      var response = this.deleteAction(request);
      return this._labelEncap(false, response);
    });
  }

  // ResourceMock extends BasicMock
  (function() {
    var BasicMock = basicMock.classFn;
    function SuperCtor() { this.constructor = ResourceMock; }
    SuperCtor.prototype = BasicMock.prototype;
    ResourceMock.prototype = new SuperCtor();
    ResourceMock._super = BasicMock.prototype;
  })();

  // Allow instances of ResourceMock to easily have instance-specific methods
  // which reference their ResourceMock "super".
  ResourceMock.prototype.parent  = ResourceMock.prototype;

  ResourceMock.prototype.DEFAULT_OPTIONS = angular.extend(
    {},
    ResourceMock._super.DEFAULT_OPTIONS,
    {
      collectionLabel: false,
      singletonLabel: false,
      skipArgumentName: false,
      limitArgumentName: false
    }
  );

  ResourceMock.prototype._labelEncap = function(plural, data) {
    if (data && !(data instanceof this.HttpError)) {
      var label = null;
      if (plural && this.options.collectionLabel) {
        label = this.options.collectionLabel;
      } else if (!plural && this.options.singletonLabel) {
        label = this.options.singletonLabel;
      }
      if (label) {
        var encapData = data;
        data = {};
        data[label] = encapData;
      }
    }

    return data;
  };

  ResourceMock.prototype.subResourceMock = function(subUrl, subDataSource, options) {
    return new ResourceMock(this._baseUrl + '/?' + subUrl, subDataSource, options);
  };

  // Returns the object used for storing mock resource items
  ResourceMock.prototype.getStorage = function(ids, autoCreate) {
    autoCreate = autoCreate || false;
    var d = this.dataSource;
    for (var i = 0; i < ids.length; ++i) {
      if (d[ids[i]]) {
        d = d[ids[i]];
      } else {
        if (autoCreate) {
          d[ids[i]] = {};
          d = d[ids[i]];
        } else {
          return null;
        }
      }
    }
    return d || null;
  };

  ResourceMock.prototype.indexAction = function(request) {
    var storage = this.getStorage(request.pathArgs);

    if (storage) {
      var keys = [];
      angular.forEach(storage, function(v, k) {
        if (/^\d+$/.test(k)) {
          k = parseInt(k, 10);
        }
        keys.push(k);
      });
      keys.sort();

      if (this.options['skipArgumentName']) {
        var skip = parseInt(request.url.param(this.options['skipArgumentName']), 10);
        if (skip) {
          keys = keys.slice(skip);
        }
      }

      if (this.options['limitArgumentName']) {
        var lim = parseInt(request.url.param(this.options['limitArgumentName']), 10);
        if (lim) {
          keys = keys.slice(0, lim);
        }
      }

      var a = [];
      angular.forEach(keys, function(k) { a.push(storage[k]); });
      return a;
    }
  };

  ResourceMock.prototype.showAction = function(request) {
    return this.getStorage(request.pathArgs);
  };

  ResourceMock.prototype.createAction = function(request) {
    var newItem = request.body;
    newItem.id = Math.round(Math.random()*Math.pow(2, 32));
    this.getStorage(request.pathArgs, true)[newItem.id] = newItem;
    return newItem;
  };

  ResourceMock.prototype.updateAction = function(request) {
    var newItem = request.body;
    var storage = this.getStorage(request.pathArgs.slice(0, -1));
    var itemId = request.pathArgs[request.pathArgs.length-1];
    if (storage && storage[itemId]) {
      newItem.id = storage[itemId].id;
      storage[itemId] = newItem;
      return newItem;
    }
  };

  ResourceMock.prototype.deleteAction = function(request) {
    var storage = this.getStorage(request.pathArgs.slice(0, -1));
    var itemId = request.pathArgs[request.pathArgs.length-1];
    if (storage && storage[itemId]) {
      var item = storage[itemId];
      delete storage[itemId];
      return item;
    }
  };

  var ResourceMockFactory = function(baseUrl, dataSource) {
    return new ResourceMock(baseUrl, dataSource);
  };
  ResourceMockFactory.classFn = ResourceMock;
  return ResourceMockFactory;
}]);

}(window));
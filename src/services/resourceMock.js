'use strict';

angular.module('restfulNgMock')
.factory('resourceMock', [
'$httpBackend',
function($httpBackend) {
  var buildJsonResponse = function(data, code) {
    code = code || 200;
    return [
      code,
      JSON.stringify(data),
      {
        'Content-Type': 'application/json'
      }
    ];
  };

  var buildJsonErrorResponse = function(code, message) {
    var data = {
      code: code,
      message: message
    };
    return buildJsonResponse(data, code);
  };

  var ResourceMock = function (baseUrl, dataSource) {
    if (!(/^\/[\w\-]+(\/[\w\-]+|\/\?)*$/).test(baseUrl)) {
      throw 'Invalid baseUrl for resourceMock: "' + baseUrl + '".';
    }

    this.baseUrl = baseUrl;
    this.dataSource = dataSource;

    this.requiredSegments = 0;
    for (var cidx = 0; cidx < baseUrl.length; ++cidx) {
      if (baseUrl.charAt(cidx) === '?') { ++this.requiredSegments; }
    }

    var urlPattern = baseUrl
      .replace('/', '\\/', 'g')
      .replace('?', '([\\w\\-]+)');
    this.baseUrlRe = new RegExp( '^' + urlPattern  + '(?:/([\\w\\-]+))?$');

    var me = this;

    $httpBackend.whenGET(new RegExp(this.baseUrlRe))
    .respond(function(method, rawUrl, data, headers) {
      return me.handle(rawUrl, data, headers, {
        atRoot: function(ids) {
          var storage = me.getStorage(ids);
          if (storage) { return buildJsonResponse(storage); }
        },
        atItem: function(superIds, itemId) {
          var storage = me.getStorage(superIds);
          if (storage && storage[itemId]) {
            return buildJsonResponse(storage[itemId]);
          }
        }
      });
    });

    $httpBackend.whenPOST(new RegExp(this.baseUrlRe))
    .respond(function(method, rawUrl, data, headers) {
      return me.handle(rawUrl, data, headers, {
        atRoot: function(ids) {
          var newItem = JSON.parse(data);
          newItem.id = Math.round(Math.random()*Math.pow(2, 32)).toString();
          me.getStorage(ids, true)[newItem.id] = newItem;
          return buildJsonResponse(newItem);
        }
      });
    });

    $httpBackend.whenPUT(new RegExp(this.baseUrlRe))
    .respond(function(method, rawUrl, data, headers) {
      return me.handle(rawUrl, data, headers, {
        atItem: function(superIds, itemId) {
          var storage = me.getStorage(superIds);
          if (storage && storage[itemId]) {
            var newItem = JSON.parse(data);
            newItem.id = itemId;
            storage[itemId] = newItem;
            return buildJsonResponse(newItem);
          }
        }
      });
    });

    $httpBackend.whenDELETE(new RegExp(this.baseUrlRe))
    .respond(function(method, rawUrl, data, headers) {
      return me.handle(rawUrl, data, headers, {
        atItem: function(superIds, itemId) {
          var storage = me.getStorage(superIds);
          if (storage && storage[itemId]) {
            delete storage[itemId];
          }
        }
      });
    });
  };

  ResourceMock.prototype = {
    handle: function(rawUrl, data, headers, handlers) {
      var url = purl(rawUrl);
      var matches = this.baseUrlRe.exec(url.attr('path')).slice(1);
      var itemIds = [];
      for (var i = 0; i < matches.length; ++i) {
        if (typeof matches[i] !== 'null' && typeof matches[i] !== 'undefined') {
          itemIds.push(matches[i]);
        }
      }

      var result;

      if (handlers.atRoot && itemIds.length === this.requiredSegments) {
        result = handlers.atRoot(itemIds, url, data, headers);
        if (result) { return result; }
      } else if (handlers.atItem && itemIds.length > this.requiredSegments) {
        var superIds = itemIds.slice(0, -1);
        var itemId = itemIds[itemIds.length-1];
        result = handlers.atItem(superIds, itemId, url, data, headers);
        if (result) { return result; }
      }

      return buildJsonErrorResponse(404, 'Not Found');
    },

    getStorage: function(ids, autoCreate) {
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
    },

    subResourceMock: function(subUrl, subDataSource) {
      return new ResourceMock(this.baseUrl + '/?' + subUrl, subDataSource);
    },
  };

  var ResourceMockFactory = function(baseUrl, dataSource) {
    return new ResourceMock(baseUrl, dataSource);
  };
  return ResourceMockFactory;
}]);

'use strict';

// Declare app level module which depends on filters, and services
var app = angular.module('csvParser', []);

app.controller('TheController', ['$scope', '$http', function($scope, $http) {

  $scope.library = [
    {
      name: 'DATE',
      desc: 'Hello Angular World',
      regex: '^((0?\d|1[012])[-\/]([012]?\d|3[01])[-\/](19|20)\d\d|(19|20)\d\d[-\/](0?\d|1[012])[-\/]([012]?\d|3[01]))$'
    }
  ];

  // Initialize variables
  $scope.config = {};
  $scope.config.headerAddCols = [];
  $scope.config.headerPatterns = {};
  $scope.config.bodyAddCols = [];
  $scope.config.bodyPatterns = {};
  $scope.config.headerMatchCol = '';
  $scope.config.headerMatchValue = '';

  // $scope.addCol = {};
  $scope.pattern = {};

  $scope.rawdata = [];
  $scope.preprocessed = [];
  $scope.results = [];

  $scope.activeFilename = '';

  $scope.tests = [];

  $scope.activeHeader = 0;
  $scope.activeCol = [];

  // For now lets initialize
  // $scope.config.headerMatchCol = 0;
  // $scope.config.headerMatchValue = 'PCA Number';
  // $scope.config.headerAddCols = ['MR','Extra','IsCastrate','PCA'];
  // $scope.config.headerPatterns = {
  //   0: [
  //     {sourceCol: 0, regex: 'PCA Number'},
  //     {sourceCol: 0, regex: 'MR#[0-9]+', destCol: 'MR'},
  //     {sourceCol: 0, regex: '(?:- Castrated|-Castrated|Castated)', destCol: 'IsCastrate'},
  //     {sourceCol: 0, regex: 'MR#' },
  //     {sourceCol: 0, regex: '\\(.+\\)', destCol: 'Extra'},
  //     {sourceCol: 0, regex: '.+', destCol: 'PCA'},
  //   ]
  // };
  // $scope.config.bodyPatterns = {
  //   0: [
  //     {sourceCol: 0, regex: '^\d{1,3}', destCol: 'PCA'},
  //     {sourceCol: 0, regex: '.+', destCol: 'Extra'},
  //   ]
  // };

  $scope.loadFile = function() {
    $http.get('/file',{'params': {'filename': $scope.activeFilename}}).
      success(function(data) {
        $scope.rawdata = data.data;
      }).
      error(function(data, status, headers, config) {
        alert("FAIL");
      });
  }

  // Formats
  // { regex: /PCA Number/ },
  // { regex: /MR#[0-9]+/, location: 1, format: function(s) { return s.slice(3) } },
  // { regex: /(- Castrated|-Castrated)/, location: 3, format: function(s) { return 'Y' } },
  // { regex: /MR#/ },
  // { regex: /\(.+\)/, location: 2, format: function(s) { return s.slice(1,-1) } },
  // { regex: /.+/, location: 4, format: function(s) { return s } },

  $scope.loadConfig = function() {
    var data = {'params': {'filename': $scope.configFile}};
    $http.get('/config', data).
      success(function(contents) {
        $scope.config = contents;
        $scope.configFileName = $scope.configFile;
      }).
      error(function(data, status, headers, config) {
        alert("Failed to load config");
      });
    }

  $scope.saveConfig = function() {
    var data = {filename: $scope.configFileName, contents: $scope.config};
    $http.post('/config', data).
      success(function(data) {
        alert("Config has been saved");
      }).
      error(function(data, status, headers, config) {
        alert("Failed to save config");
      });
    }

  $scope.addHeaderCol = function() {
    $scope.config.headerAddCols.push(angular.copy($scope.addCol));
    $scope.addCol = '';
  }

  $scope.addBodyCol = function() {
    $scope.config.bodyAddCols.push(angular.copy($scope.addCol));
    $scope.addCol = '';
  }

  $scope.removeHeaderCol = function(col) {
    var idx = $scope.config.headerAddCols.indexOf(col);
    $scope.config.headerAddCols.splice(idx,1);
  }

  $scope.removeBodyCol = function(col) {
    var idx = $scope.config.bodyAddCols.indexOf(col);
    $scope.config.bodyAddCols.splice(idx,1);
  }

  $scope.addHeaderPattern = function(pattern) {
    addPattern($scope.config.headerPatterns, pattern);
    $scope.pattern={};
  }

  $scope.addBodyPattern = function(pattern) {
    pattern.sourceCol = $scope.activeHeader;
    addPattern($scope.config.bodyPatterns, pattern);
    $scope.pattern={};
  }

  function addPattern(patterns, pattern) {
    if (!patterns[pattern.sourceCol]) {
      patterns[pattern.sourceCol] = [];
    }
    patterns[pattern.sourceCol].push(angular.copy(pattern));
  }

  $scope.removeHeaderPattern = function(pattern) {
    removePattern($scope.config.headerPatterns, pattern);
  }

  $scope.removeBodyPattern = function(pattern) {
    removePattern($scope.config.bodyPatterns, pattern);
  }

  function removePattern(patterns, pattern) {
    var idx = patterns[pattern.sourceCol].indexOf(pattern);
    patterns[pattern.sourceCol].splice(idx,1);
  }

  var processRow = function(patterns, addCols, row) {
    var xtraData = addCols.map(function() { '' } );

    angular.forEach(patterns, function(patterns, sourceCol) {
      patterns.forEach(function(p) {
        var match = p.regexcomp.exec( row[p.sourceCol] );
        if (match != null) {
          match.forEach( function(m) {
            // Hmmm this shouldn't match if its null
            if (row[p.sourceCol]) {
              row[p.sourceCol] = row[p.sourceCol].replace(m,'');
            }
            if (p['destCol']) {
              var destIdx = addCols.indexOf(p.destCol);
              // xtraData[destIdx] = p.format(m);
              if (!xtraData[destIdx]) {
                xtraData[destIdx] = '';
              }
              xtraData[destIdx] += m;
            }
          });
        }
      });
    });
    return xtraData;
  };

  $scope.hasBodyPatterns = function() {
    return !$.isEmptyObject($scope.config.bodyPatterns);
  }

  $scope.hasHeaderPatterns = function() {
    return !$.isEmptyObject($scope.config.headerPatterns);
  }

  $scope.preProcessOne = function(pattern) {
    var patternset = {};
    patternset[pattern.sourceCol] = [pattern];
    $scope.preProcess(patternset);
  }

  $scope.preProcessAll = function() {
    $scope.preProcess($scope.config.headerPatterns);
  }

  $scope.preProcess = function(patternset) {
    $scope.preprocessed = [];

    // Compile Regular Expressions
    angular.forEach(patternset, function(patterns, sourceCol) {
      patterns.forEach(function(pattern) {
        pattern.regexcomp = new RegExp(pattern.regex);
      });
    });

    var hdrData = [];
    var hasHeader = false;
    var headerRegEx = new RegExp($scope.config.headerMatchValue);
    $scope.rawdata.forEach( function(row, index) {

      // Skip empty rows
      if (row.some(function(value) { return value; })) {

        // If it is a header row
        var check = headerRegEx.exec(row[$scope.config.headerMatchCol]);
        if (check && check.length>0) {

          hdrData = processRow(
            patternset, $scope.config.headerAddCols, row
          );

          // If this is the first header
          if (!hasHeader) {

            // Add the additional header fields
            $scope.config.headerAddCols.forEach(function(hdr) {
              row.push( hdr );
            });

            // Add the header row at the top
            $scope.preprocessed.push( row );

            hasHeader = true;
          }

        // If a header row has been reached
        } else if (hasHeader) {

          // Add the additional header fields
          hdrData.forEach(function(hdr) {
            row.push( hdr );
          });

          // Add the data row
          $scope.preprocessed.push( row );
        }
      }
    });
  }

  function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
  };

  $scope.refresh = function() {
    $scope.activeCol = [];

    $scope.preprocessed.forEach(function(value,index) {
      if (index>0 && value[$scope.activeHeader]) {
        $scope.activeCol.push(value[$scope.activeHeader]);
      }
    });
    $scope.activeColUnique = $scope.activeCol.filter( onlyUnique );
  }

  $scope.testOnePattern = function(pattern) {
    testPatterns([pattern]);
  }

  $scope.testAll = function() {
    testPatterns($scope.config.bodyPatterns[$scope.activeHeader]);
  }

  function testPatterns(patterns) {
    $scope.tests = [];

    var compiled = patterns.map(function(p) {
      return new RegExp(p.regex);
    });

    var results = new Array(compiled.length);

    $scope.activeColUnique.forEach(function(val) {
      compiled.forEach(function(c,idx) {
        if (!results[idx]) { results[idx] = []; }
        var tmp = '';
        var match = c.exec(val);
        if (match) {
          if (val) {
            val = val.replace(match,'');
          }

          tmp = tmp + match;
        } else {
          tmp = '-';
        }
        results[idx].push(tmp);
      });

    });

    patterns.forEach(function(p,idx) {
      $scope.tests.push({pattern: p, results: results[idx]});
    });
  }


  $scope.generate = function() {
    $scope.results = [];

    // Compile Regular Expressions
    angular.forEach($scope.config.bodyPatterns, function(patterns, sourceCol) {
      patterns.forEach(function(pattern) {
        pattern.regexcomp = new RegExp(pattern.regex);
      });
    });

    var xtraData = [];
    $scope.preprocessed.forEach(function(row, index) {

      // Skip empty rows
      if (row.some(function(value) { return value; })) {

        // For the header row
        if (index == 0) {

          // Add the additional header fields
          $scope.config.bodyAddCols.forEach(function(hdr) {
            row.push( hdr );
          });

        } else {

          xtraData = processRow(
            $scope.config.bodyPatterns, $scope.config.bodyAddCols, row
          );

          xtraData.forEach(function(xtra) {
            row.push( xtra );
          });
        }

        // Add the row
        $scope.results.push( row );
      }
    })
  }

  $scope.resultsLink = '';
  $scope.saveResults = function() {
    var data = {filename: 'foooobar', contents: $scope.results};
    $http.post('/results', data).
      success(function(data) {
        $scope.resultsLink = data
        alert("Results have been saved");
      }).
      error(function(data, status, headers, config) {
        alert("Failed to save results");
      });
  }

}]);


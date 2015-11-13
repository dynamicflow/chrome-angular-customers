var app = angular.module('app', [
    'ngResource',
    'ngAnimate',
    'ui.bootstrap', 
    'ui.router',    
    'indexedDB'
]);

app.factory('settings', function() {
    var settings = {
        apiHost: 'http://localhost:8080',
        token: "3f0c061549010bc70447efbef04fa0a8",
        strategy: 'online'
    };

    return settings;
});

app.config(['$stateProvider', '$urlRouterProvider', '$indexedDBProvider', '$httpProvider', function($stateProvider, $urlRouterProvider,$indexedDBProvider,$httpProvider) {
	
	$urlRouterProvider.otherwise("/customers");

    $stateProvider	    
        .state('customers', {
            url: "/customers",
            templateUrl: "views/customers/index.html",   
            controller: "customerController",
            data: {pageTitle: 'Customers'}
        })
    $indexedDBProvider
        .connection('customerDB')
        .upgradeDatabase(1, function(event, db, tx){
			var objStore = db.createObjectStore('customers', {keyPath: 'id'});
			objStore.createIndex('name_idx', 'name', {unique: false});
        });
    
    $httpProvider.interceptors.push(['$q','$rootScope','$timeout','$injector', function($q, $rootScope, $timeout, $injector) {
    	var settings = null;
    	$timeout(function () {
    		settings = $injector.get('settings');
    	});
    	
    	return {
    	    // optional method
    	    'request': function(config) {  
    	    	if (settings && settings.token) {
    	    		config.headers['Authorization'] = 'Bearer '+settings.token;
    	    	} else {
    	    		config.headers['Authorization'] = 'Bearer 3f0c061549010bc70447efbef04fa0a8';
    	    	}
    	    	return config;
    	    }
    	};
    }]);
}]);


app.factory('customerLocalService', ['$indexedDB', function($indexedDB) {
	var customerLocalService = {
		getCustomers: function(options, callback) {
			$indexedDB.openStore('customers', function(store) {
				store.getAll().then(function(customers) {  
					console.log("get customers",customers)
			        callback(customers);
				});
			});
		},
		
		save: function(customer, callback) {
			$indexedDB.openStore('customers', function(store) {
				store.upsert(customer).then(function(customer) {  
					console.log("upsert customer",customer)
			        callback();
				});
			});
		}
	}
	
	return customerLocalService;
}]);

app.factory('synchronizationService', ['customerLocalService','customersRemoteService', function(customerLocalService,customersRemoteService) {
	var synchronizationService = {
		synchronize: function(callback) {
			customersRemoteService.query({
				limit:1000,
				offset:0        		
			}, function(customers) {
				console.log("get customers",customers)
				customers.forEach(function(customer) {
					customerLocalService.save(customer, function() {
				        console.log("customer synchronized",customer);
				    });
				});	
				callback();
			}); 
		}
	}
	
	return synchronizationService;
}]);

app.factory('customersRemoteService',['$resource','settings', function($resource, settings) {
    return $resource(settings.apiHost+'/customers');
}])

app.controller('headerController', [ '$scope','$rootScope', 'settings','synchronizationService', function($scope, $rootScope, settings, synchronizationService) {

	$scope.strategy = settings.strategy;

	$scope.toggleStrategy = function() {
		console.log('changing strategy', settings.strategy, $scope.strategy);
		if ($scope.strategy=='offline') {
			synchronizationService.synchronize(function() {
				settings.strategy = $scope.strategy;
				$rootScope.$emit("strategyChanged", $scope.strategy);
			});
		} else {
			settings.strategy = $scope.strategy;
			$rootScope.$emit("strategyChanged", $scope.strategy);
		}		
		console.log('strategy changed', settings.strategy, $scope.strategy);
	}
}]);

app.controller('customerController', ['$scope','$rootScope','settings','customerLocalService','customersRemoteService', function ($scope, $rootScope, settings, customerLocalService, customersRemoteService) {
	
	$scope.customers =[];
	
	var cleanupStrategyChanged = $rootScope.$on('strategyChanged', function(event, strategy) {
    	console.log('customerController.$on.strategyChanged', strategy);    	
    	$scope.reset();
    });
	
	$scope.$on('$viewContentLoaded', function(event) {
		console.log('customerController.$on.$viewContentLoaded');
    	
    	$scope.reset();
    });
	
	$scope.$on('$destroy', function(event, scope) {
		console.log('customerController.$on.$destroy');
		cleanupStrategyChanged();
	});

	$scope.reset = function() {
		console.log('customerController.reset()', settings.strategy);
		if (settings.strategy=='offline') {
			customerLocalService.getCustomers({},function(customers) {
				$scope.customers = customers;
			});
		} else
		if (settings.strategy=='online') {
			customersRemoteService.query({
				limit:1000,
				offset:0        		
			}, function(customers) {
				console.log("get customers",customers)
				$scope.customers = customers;
			}); 
		}  
	}

}]);

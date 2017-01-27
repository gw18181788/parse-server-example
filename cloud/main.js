
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});
Parse.Cloud.define("getGeocodeAddress", function(request, response) {
    var os = request.params.os;
    var address = "address=" + request.params.address;
    var key = "AIzaSyA9-MTsF_RRWLChLp3atdqWRQRq_19tIME";
    var baseUrl = "https://maps.googleapis.com/maps/api/geocode/json?";
    var url = baseUrl + address + "&key=" + key;

    Parse.Cloud.httpRequest({
        url: url
    }).then(function(httpResponse) {
        var components = httpResponse.data.results[0].address_components;
        var formattedAddress = httpResponse.data.results[0].formatted_address;
        var num = components.length;
        var status = httpResponse.data.status;
        var streetNumber, route, city, state;
        
        for (var i = 0; i < num; i++) {
            var types = components[i].types;
            
            switch (types[0]) {
                case "street_number":
                    streetNumber = components[i].long_name;
                    break;
                case "route":
                    route = components[i].short_name;
                    break;
                case "locality":
                    city = components[i].long_name;
                    break;
                case "administrative_area_level_1":
                    state = components[i].long_name;
                    break;
                default:
            }
        }
        if (formattedAddress && streetNumber && route && city && state) {
            response.success([formattedAddress, streetNumber, route, city, state]);
        } else {
            response.error("Unable to locate address. " +
                           "Try again or contact technical support for assistance.");
        }
    }, function(httpResponse) {
        console.error("Error: " + httpResponse.data);
        response.error(httpResponse.data);
    });
});
    
Parse.Cloud.define("getListOfCities", function(request, response) {
    var state = request.params.state;
    var query = new Parse.Query("States");
    
    query.equalTo("state", state);
    query.select("cities");
    query.first({
        success: function(result) {
            var cities = result.get("cities");
            response.success(cities.sort());
        },
        error: function(error) {
            console.error("Error: " + error.message);
            response.error("Error: " + error.message);
        }
    });
});

Parse.Cloud.define("getListOfServices", function(request, response) {
    var query = new Parse.Query("Services");
    query.select("serviceType");
    query.ascending("serviceType");
    query.find({
        success: function(results) {
            var num = results.length;
            var services = [];
            for (var i = 0; i < num; i++) {
                services[i] = results[i].get("serviceType");
            }
            response.success(services);
        },
        error: function(error) {
            console.error("Error: " + error.message);
            response.error("Error: " + error.message);
        }
    });
});

Parse.Cloud.define("getListOfStates", function(request, response) {
    var query = new Parse.Query("States");
    query.select("state");
    query.ascending("state");
    query.find({
        success: function(results) {
            var num = results.length;
            var states = [];
            for (var i = 0; i < num; i++) {
                states[i] = results[i].get("state");
            }
            response.success(states);
        },
        error: function(error) {
            console.error("Error: " + error.message);
            response.error("Error: " + error.message);
        }
    });
});

Parse.Cloud.define("reply2Customer", function(request, response) {
	var custId = request.params.custId;
	var barber = request.params.barber;
	var pushQuery = new Parse.Query(Parse.Installation);
	var message = "Barber: " + barber + " has received your message.";
	
	pushQuery.equalTo("installationId", custId);
	Parse.Push.send({
		where: pushQuery,
		data: {
			title: "Message received from barber",
			alert: message
		},
	}, {
		success: function() {
			response.success("Request was sent");
		},
		error: function(err) {
			response.error("ERROR: " + err.code + ":" + err.message);
		}
	});
});

Parse.Cloud.define("notifyBarber", function(request, response) {
	var barberId = request.params.barberId;
	//var installationId = request.params.installationId;
	var custId = request.params.custId;
	var custName = request.params.custName;
	var duration = request.params.duration;
	var services = request.params.services;
	var minutes = duration.replace(" minutes", "");
	var message = "Customer: " + custName + "; Arriving: " + duration + "; Service: " + services;
	var user = new Parse.User();
	user.id = barberId;
	
	var userQuery = new Parse.Query(Parse.User);
	userQuery.get(barberId, {
		success: function(obj) {
			var userStatus = obj.get("status");
			
			if (userStatus === "A") {
				var pushQuery = new Parse.Query(Parse.Installation);
				pushQuery.equalTo("user", user);
				Parse.Push.send({
					where: pushQuery,
					data: {
						title: "Customer Request",
						alert: message,
						custId: custId,
                        sound: "default"
					}
				}, {
					success: function() {
						response.success("Request was sent");
					},
					error: function(err) {
						response.error("ERROR: " + err.code + ":" + err.message);
					}
				});
			} else {
				response.error("Barber may be unavailable. Click refresh button for current status.");
			}
		},
		error: function(obj, err) {
			response.error("ERROR: " + err.code + " : " + err.message);
		}
	});
	
	//user.id = barberId;
	// Find barber/user object using his/her id
	//userQuery.equalTo("objectId", user.id);
	
	// Find device associated with this barber/user
	//var pushQuery = new Parse.Query(Parse.Installation);
	//pushQuery.equalTo("user", user);
	/*
	user.id = installationId;
	
	Parse.Push.send({
		where: pushQuery,
		//channels: [ user.id ],
		data: {
			title: "Customer Request",
			alert: message,
			customerId: custId
		}
	}, {
		success: function() {
			response.success("Request was sent");
		}, 
		error: function(err) {
			response.error(err);
		}
	});*/
});

// Before saving to this user, add to States class list, if not already listed
Parse.Cloud.beforeSave(Parse.User, function(request, response) {
    if (request.object.isNew()) {
        
        var city = request.object.get("city");
        var state = request.object.get("state");
        var StateObject = Parse.Object.extend("States");
        
        var query = new Parse.Query(StateObject);
        query.equalTo("state", state);
        query.first({
            success: function(object) {
                var obj;
                
                if (object) {
                    // This state object already exists
                    obj = object;
                } else {
                    // Add this state object
                    var obj = new StateObject();
                    obj.set("state", state);
                }
                obj.addUnique("cities", city);
                obj.save(null, {
                    success: function(obj) {
                        response.success();
                    },
                    error: function(obj, error) {
                        console.error("Failed to add state: " + city + ", error: " +
                                      error.message);
                        response.error(error.message);
                    }
                });
            },
            error: function(error) {
                console.error("Parse Error: " + error.message);
                        response.error(error.message);
            }
        });
        
    } else {
        response.success();
    }
});

// Send push notification to channels setup for availability status
Parse.Cloud.afterSave(Parse.User, function(request) {
  // Prefix object ids with "ch" since channels field in Parse.Installation
  //  will not allow the 1st character to be a number.
  var id = "ch" + request.object.id;
  var barber = request.object.get("name");
  var avail = request.object.get("status");
  var email = request.object.get("email");
  
  if (avail === "A") {
    Parse.Push.send({
      channels: [ id ],
      data: {
        title: "Barber Status Update",
        alert: "Barber " + barber + " may be available.",
        sound: "default"
      }
    }, {
      success: function() {
	// Push was successful
      }, 
      error: function(err) {
	// Log error on Parse.com
        console.error("ERROR: " + err.code + " : " + err.message);
      }
    });
  }
});

// End of file

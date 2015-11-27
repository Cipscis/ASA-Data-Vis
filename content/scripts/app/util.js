define([], function () {

	/********
	FILTERING
	********/

	var filter = function (arr, match) {
		// Filter an array of objects
		// Each element in the match object must === the equivalent element (AND)
		// Arrays in the match object can be regular expressions
		// Arrays in the match object allow multiple options to be matched (OR)

		return arr.filter(function (el) {
			var andMatch = true,
				i;
			for (i in match) {
				if (typeof match[i] === 'function') {
					andMatch = andMatch && match[i](el[i]);
				} else {
					andMatch = andMatch && contains(match[i], el[i]);
				}
			}
			return andMatch;
		});
	};

	var contains = function (query, value) {
		var i, j,
			match, matchOr;

		/* VALID INPUTS:

			query = string		value = string
				Does value contain query?
			query = [string]	value = [string],
				Does value contain all elements of query?
			query = string		value = [string]
				Do any elements of value contain query?
			query = [string]		value = string
				Does value match any element of query?

			Otherwise return query === value

		*/

		if (typeof value === 'string' && typeof query === 'string') {

			// Does value string contain query string?
			match = value.toLowerCase().match(query.toLowerCase());

		} else if (value instanceof Array) {

			if ((query instanceof Array)) {

				// Does value array contain all elements of query array?
				match = true;
				for (i = 0; i < query.length; i++) {
					matchOr = false;
					for (j = 0; j < value.length; j++) {
						matchOr = matchOr || value[j].toString().toLowerCase().match(query[i].toString().toLowerCase());
					}
					match = match && matchOr;
				}

			} else {

				// Do any elements of value array contain query string?
				match = false;
				for (i = 0; i < value.length; i++) {
					if (value[i].toString().toLowerCase().match(query.toString().toLowerCase())) {
						match = true;
					}
				}

			}

		} else if (query instanceof Array) {

			// Does value match any elements of query array?
			match = false;
			for (i = 0; i < query.length; i++) {
				if (value.toString().toLowerCase().match(query[i].toString().toLowerCase())) {
					match = true;
				}
			}

		} else {

			match = query === value;

		}

		return match;
	};

	/******
	SORTING
	******/

	var by = function (/*propName, query, replace, callback*/) {
		var propName = arguments[0],
			query = arguments[1],
			replace = arguments[2],
			callback = arguments[3];

		var sortFunction = function (a, b) {
			var pa = _getSortVal(a, propName, query, replace),
				pb = _getSortVal(b, propName, query, replace);

			return callback ? callback(pa, pb) : pa - pb;
		};

		sortFunction.then = _buildSecondarySort([propName, query, replace, callback]);
		return sortFunction;
	};

	var _buildSecondarySort = function (/*[args1, args2, ...]*/) {
		var primaryArgs = Array.prototype.slice.call(arguments);

		var then = function (/*propName, query, replace, callback*/) {
			var secondaryArgs = Array.prototype.slice.call(arguments);
			var args = primaryArgs.concat([secondaryArgs]);

			var sortFunction = function (a, b) {
				var i,
					pa, pb,
					returnVal = 0;

				for (i = 0; i < args.length; i++) {
					pa = _getSortVal(a, args[i][0], args[i][1], args[i][2]);
					pb = _getSortVal(b, args[i][0], args[i][1], args[i][2]);

					returnVal = returnVal || (args[i][3] ? args[i][3](pa, pb) : pa - pb);
				}

				return returnVal;
			};

			sortFunction.then = _buildSecondarySort.apply(this, args);
			return sortFunction;
		};
		return then;
	};

	var _getSortVal = function (el, propName, query, replace) {
		var a = el[propName];

		if (query) {
			if (replace) {
				a = a.replace(query, replace);
			} else {
				a = a.match(query);
				a = a && a[0];
			}
		}

		return a;
	};

	return {
		filter: filter,
		contains: contains,
		by: by
	};

});
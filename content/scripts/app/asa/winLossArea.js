define([
	'jquery',
	'd3',
	'util'
], function ($, d3, util) {

	var url,

		complaints, days,
		runningAverage,
		aveL,

		width = 900,
		height = 400,
		hGutter = 100,
		vGutter = 80,

		svg,

		yScale, yAxis,
		yScale2, yAxis2,
		xScale, xAxis,

		lessThanOneYear,

		winArea, lossArea, drawArea,
		percentLine;

	var init = function (u, length) {
		url = u;
		aveL = length;

		_createSvg();
		_getData();
	};

	var _createSvg = function () {
		svg = d3.select('.asa-data');
		svg.attr({
			width: width,
			height: height
		});
	};

	var _getData = function () {
		$.ajax({
			url: url,
			dataType: 'jsonp'
		}).complete(_processData);
	};

	var _processData = function (data) {
		data = data.responseJSON;

		_getComplaints(data);
		_sortComplaints();

		_buildComplaintsIndexByDay();
		_createRunningAverage();

		_createInteractive();
	};

	var _getComplaints = function (data) {
		var i;

		complaints = [];
		for (i in data.complaints) {
			complaints.push(data.complaints[i]);
		}

		// Exclude complaints with dates in the far past or future
		complaints = complaints.filter(function (d) {
			var date = new Date(d.meetingdate);
			return date.getTime() && date > new Date('2008') && date < new Date('2050');
		});
	};

	var _sortComplaints = function () {
		complaints.sort(util
			.by('meetingdate', /^(\d+)-\d+-\d+$/, '$1')
			.then('meetingdate', /^\d+-(\d+)-\d+$/, '$1')
			.then('meetingdate', /^\d+-\d+-(\d+)$/, '$1')
			.then('idslash', /\d+$/)
		);
	};

	var _buildComplaintsIndexByDay = function () {
		var i, j,
			complaint, day;

		days = [];
		for (i = 0; i < complaints.length; i++) {
			complaint = complaints[i];

			if ((new Date(complaint.meetingdate)).getTime()) {
				day = days.filter(function (el) {
					return !(el.date - new Date(complaint.meetingdate));
				});

				if (day.length === 0) {
					days.push({
						date: new Date(complaint.meetingdate),
						complaints: []
					});
					day = days[days.length-1];
				} else {
					day = day[0];
				}
			} else {
				day = days[0];
			}

			day.complaints.push(complaint);
		}

		// Pad out days with fake ones on all other days
		for (i = 0; i < days.length-1; i++) {
			// Milliseconds in 1 day
			if (days[i+1].date - days[i].date !== 86400000) {
				days.splice(i+1, 0, {
					date: new Date(days[i].date.getTime() + 86400000),
					complaints: []
				});
			}
		}

		for (i = 0; i < days.length; i++) {
			day = days[i];

			day.wins = 0;
			day.losses = 0;
			day.draws = 0;
			for (j = 0; j < day.complaints.length; j++) {
				complaint = day.complaints[j];

				if (complaint.result === 'win') {
					day.wins += 1;
				} else if (complaint.result === 'loss') {
					day.losses += 1;
				} else if (complaint.result === 'draw') {
					day.draws += 1;
				}
			}
		}
	};

	var _createRunningAverage = function () {
		// Create running average
		runningAverage = [];
		for (i = aveL-1; i < days.length; i++) {
			runningAverage.push({
				date: days[i].date,
				wins: 0,
				losses: 0,
				draws: 0,
				complaints: 0
			});
			for (j = 0; j < aveL && (i-j) > 0; j++) {
				runningAverage[i-(aveL-1)].wins += days[i-j].wins / (aveL);
				runningAverage[i-(aveL-1)].losses += days[i-j].losses / (aveL);
				runningAverage[i-(aveL-1)].draws += days[i-j].draws / (aveL);
				runningAverage[i-(aveL-1)].complaints += days[i-j].complaints.length / (aveL);
			}
		}
	};

	var _createInteractive = function () {
		_createScales();
		_drawAxes();

		_drawWins();
		_drawLosses();
		_drawDraws();
		_drawPercentLine();

		_drawTitle();

		_removeLoader();
	};

	var _createScales = function () {
		var firstDate, lastDate;

		yScale = d3.scale.linear()
			.domain([0, d3.max(runningAverage, function (d) {return d.complaints;})])
			.range([height - vGutter, vGutter]);

		yScale2 = d3.scale.linear()
			.domain([0, 1])
			.range([height-vGutter, vGutter]);

		firstDate = d3.min(runningAverage, function (d) {return d.date;});
		lastDate = d3.max(runningAverage, function (d) {return d.date;});

		// Milliseconds in one leap year
		if (lastDate - firstDate < 31536000000) {
			lessThanOneYear = true;
		}

		xScale = d3.time.scale()
			.domain([firstDate, lastDate])
			.range([hGutter, width - hGutter]);
	};

	var _drawAxes = function () {
		_drawXAxis();
		_drawYAxis();
		_drawYAxis2();
	};

	var _drawXAxis = function () {
		xAxis = d3.svg.axis()
			.scale(xScale)
			.ticks(lessThanOneYear ? d3.time.months : d3.time.years)
			.orient('bottom');

		svg
			.append('g')
				.attr('class', 'axis')
				.attr('transform', 'translate(0, ' + (height-vGutter) + ')')
				.call(xAxis)
			.append('text')
				.attr('text-anchor', 'middle')
				.attr('x', width/2)
				.attr('y', vGutter/2)
				.text('Date');
	};

	var _drawYAxis = function () {
		yAxis = d3.svg.axis()
			.scale(yScale)
			.orient('left');

		svg
			.append('g')
				.attr('class', 'axis')
				.attr('transform', 'translate(' + hGutter + ', 0)')
				.call(yAxis)
			.append('text')
				.attr('text-anchor', 'middle')
				.attr('x', -height/2)
				.attr('y', -hGutter/2)
				.text('Complaints per day')
				.style('transform', 'rotate(-90deg)');
	};

	var _drawYAxis2 = function () {
		yAxis2 = d3.svg.axis()
			.scale(yScale2)
			.orient('right')
			.ticks(3)
			.tickFormat(d3.format('.0%'));

		svg
			.append('g')
				.attr('class', 'axis')
				.attr('transform', 'translate(' + (width-hGutter) + ', 0)')
				.call(yAxis2)
			.append('text')
				.attr('text-anchor', 'middle')
				.attr('x', height/2)
				.attr('y', -hGutter/2)
				.text('% Successful complaints')
				.style('transform', 'rotate(90deg)');
	};

	var _drawWins = function () {
		area = d3.svg.area()
			.x(function (d) {return xScale(d.date);})
			.y0(height-vGutter)
			.y1(function (d) {return yScale(d.wins);});

		winArea = svg
			.append('g')
				.attr('class', 'area');

		winArea
			.append('path')
				.datum(runningAverage)
				.attr('d', area)
				.style('fill', '#9f9');

		winArea
			.append('title')
				.text('Successful complaints');
	};

	var _drawLosses = function () {
		area = d3.svg.area()
			.x(function (d) {return xScale(d.date);})
			.y0(function (d) {return yScale(d.wins);})
			.y1(function (d) {return yScale(d.wins+d.losses);});

		lossArea = svg
			.append('g')
				.attr('class', 'area');

		lossArea
			.append('path')
				.datum(runningAverage)
				.attr('d', area)
				.style('fill', '#f99');

		lossArea
			.append('title')
				.text('Unsuccessful complaints');
	};

	var _drawDraws = function () {
		area = d3.svg.area()
			.x(function (d) {return xScale(d.date);})
			.y0(function (d) {return yScale(d.wins+d.losses);})
			.y1(function (d) {return yScale(d.wins+d.losses+d.draws);});

		drawArea = svg
			.append('g')
				.attr('class', 'area');

		drawArea
			.append('path')
				.datum(runningAverage)
				.attr('d', area)
				.style('fill', '#99f');

		drawArea
			.append('title')
				.text('Withdrawn complaints');
	};

	var _drawPercentLine = function () {
		line = d3.svg.line()
			.x(function (d) {return xScale(d.date);})
			.y(function (d) {
				var perc = d.wins/(d.wins+d.losses);
				return yScale2(isNaN(perc) ? 0 : perc);
			});

		percentLine = svg
			.append('g')
				.attr('class', 'line');

		percentLine
			.append('path')
				.attr('d', line(runningAverage))
				.attr({
					fill: 'none',
					'stroke-width': 2,
					stroke: 'rgba(0, 0, 0, 0.5)'}
				);

		percentLine
			.append('title')
				.text('% Successful complaints');
	};

	var _drawTitle = function () {
		var title = svg.append('text')
			.attr('x', width/2)
			.attr('y', vGutter/2)
			.attr('text-anchor', 'middle')
			.style('font-size', '16px')
			.text('ASA Complaints: ' + _getTitleFromUrl());
	};

	var _getTitleFromUrl = function () {
		var title = url.match(/asa.sbh.nz\/(.*)\.json/);

		if (title) {
			title = title[1].replace(/\+/g, ' ').replace(/\//g, ' - ');
		} else {
			return '';
		}

		title = title.replace(/\w\S*/g, function (t) {
			return t.charAt(0).toUpperCase() + t.substr(1).toLowerCase();
		});

		return title;
	};

	var _removeLoader = function () {
		// Remove loader
		// Timeout allows CSS transitions to take place
		window.setTimeout(function () {
			$(svg[0]).closest('.loading').removeClass('loading');
		}, 0.5);
	};

	return {
		init: init
	};

});
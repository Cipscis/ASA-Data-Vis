define([
	'jquery',
	'd3',
	'util'
], function ($, d3, util) {

	var complaintsUrl = 'http://asa.sbh.nz/sbh/all.json',
		membersUrl = 'http://asa.sbh.nz/sbh.json',

		members, membersSorted,
		complaints, complaintsIndex,
		colourIndex,

		i, j,

		width = 900,
		height = 400,
		hGutter = 20,
		vGutter = 200,

		svg,
		xScale, xAxis,
		complaintCircles, people;

	var init = function () {
		svg = d3.select('.asa-data');
		svg.attr({
			width: width,
			height: height
		});

		$.ajax({
			url: complaintsUrl,
			dataType: 'jsonp'
		}).complete(_processComplaints);
	};

	var _processComplaints = function (data) {
		/// Produce complaints object from JSON

		data = data.responseJSON;

		complaints = [];
		for (i in data.complaints) {
			complaints.push(data.complaints[i]);
		}

		complaints.sort(util
			.by('year')
			.then('meetingdate', /(\d+)-\d+-\d+/, '$1')
			.then('meetingdate', /\d+-(\d+)-\d+/, '$1')
			.then('meetingdate', /\d+-\d+-(\d+)/, '$1')
			.then('idslash', /\d+$/)
		);

		$.ajax({
			url: membersUrl,
			dataType: 'jsonp'
		}).complete(_processMembers);
	};

	var _processMembers = function (data) {
		/// Produce members and membersSorted objects from JSON

		data = data.responseJSON;

		// Get members
		members = [];
		for (i in data.complainants) {
			members.push(i);
		}

		// Sort membersSorted by number of complaints
		complaintsIndex = {};
		for (i = 0; i < members.length; i++) {
			complaintsIndex[members[i]] = util.filter(complaints, {
				complainants: members[i]
			});
		}

		membersSorted = [];
		for (i = 0; i < members.length; i++) {
			membersSorted.push(members[i]);
		}
		membersSorted.sort(function (a, b) {
			var aComplaints,
				bComplaints;

			aComplaints = complaintsIndex[a];
			bComplaints = complaintsIndex[b];

			return aComplaints.length - bComplaints.length;
		});

		_createInteractive();
	};


	var _createInteractive = function () {
		/// Create interactive chart

		// Created colourIndex by splitting adjacent members
		colourIndex = [];
		for (i = 0; i < 6; i++) {
			for (j = i; j < membersSorted.length; j += 6) {
				colourIndex.push(membersSorted[j%membersSorted.length]);
			}
		}

		var getPersonColour = function (person, opacity) {
			return 'hsl(' + ((colourIndex.indexOf(person)+1)/members.length*360) + ', 100%, 50%)';
		};

		// Create scale and axis
		xScale = d3.time.scale()
			.domain([(new Date('2008').getTime()), (new Date('2016').getTime())])
			.range([hGutter, width-hGutter]);

		xAxis = d3.svg.axis()
			.scale(xScale)
			.ticks(d3.time.years)
			.orient('bottom');

		svg.append('g')
			.attr('class', 'axis')
			.attr('transform', 'translate(0, ' + (height-vGutter) + ')')
			.call(xAxis);

		// Bind and draw complaint circles
		complaintCircles = svg.append('g')
			.attr('class', 'complaints')
				.selectAll('.circle')
				.data(complaints).enter()
				.append('a')
					.attr('xlink:href', function (d) {return d.links.sbh;});

		complaintCircles
			.append('circle')
				.attr({
					cx: function (d) {
						var date = new Date(d.meetingdate);

						return date.getTime() ? xScale(date) : -100;
					},
					cy: function (d) {return Math.random() * (height-vGutter - 50)+hGutter;},
					r: 10
				})
				.style({
					fill: function (d) {return getPersonColour(d.complainants[0]);},
					opacity: 0.5
				});

		complaintCircles.append('title')
			.text(function (d) {return d.idslash + ': ' + d.advert;});

		// Bind and draw people
		var circleRadius = 10,
			circleRadiusHi = 20,
			circleOpacity = 0.5,
			circleOpacityLo = 0.1,
			circleOpacityHi = 0.7;

		people = svg.append('g')
			.attr('class', 'people')
				.selectAll('g')
				.data(membersSorted).enter()
					.append('a')
						.attr('xlink:href', function (d) {
							return 'http://asa.sbh.nz/complainant/' + d.replace(/\s/g, '+');
						})
						.attr('class', 'person')
						.attr('transform', 'translate(' + hGutter + ' ' + (height-160) + ')');

		people
			.append('circle')
				.attr({
					cx: function (d, i) {
						return i*30;
					},
					cy: 0,
					r: circleRadius
				})
				.style({
					fill: getPersonColour,
					opacity: circleOpacity
				});

		people
			.append('text')
				.attr({
					dy: function (d, i) {return 5-i*30;},
					dx: 15,
					transform: 'rotate(90)'
				})
				.text(function (d) {return d;});

		// Remove loader
		// Timeout allows CSS transitions to take place
		window.setTimeout(function () {
			$(svg[0]).closest('.loading').removeClass('loading');
		}, 0.5);

		// Bind events
		complaintCircles
			.on('mouseover', function (e) {
				people.data(membersSorted).selectAll('circle')
					.attr({
						r: function (d) {
							return util.contains(d, e.complainants) ? circleRadiusHi : circleRadius;
						}
					})
					.style({
						opacity: function (d) {
							return util.contains(d, e.complainants) ? circleOpacityHi : circleOpacity;
						}
					});
				complaintCircles.data(complaints).selectAll('circle')
					.attr({
						r: function (d) {
							var containsComplainant = false,
								i;

							for (i = 0; i < e.complainants.length; i++) {
								containsComplainant = containsComplainant || util.contains(e.complainants[i], d.complainants);
							}
							return containsComplainant ? circleRadiusHi : circleRadius;
						}
					})
					.style({
						opacity: function (d) {
							var containsComplainant = false,
								i;

							for (i = 0; i < e.complainants.length; i++) {
								containsComplainant = containsComplainant || util.contains(e.complainants[i], d.complainants);
							}
							return containsComplainant ? circleOpacityHi : circleOpacityLo;
						}
					});
			})
			.on('mouseout', function (e) {
				people.selectAll('circle')
					.attr('r', circleRadius);
				complaintCircles.selectAll('circle')
					.attr('r', circleRadius)
					.style('opacity', circleOpacity);
			});

		people
			.on('mouseover', function (e) {
				d3.select(this).selectAll('circle')
					.attr('r', circleRadiusHi)
					.style('opacity', circleOpacityHi);
				complaintCircles.data(complaints).selectAll('circle')
					.attr({
						r: function (d) {
							return util.contains(e, d.complainants) ? circleRadiusHi : circleRadius;
						}
					})
					.style({
						opacity: function (d) {
							return util.contains(e, d.complainants) ? circleOpacityHi : circleOpacityLo;
						}
					});
			})
			.on('mouseout', function (e) {
				d3.select(this).selectAll('circle')
					.attr('r', circleRadius)
					.style('opacity', circleOpacity);
				complaintCircles.selectAll('circle')
					.attr('r', circleRadius)
					.style('opacity', circleOpacity);
			});
	};

	return {
		init: init
	};

});
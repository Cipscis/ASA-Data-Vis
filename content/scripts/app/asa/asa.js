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
		svg, complaintCircles, people;

	var init = function () {
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


		svg = d3.select('.asa-data');
		svg.attr({
			width: 900,
			height: 400
		});

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
						var date = new Date(d.meetingdate),
							year = new Date(d.meetingdate),
							ms = 1000*60*60*24*365.25;

						if (!date.getTime()) {
							return -100;
						}

						year.setMonth(0);
						year.setDate(1);
						year.setFullYear(2008);

						return (date-year)/ms/8*900;
					},
					cy: function (d) {return Math.random() * 150+20;},
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
			circleOpacityHi = 0.9;

		people = svg.append('g')
			.attr('class', 'people')
				.selectAll('g')
				.data(membersSorted).enter()
					.append('a')
						.attr('xlink:href', function (d) {
							return 'http://asa.sbh.nz/complainant/' + d.replace(/\s/g, '+');
						})
						.attr('class', 'person')
						.attr('transform', 'translate(20 240)');

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
							return containsComplainant ? circleOpacity : circleOpacityLo;
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
					.style('opacity', circleOpacity);
				complaintCircles.data(complaints).selectAll('circle')
					.attr({
						r: function (d) {
							return util.contains(e, d.complainants) ? circleRadiusHi : circleRadius;
						}
					})
					.style({
						opacity: function (d) {
							return util.contains(e, d.complainants) ? circleOpacity : circleOpacityLo;
						},
						'z-index': function (d) {
							return util.contains(e, d.complainants) ? 2 : 1;
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